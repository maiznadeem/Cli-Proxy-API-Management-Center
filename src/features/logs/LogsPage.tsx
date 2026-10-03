import { useDeferredValue, useEffect, useMemo, useReducer, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { lockScroll, unlockScroll } from '@/components/ui/scrollLock';
import {
  IconCopy,
  IconDownload,
  IconEye,
  IconMaximize2,
  IconMinimize2,
  IconRefreshCw,
  IconSearch,
  IconSlidersHorizontal,
  IconTrash2,
  IconX,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAuthStore, useConfigStore, useNotificationStore } from '@/stores';
import { logsApi, responseDataToText, type ErrorLogFile } from '@/services/api/logs';
import { INITIAL_VISIBLE_LINES } from './model/logBuffer';
import { useLogStream } from './hooks/useLogStream';
import { copyToClipboard } from '@/utils/clipboard';
import { getErrorMessage } from '@/utils/helpers';
import { downloadBlob } from '@/utils/download';
import {
  createLogParserCache,
  searchLogEntries,
  filterLogEntries,
} from '@/features/logs/model/logSelectors';
import { Select } from '@/components/ui/Select';
import { formatUnixTimestamp } from '@/utils/format';
import { MANAGEMENT_API_PREFIX } from '@/utils/constants';
import { HTTP_METHODS, STATUS_GROUPS, type LogState } from './model/logTypes';
import { createLogRequestGuard } from './model/logRequests';
import { splitHighlight } from './model/logHighlight';
import { errorLogViewerReducer } from './model/errorLogViewer';
import { shouldExitLogFullscreen } from './model/logFullscreen';
import { useLogFilters } from './hooks/useLogFilters';
import { isNearBottom, useLogScroller } from './hooks/useLogScroller';
import styles from './LogsPage.module.scss';

const INITIAL_DISPLAY_LINES = INITIAL_VISIBLE_LINES;

type TabType = 'logs' | 'errors';

export function LogsPage() {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const config = useConfigStore((state) => state.config);
  const requestLogEnabled = config?.requestLog ?? false;

  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [hideManagementLogs, setHideManagementLogs] = useLocalStorage(
    'logsPage.hideManagementLogs',
    true
  );
  const [showRawLogs, setShowRawLogs] = useLocalStorage('logsPage.showRawLogs', false);
  const [wrapLogs, setWrapLogs] = useLocalStorage('logsPage.wrapLogs', false);
  const [structuredFiltersExpanded, setStructuredFiltersExpanded] = useState(false);
  const [errorLogs, setErrorLogs] = useState<ErrorLogFile[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [errorLogsError, setErrorLogsError] = useState('');
  const [errorLogViewer, dispatchErrorLogViewer] = useReducer(errorLogViewerReducer, {
    status: 'closed',
  });
  const selectedErrorLog = errorLogViewer.status === 'closed' ? null : errorLogViewer.item;
  const [viewerRequestId, setViewerRequestId] = useState<string | null>(null);
  const [requestLogDownloading, setRequestLogDownloading] = useState(false);
  const [fullscreenLogs, setFullscreenLogs] = useState(false);

  const [requests] = useState(() => ({
    session: createLogRequestGuard(),
    errors: createLogRequestGuard(),
    viewer: createLogRequestGuard(),
  }));

  const {
    logBuffer,
    visibleCount,
    setVisibleCount,
    lastUpdated,
    catchingUp,
    wasReset,
    loading,
    clearingLogs,
    error,
    autoRefresh,
    setAutoRefresh,
    cpaNeedsFileLogging,
    showFileLoggingRequired,
    loadLogs,
    clearLogs,
  } = useLogStream({
    active: activeTab === 'logs',
    isFollowing: () => isNearBottom(logViewerRef.current),
    onFollow: () => requestScrollToBottom(),
  });

  const disableControls = connectionStatus !== 'connected';
  const refreshDisabled = disableControls || loading || clearingLogs || cpaNeedsFileLogging;
  const autoRefreshDisabled = disableControls || showFileLoggingRequired;
  const clearDisabled = disableControls || clearingLogs || showFileLoggingRequired;

  const downloadLogs = () => {
    const text = logBuffer.buffer.join('\n');
    downloadBlob({ filename: 'logs.txt', blob: new Blob([text], { type: 'text/plain' }) });
    showNotification(t('logs.download_success'), 'success');
  };

  const loadErrorLogs = async () => {
    if (useAuthStore.getState().connectionStatus !== 'connected') {
      setLoadingErrors(false);
      return;
    }
    const request = requests.errors.invalidate();
    setLoadingErrors(true);
    setErrorLogsError('');
    try {
      const res = await logsApi.fetchErrorLogs();
      if (!requests.errors.isCurrent(request)) return;
      // API 返回 { files: [...] }
      setErrorLogs(Array.isArray(res.files) ? res.files : []);
    } catch (err: unknown) {
      if (!requests.errors.isCurrent(request)) return;
      console.error('Failed to load error logs:', err);
      setErrorLogs([]);
      const message = getErrorMessage(err);
      setErrorLogsError(
        message ? `${t('logs.error_logs_load_error')}: ${message}` : t('logs.error_logs_load_error')
      );
    } finally {
      if (requests.errors.isCurrent(request)) setLoadingErrors(false);
    }
  };

  useHeaderRefresh(() => (activeTab === 'errors' ? loadErrorLogs() : loadLogs(false)));

  const downloadErrorLog = async (name: string) => {
    const session = requests.session.capture();
    try {
      const response = await logsApi.downloadErrorLog(name);
      if (!requests.session.isCurrent(session)) return;
      downloadBlob({ filename: name, blob: new Blob([response.data], { type: 'text/plain' }) });
      showNotification(t('logs.error_log_download_success'), 'success');
    } catch (err: unknown) {
      if (!requests.session.isCurrent(session)) return;
      const message = getErrorMessage(err);
      showNotification(
        `${t('notification.download_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    }
  };

  const openErrorLog = async (item: ErrorLogFile, byRequestId?: string) => {
    setViewerRequestId(byRequestId ?? null);
    const requestId = requests.viewer.invalidate();
    dispatchErrorLogViewer({ type: 'open', item });

    try {
      if (item.size && item.size > 2 * 1024 * 1024) throw new Error(t('logs.preview_too_large'));
      const response = byRequestId
        ? await logsApi.downloadRequestLogById(byRequestId)
        : await logsApi.downloadErrorLog(item.name);
      if (response.data instanceof Blob && response.data.size > 2 * 1024 * 1024) {
        throw new Error(t('logs.preview_too_large'));
      }
      const text = await responseDataToText(response.data);
      if (!requests.viewer.isCurrent(requestId)) return;
      dispatchErrorLogViewer({ type: 'ready', text });
    } catch (err: unknown) {
      if (!requests.viewer.isCurrent(requestId)) return;
      const message =
        byRequestId &&
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        err.status === 404
          ? `${t('logs.request_log_missing')} ${getErrorMessage(err)}`
          : getErrorMessage(err);
      dispatchErrorLogViewer({
        type: 'error',
        message: message
          ? `${t('logs.error_log_open_failed')}: ${message}`
          : t('logs.error_log_open_failed'),
      });
    }
  };

  const closeErrorLogViewer = () => {
    requests.viewer.invalidate();
    dispatchErrorLogViewer({ type: 'close' });
  };

  const copySelectedErrorLog = async () => {
    if (errorLogViewer.status !== 'ready' || !errorLogViewer.text) return;
    const session = requests.session.capture();
    const ok = await copyToClipboard(errorLogViewer.text);
    if (!requests.session.isCurrent(session)) return;
    showNotification(
      ok
        ? t('logs.error_log_copy_success')
        : t('logs.copy_failed', { defaultValue: 'Copy failed' }),
      ok ? 'success' : 'error'
    );
  };

  useEffect(() => {
    const resetErrors = () => {
      requests.errors.invalidate();
      setErrorLogs([]);
      setLoadingErrors(false);
      setErrorLogsError('');
    };
    const invalidateSession = () => {
      requests.session.invalidate();
      requests.errors.invalidate();
      requests.viewer.invalidate();
    };

    // Store subscriptions invalidate synchronously, before a response can beat effect cleanup.
    const unsubscribeAuth = useAuthStore.subscribe((next, previous) => {
      if (
        next.apiBase === previous.apiBase &&
        next.managementKey === previous.managementKey &&
        next.connectionStatus === previous.connectionStatus &&
        next.isAuthenticated === previous.isAuthenticated
      )
        return;
      invalidateSession();
      resetErrors();
      dispatchErrorLogViewer({ type: 'close' });
      setViewerRequestId(null);
      setRequestLogDownloading(false);
    });
    const unsubscribeConfig = useConfigStore.subscribe((next, previous) => {
      if (next.config?.requestLog !== previous.config?.requestLog) resetErrors();
    });
    return () => {
      unsubscribeAuth();
      unsubscribeConfig();
      invalidateSession();
    };
  }, [requests]);

  useEffect(() => {
    if (activeTab !== 'errors') return;
    if (connectionStatus !== 'connected') return;
    void loadErrorLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, connectionStatus, apiBase, managementKey, requestLogEnabled]);

  const [parseEntries] = useState(createLogParserCache);
  const entries = useMemo(() => parseEntries(logBuffer), [logBuffer, parseEntries]);
  const [levelFilter, setLevelFilter] = useState('');
  const trimmedSearchQuery = deferredSearchQuery.trim();
  const isSearching = trimmedSearchQuery.length > 0;
  const parsedSearchLines = useMemo(
    () => searchLogEntries(entries, trimmedSearchQuery, hideManagementLogs),
    [entries, trimmedSearchQuery, hideManagementLogs]
  );

  const filters = useLogFilters({ parsedLines: parsedSearchLines });
  const structuredFiltersPanelId = 'logs-structured-filters';
  const structuredFilterCount =
    filters.methodFilters.length + filters.statusFilters.length + filters.pathFilters.length;

  const filteredParsedLines = useMemo(
    () =>
      filterLogEntries(parsedSearchLines, {
        methods: filters.methodFilterSet,
        statuses: filters.statusFilterSet,
        paths: filters.pathFilterSet,
        level: levelFilter,
      }),
    [
      parsedSearchLines,
      filters.methodFilterSet,
      filters.statusFilterSet,
      filters.pathFilterSet,
      levelFilter,
    ]
  );
  const removedCount = logBuffer.buffer.length - filteredParsedLines.length;
  const filteredLines = useMemo(
    () => filteredParsedLines.map((line) => line.raw),
    [filteredParsedLines]
  );
  const logState = useMemo<LogState>(
    () => ({
      buffer: filteredLines,
      visibleFrom: Math.max(0, filteredLines.length - visibleCount),
    }),
    [filteredLines, visibleCount]
  );
  const setLogState: Dispatch<SetStateAction<LogState>> = (update) => {
    const next = typeof update === 'function' ? update(logState) : update;
    setVisibleCount(next.buffer.length - next.visibleFrom);
  };
  useEffect(() => {
    setVisibleCount(INITIAL_DISPLAY_LINES);
  }, [
    setVisibleCount,
    trimmedSearchQuery,
    hideManagementLogs,
    levelFilter,
    filters.methodFilterSet,
    filters.statusFilterSet,
    filters.pathFilterSet,
  ]);
  const parsedVisibleLines = filteredParsedLines.slice(logState.visibleFrom);

  const {
    canLoadMore,
    handleLogScroll,
    logViewerRef,
    requestScrollToBottom,
    isFollowing,
    resumeFollowing,
    pendingLines,
    historyEvicted,
  } = useLogScroller({
    logState,
    setLogState,
    bufferStart: logBuffer.bufferStart,
    loading,
    isSearching,
    filteredLineCount: filteredLines.length,
    hasStructuredFilters: filters.hasStructuredFilters,
    showRawLogs,
    wrapLogs,
  });

  const copyLogLine = async (raw: string) => {
    const ok = await copyToClipboard(raw);
    if (ok) {
      showNotification(t('logs.copy_success', { defaultValue: 'Copied to clipboard' }), 'success');
    } else {
      showNotification(t('logs.copy_failed', { defaultValue: 'Copy failed' }), 'error');
    }
  };

  const downloadRequestLog = async (id: string) => {
    const session = requests.session.capture();
    setRequestLogDownloading(true);
    try {
      const response = await logsApi.downloadRequestLogById(id);
      if (!requests.session.isCurrent(session)) return;
      downloadBlob({
        filename: `request-${id}.log`,
        blob: new Blob([response.data], { type: 'text/plain' }),
      });
      showNotification(t('logs.request_log_download_success'), 'success');
    } catch (err: unknown) {
      if (!requests.session.isCurrent(session)) return;
      const message = getErrorMessage(err);
      showNotification(
        `${t('notification.download_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    } finally {
      if (requests.session.isCurrent(session)) setRequestLogDownloading(false);
    }
  };

  useEffect(() => {
    if (!fullscreenLogs) return;

    document.body.classList.add('logs-fullscreen-active');
    lockScroll();

    const handleEscape = (event: KeyboardEvent) => {
      if (!shouldExitLogFullscreen(event, !!document.querySelector('.modal-overlay'))) return;
      setFullscreenLogs(false);
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.classList.remove('logs-fullscreen-active');
      unlockScroll();
    };
  }, [fullscreenLogs]);

  const readStatusKey =
    catchingUp && autoRefresh
      ? 'logs.read_status_catching_up'
      : autoRefresh
        ? 'logs.read_status_live'
        : 'logs.read_status_paused';
  const highlightNeedle = isSearching ? trimmedSearchQuery : '';
  const highlight = (text: string) =>
    highlightNeedle
      ? splitHighlight(text, highlightNeedle).map((segment, index) =>
          segment.match ? (
            <mark key={index} className={styles.match}>
              {segment.text}
            </mark>
          ) : (
            segment.text
          )
        )
      : text;

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <div className={styles.headerCopy}>
          <h1 className={styles.pageTitle}>{t('logs.title')}</h1>
          {activeTab === 'logs' && (
            <p className={styles.meta}>
              <span>{t('logs.loaded_lines', { count: logBuffer.buffer.length })}</span>
              <span className={styles.metaSep} aria-hidden="true" />
              <span
                className={styles.readStatus}
                role="status"
                data-live={autoRefresh && !disableControls}
              >
                <span className={styles.statusDot} aria-hidden="true" />
                {t(readStatusKey)}
              </span>
            </p>
          )}
        </div>
        <div className={styles.tabBar} role="group" aria-label={t('logs.title')}>
          <button
            type="button"
            className={`${styles.tabItem} ${activeTab === 'logs' ? styles.tabActive : ''}`}
            aria-pressed={activeTab === 'logs'}
            onClick={() => setActiveTab('logs')}
          >
            {t('logs.log_content')}
          </button>
          <button
            type="button"
            className={`${styles.tabItem} ${activeTab === 'errors' ? styles.tabActive : ''}`}
            aria-pressed={activeTab === 'errors'}
            onClick={() => {
              setFullscreenLogs(false);
              setActiveTab('errors');
            }}
          >
            {t('logs.error_logs_modal_title')}
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {activeTab === 'logs' && (
          <section
            className={[styles.logCard, fullscreenLogs ? styles.logCardFullscreen : '']
              .filter(Boolean)
              .join(' ')}
            aria-label={t('logs.title')}
          >
            {showFileLoggingRequired && (
              <div className="status-badge warning">
                {t(
                  cpaNeedsFileLogging
                    ? 'logs.cpa_file_logging_required'
                    : 'logs.file_logging_required'
                )}
              </div>
            )}
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}

            <div className={styles.filters}>
              <div className={styles.searchWrapper}>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('logs.search_placeholder')}
                  aria-label={t('logs.search_placeholder')}
                  className={styles.searchInput}
                  rightElement={
                    searchQuery ? (
                      <button
                        type="button"
                        className={styles.searchClear}
                        onClick={() => setSearchQuery('')}
                        title={t('logs.clear_search')}
                        aria-label={t('logs.clear_search')}
                      >
                        <IconX size={14} />
                      </button>
                    ) : (
                      <IconSearch size={14} className={styles.searchIcon} />
                    )
                  }
                />
              </div>

              <Select
                className={styles.levelSelect}
                fullWidth={false}
                value={levelFilter}
                onChange={setLevelFilter}
                ariaLabel={t('logs.level_filter')}
                options={[
                  { value: '', label: t('logs.all_levels') },
                  ...['trace', 'debug', 'info', 'warn', 'error', 'fatal'].map((level) => ({
                    value: level,
                    label: `${level.charAt(0).toUpperCase()}${level.slice(1)}`,
                  })),
                ]}
              />
              <div className={styles.filterPanelHeader}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={styles.filterPanelToggle}
                  onClick={() => setStructuredFiltersExpanded((prev) => !prev)}
                  aria-haspopup="dialog"
                  aria-label={t('logs.filter_panel_title')}
                  title={t('logs.filter_panel_title')}
                >
                  <span className={styles.filterPanelButtonContent}>
                    <IconSlidersHorizontal size={14} />
                    <span className={styles.filterPanelLabel}>{t('logs.filter_panel_title')}</span>
                    {structuredFilterCount > 0 && (
                      <span className={styles.filterPanelCount}>
                        {t('logs.filter_panel_active_count', { count: structuredFilterCount })}
                      </span>
                    )}
                  </span>
                </Button>
              </div>

              <div className={styles.switches}>
                <ToggleSwitch
                  checked={autoRefresh}
                  onChange={setAutoRefresh}
                  disabled={autoRefreshDisabled}
                  label={t('logs.auto_refresh')}
                />
                <ToggleSwitch
                  checked={hideManagementLogs}
                  onChange={setHideManagementLogs}
                  label={t('logs.hide_management_logs', { prefix: MANAGEMENT_API_PREFIX })}
                />
              </div>

              <Modal
                open={structuredFiltersExpanded}
                onClose={() => setStructuredFiltersExpanded(false)}
                title={t('logs.filter_panel_title')}
                width={640}
                footer={
                  <Button variant="secondary" onClick={() => setStructuredFiltersExpanded(false)}>
                    {t('common.close')}
                  </Button>
                }
              >
                <div id={structuredFiltersPanelId} className={styles.structuredFilters}>
                  <div className={styles.filterChipGroup}>
                    <span className={styles.filterChipLabel}>{t('logs.filter_method')}</span>
                    <div className={styles.filterChipList}>
                      {HTTP_METHODS.map((method) => {
                        const active = filters.methodFilters.includes(method);
                        const count = filters.methodCounts[method] ?? 0;
                        return (
                          <button
                            key={method}
                            type="button"
                            className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                            onClick={() => filters.toggleMethodFilter(method)}
                            disabled={count === 0 && !active}
                            aria-pressed={active}
                          >
                            {method}
                            <span className={styles.filterChipCount}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.filterChipGroup}>
                    <span className={styles.filterChipLabel}>{t('logs.filter_status')}</span>
                    <div className={styles.filterChipList}>
                      {STATUS_GROUPS.map((statusGroup) => {
                        const active = filters.statusFilters.includes(statusGroup);
                        const count = filters.statusCounts[statusGroup] ?? 0;
                        return (
                          <button
                            key={statusGroup}
                            type="button"
                            className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                            onClick={() => filters.toggleStatusFilter(statusGroup)}
                            disabled={count === 0 && !active}
                            aria-pressed={active}
                          >
                            {t(`logs.filter_status_${statusGroup}`)}
                            <span className={styles.filterChipCount}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.filterChipGroup}>
                    <span className={styles.filterChipLabel}>{t('logs.filter_path')}</span>
                    <div className={styles.filterChipList}>
                      {filters.pathOptions.length === 0 ? (
                        <span className={styles.filterChipHint}>{t('logs.filter_path_empty')}</span>
                      ) : (
                        filters.pathOptions.map(({ path, count }) => {
                          const active = filters.pathFilters.includes(path);
                          return (
                            <button
                              key={path}
                              type="button"
                              className={`${styles.filterChip} ${styles.filterChipMono} ${active ? styles.filterChipActive : ''}`}
                              onClick={() => filters.togglePathFilter(path)}
                              aria-pressed={active}
                              title={path}
                            >
                              {path}
                              <span className={styles.filterChipCount}>{count}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={filters.clearStructuredFilters}
                      disabled={!filters.hasStructuredFilters}
                    >
                      {t('logs.clear_filters')}
                    </Button>
                  </div>
                </div>

                <div className={styles.displayOptions}>
                  <ToggleSwitch
                    checked={wrapLogs}
                    onChange={setWrapLogs}
                    label={t('logs.wrap_lines')}
                  />
                  <ToggleSwitch
                    checked={showRawLogs}
                    onChange={setShowRawLogs}
                    label={
                      <span
                        title={t('logs.show_raw_logs_hint', {
                          defaultValue: 'Show original log text for easier multi-line copy',
                        })}
                      >
                        {t('logs.show_raw_logs', { defaultValue: 'Show raw logs' })}
                      </span>
                    }
                  />
                </div>
              </Modal>

              <div className={styles.toolbar}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadLogs(false)}
                  disabled={refreshDisabled}
                  className={styles.actionButton}
                  title={t('logs.refresh_button')}
                  aria-label={t('logs.refresh_button')}
                >
                  <IconRefreshCw size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadLogs}
                  disabled={logBuffer.buffer.length === 0}
                  className={styles.actionButton}
                  title={t('logs.download_cached')}
                  aria-label={t('logs.download_cached')}
                >
                  <IconDownload size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearLogs}
                  disabled={clearDisabled}
                  className={styles.actionButton}
                  title={t('logs.clear_button')}
                  aria-label={t('logs.clear_button')}
                >
                  <IconTrash2 size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFullscreenLogs((prev) => !prev)}
                  className={styles.actionButton}
                  aria-pressed={fullscreenLogs}
                  aria-label={
                    fullscreenLogs ? t('logs.exit_fullscreen_button') : t('logs.fullscreen_button')
                  }
                  title={
                    fullscreenLogs ? t('logs.exit_fullscreen_button') : t('logs.fullscreen_button')
                  }
                >
                  <span className={styles.buttonContent}>
                    {fullscreenLogs ? <IconMinimize2 size={16} /> : <IconMaximize2 size={16} />}
                  </span>
                </Button>
              </div>
            </div>

            <div className={styles.notices}>
              {wasReset && (
                <div className={styles.notice} role="status">
                  {t('logs.cursor_reset_notice')}
                </div>
              )}
              {historyEvicted && (
                <div className={styles.notice} role="status">
                  {t('logs.history_evicted')}
                </div>
              )}
            </div>

            <div className={styles.viewerArea}>
              {loading && logBuffer.buffer.length === 0 ? (
                <div className={styles.viewerHint}>{t('logs.loading')}</div>
              ) : logBuffer.buffer.length > 0 && filteredLines.length > 0 ? (
                <div
                  ref={logViewerRef}
                  className={[
                    styles.logPanel,
                    wrapLogs ? styles.wrapped : '',
                    fullscreenLogs ? styles.logPanelFullscreen : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onScroll={handleLogScroll}
                  tabIndex={0}
                  role="region"
                  aria-label={t('logs.log_content')}
                  aria-busy={loading}
                >
                  {canLoadMore && (
                    <div className={styles.loadMoreBanner}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setVisibleCount((count) => Math.min(filteredLines.length, count + 200))
                        }
                      >
                        {t('logs.filter_load_more')}
                      </Button>
                      <div className={styles.loadMoreStats}>
                        <span>{t('logs.loaded_lines', { count: parsedVisibleLines.length })}</span>
                        {removedCount > 0 && (
                          <span>{t('logs.filtered_lines', { count: removedCount })}</span>
                        )}
                        <span>{t('logs.hidden_lines', { count: logState.visibleFrom })}</span>
                      </div>
                    </div>
                  )}
                  {showRawLogs ? (
                    <pre className={styles.rawLog} spellCheck={false}>
                      {parsedVisibleLines.map((line) => (
                        <span key={line.id} data-log-id={line.id} className={styles.rawLine}>
                          {line.raw ? highlight(line.raw) : ' '}
                        </span>
                      ))}
                    </pre>
                  ) : (
                    <div className={styles.logList}>
                      {parsedVisibleLines.map((line) => {
                        const levelTone =
                          line.level === 'error' || line.level === 'fatal'
                            ? 'error'
                            : line.level === 'warn'
                              ? 'warn'
                              : line.level === 'info'
                                ? 'info'
                                : 'quiet';
                        const statusTone =
                          typeof line.statusCode !== 'number'
                            ? undefined
                            : line.statusCode >= 500
                              ? 'error'
                              : line.statusCode >= 400
                                ? 'warn'
                                : 'ok';
                        return (
                          <div
                            key={line.id}
                            data-log-id={line.id}
                            className={styles.logRow}
                            onDoubleClick={() => {
                              void copyLogLine(line.raw);
                            }}
                            title={t('logs.double_click_copy_hint', {
                              defaultValue: 'Double-click to copy',
                            })}
                          >
                            <div className={styles.timestamp}>{line.timestamp || ''}</div>
                            <div className={styles.rowMain}>
                              {line.level && (
                                <span className={styles.level} data-tone={levelTone}>
                                  <span className={styles.levelDot} aria-hidden="true" />
                                  {line.level}
                                </span>
                              )}

                              {line.source && (
                                <span className={styles.source} title={line.source}>
                                  {highlight(line.source)}
                                </span>
                              )}

                              {line.requestId && (
                                <button
                                  type="button"
                                  className={styles.requestId}
                                  title={t('logs.view_request', { id: line.requestId })}
                                  aria-label={t('logs.view_request', { id: line.requestId })}
                                  onClick={() =>
                                    void openErrorLog(
                                      { name: `request-${line.requestId}.log` },
                                      line.requestId
                                    )
                                  }
                                >
                                  {line.requestId}
                                </button>
                              )}

                              {typeof line.statusCode === 'number' && (
                                <span className={styles.statusCode} data-tone={statusTone}>
                                  {line.statusCode}
                                </span>
                              )}

                              {line.latency && <span className={styles.pill}>{line.latency}</span>}
                              {line.ip && <span className={styles.pill}>{line.ip}</span>}

                              {line.method && <span className={styles.method}>{line.method}</span>}

                              {line.path && (
                                <span className={styles.path} title={line.path}>
                                  {highlight(line.path)}
                                </span>
                              )}

                              {line.message && (
                                <span className={styles.message}>{highlight(line.message)}</span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className={styles.copyButton}
                                title={t('logs.copy_line')}
                                onClick={() => void copyLogLine(line.raw)}
                                aria-label={t('logs.copy_line')}
                              >
                                <IconCopy size={14} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : logBuffer.buffer.length > 0 ? (
                <EmptyState
                  title={t('logs.search_empty_title')}
                  description={t('logs.search_empty_desc')}
                />
              ) : showFileLoggingRequired ? (
                <EmptyState
                  title={t(
                    cpaNeedsFileLogging
                      ? 'logs.cpa_file_logging_required_title'
                      : 'logs.file_logging_required_title'
                  )}
                  description={t(
                    cpaNeedsFileLogging
                      ? 'logs.cpa_file_logging_required_desc'
                      : 'logs.file_logging_required_desc'
                  )}
                />
              ) : (
                <EmptyState title={t('logs.empty_title')} />
              )}

              {!isFollowing && (
                <button type="button" className={styles.followPill} onClick={resumeFollowing}>
                  {t('logs.resume_following', { count: pendingLines })}
                </button>
              )}
            </div>

            <footer className={styles.statusBar}>
              <span className={styles.bufferStatus}>
                {t('logs.buffer_scope', {
                  count: logBuffer.buffer.length,
                  matched: filteredLines.length,
                })}
              </span>
              {lastUpdated && (
                <span>
                  {t('logs.last_updated', { time: new Date(lastUpdated).toLocaleTimeString() })}
                </span>
              )}
            </footer>
          </section>
        )}

        {activeTab === 'errors' && (
          <Card
            className={styles.errorCard}
            title={t('logs.error_logs_modal_title')}
            extra={
              <Button
                variant="secondary"
                size="sm"
                onClick={loadErrorLogs}
                loading={loadingErrors}
                disabled={disableControls}
              >
                {t('common.refresh')}
              </Button>
            }
          >
            <div className={styles.errorBody}>
              <p className={styles.errorDescription}>{t('logs.error_logs_description')}</p>

              {requestLogEnabled && (
                <div>
                  <div className="status-badge warning">
                    {t('logs.error_logs_request_log_enabled')}
                  </div>
                </div>
              )}

              {errorLogsError && <div className="error-box">{errorLogsError}</div>}

              <div className={styles.errorPanel}>
                {loadingErrors ? (
                  <div className={styles.viewerHint}>{t('common.loading')}</div>
                ) : errorLogs.length === 0 ? (
                  <div className={styles.viewerHint}>{t('logs.error_logs_empty')}</div>
                ) : (
                  <ul className={styles.errorList}>
                    {errorLogs.map((item) => (
                      <li key={item.name} className={styles.errorRow}>
                        <div className={styles.errorMeta}>
                          <span className={styles.errorName}>{item.name}</span>
                          <span className={styles.errorSub}>
                            {item.size ? (
                              <span>{`${(item.size / 1024).toFixed(1)} KB`}</span>
                            ) : null}
                            {item.modified ? (
                              <span>{formatUnixTimestamp(item.modified)}</span>
                            ) : null}
                          </span>
                        </div>
                        <div className={styles.errorActions}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              void openErrorLog(item);
                            }}
                            disabled={disableControls}
                          >
                            <span className={styles.buttonContent}>
                              <IconEye size={14} />
                              {t('logs.error_logs_open')}
                            </span>
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => downloadErrorLog(item.name)}
                            disabled={disableControls}
                          >
                            {t('logs.error_logs_download')}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={errorLogViewer.status !== 'closed'}
        onClose={closeErrorLogViewer}
        title={selectedErrorLog?.name ?? t('logs.error_log_view_title')}
        width={960}
        footer={
          <>
            <Button variant="secondary" onClick={closeErrorLogViewer}>
              {t('common.close')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void copySelectedErrorLog();
              }}
              disabled={errorLogViewer.status !== 'ready' || !errorLogViewer.text}
            >
              {t('common.copy')}
            </Button>
            <Button
              onClick={() => {
                if (viewerRequestId) void downloadRequestLog(viewerRequestId);
                else if (selectedErrorLog) void downloadErrorLog(selectedErrorLog.name);
              }}
              loading={requestLogDownloading}
              disabled={errorLogViewer.status === 'closed' || errorLogViewer.status === 'loading'}
            >
              {t('logs.error_logs_download')}
            </Button>
          </>
        }
      >
        <div className={styles.errorLogViewer}>
          {selectedErrorLog && (
            <div className={styles.errorLogViewerMeta}>
              <span>
                {t('logs.error_logs_size')}:{' '}
                {selectedErrorLog.size ? `${(selectedErrorLog.size / 1024).toFixed(1)} KB` : '-'}
              </span>
              <span>
                {t('logs.error_logs_modified')}:{' '}
                {selectedErrorLog.modified ? formatUnixTimestamp(selectedErrorLog.modified) : '-'}
              </span>
            </div>
          )}
          {errorLogViewer.status === 'error' && (
            <div className="error-box">{errorLogViewer.message}</div>
          )}
          {errorLogViewer.status === 'loading' && <div className="hint">{t('common.loading')}</div>}
          {errorLogViewer.status === 'ready' &&
            (errorLogViewer.text ? (
              <pre className={styles.errorLogContent} spellCheck={false}>
                {errorLogViewer.text}
              </pre>
            ) : (
              <div className="hint">{t('logs.error_log_empty_content')}</div>
            ))}
        </div>
      </Modal>
    </div>
  );
}
