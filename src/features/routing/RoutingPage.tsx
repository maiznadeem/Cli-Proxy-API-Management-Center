/**
 * Routing: which account served which thread, read from the proxy's application log.
 *
 * Events live in useRoutingStore so the page survives navigation; useRoutingPoll owns the
 * 5 s read loop and its stale-request guards. Parsing and grouping are pure functions in
 * model/parseRoutingLines.
 */

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconSearch, IconTrash2, IconX } from '@/components/ui/icons';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useNow } from '@/hooks/useNow';
import { logsApi } from '@/services/api/logs';
import { useNotificationStore, useThemeStore } from '@/stores';
import { useRoutingStore } from '@/stores/useRoutingStore';
import { downloadBlob } from '@/utils/download';
import { getErrorMessage } from '@/utils/helpers';
import { RoutingAccounts } from './components/RoutingAccounts';
import { RoutingThreadRow } from './components/RoutingThreadRow';
import { useRoutingPoll } from './hooks/useRoutingPoll';
import {
  accountLabel,
  buildAccounts,
  buildThreads,
  filterThreads,
} from './model/parseRoutingLines';
import styles from './RoutingPage.module.scss';

const SKELETON_ROWS = 5;

export function RoutingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const now = useNow();
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const showNotification = useNotificationStore((state) => state.showNotification);
  const events = useRoutingStore((state) => state.log.events);
  const loaded = useRoutingStore((state) => state.loaded);
  const lastUpdated = useRoutingStore((state) => state.lastUpdated);
  const live = useRoutingStore((state) => state.live);
  const setLive = useRoutingStore((state) => state.setLive);
  const clearEvents = useRoutingStore((state) => state.clearEvents);
  const { loading, error, fileLoggingDisabled, connected } = useRoutingPoll();

  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const threads = useMemo(() => buildThreads(events), [events]);
  const accounts = useMemo(() => buildAccounts(events, threads, now), [events, threads, now]);
  // A filter on an account that left the ring behaves like "all".
  const effectiveAccountFilter = accounts.some((account) => account.auth === accountFilter)
    ? accountFilter
    : '';
  const visibleThreads = useMemo(
    () => filterThreads(threads, search, effectiveAccountFilter),
    [threads, search, effectiveAccountFilter]
  );
  const switchedCount = useMemo(
    () => threads.filter((thread) => thread.switched).length,
    [threads]
  );

  const accountOptions = useMemo(
    () => [
      { value: '', label: t('routing.account_filter_all') },
      ...accounts.map((account) => ({ value: account.auth, label: accountLabel(account.auth) })),
    ],
    [accounts, t]
  );

  const toggleThread = (session: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(session)) next.delete(session);
      else next.add(session);
      return next;
    });

  const downloadRequestLog = async (id: string) => {
    const generation = useRoutingStore.getState().generation;
    setDownloadingId(id);
    try {
      const response = await logsApi.downloadRequestLogById(id);
      if (generation !== useRoutingStore.getState().generation) return;
      downloadBlob({
        filename: `request-${id}.log`,
        blob: new Blob([response.data], { type: 'text/plain' }),
      });
      showNotification(t('logs.request_log_download_success'), 'success');
    } catch (err: unknown) {
      if (generation !== useRoutingStore.getState().generation) return;
      const message = getErrorMessage(err);
      showNotification(
        `${t('notification.download_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const updatedLabel = lastUpdated
    ? t('routing.summary_updated', {
        time: new Date(lastUpdated).toLocaleTimeString(i18n.resolvedLanguage, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })
    : t('routing.summary_waiting');

  const renderBody = () => {
    if (!connected) {
      return <p className={styles.notice}>{t('routing.disconnected')}</p>;
    }
    if (fileLoggingDisabled) {
      return (
        <div className={styles.notice}>
          <p className={styles.noticeText}>{t('routing.logging_disabled')}</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/config')}>
            {t('routing.open_settings')}
          </Button>
        </div>
      );
    }
    if (loading && !loaded) {
      return (
        <div className={styles.skeletons} aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height={64} rounded={10} />
          ))}
        </div>
      );
    }
    if (threads.length === 0) {
      return <EmptyState title={t('routing.empty_title')} description={t('routing.empty_desc')} />;
    }
    if (visibleThreads.length === 0) {
      return (
        <EmptyState
          title={t('routing.filtered_empty_title')}
          description={t('routing.filtered_empty_desc')}
        />
      );
    }
    return (
      <ul className={styles.threads} aria-label={t('routing.threads_label')}>
        {visibleThreads.map((thread) => (
          <RoutingThreadRow
            key={thread.session}
            thread={thread}
            expanded={expanded.has(thread.session)}
            onToggle={toggleThread}
            now={now}
            locale={i18n.resolvedLanguage}
            downloadingId={downloadingId}
            onDownload={(id) => void downloadRequestLog(id)}
          />
        ))}
      </ul>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.copy}>
          <h1 className={styles.title}>{t('routing.title')}</h1>
          <p className={styles.meta}>
            <span className={styles.metaStrong}>
              {t('routing.summary_threads', { count: threads.length })}
            </span>
            <span className={styles.metaSep} aria-hidden="true" />
            <span>{t('routing.summary_requests', { count: events.length })}</span>
            {switchedCount > 0 && (
              <>
                <span className={styles.metaSep} aria-hidden="true" />
                <span className={styles.metaWatch}>
                  {t('routing.summary_switched', { count: switchedCount })}
                </span>
              </>
            )}
            <span className={styles.metaSep} aria-hidden="true" />
            <span className={styles.metaMuted}>{updatedLabel}</span>
          </p>
        </div>
        <div className={styles.actions}>
          <span title={t('routing.live_label')}>
            <ToggleSwitch
              checked={live}
              onChange={setLive}
              label={t('routing.live')}
              ariaLabel={t('routing.live_label')}
              disabled={!connected}
            />
          </span>
          <Button
            variant="ghost"
            size="md"
            className={styles.iconButton}
            onClick={() => {
              clearEvents();
              setExpanded(new Set());
            }}
            disabled={events.length === 0}
            aria-label={t('routing.clear')}
            title={t('routing.clear')}
          >
            <IconTrash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {t('routing.load_error', { message: error })}
        </div>
      )}

      <RoutingAccounts accounts={accounts} resolvedTheme={resolvedTheme} />

      <section className={styles.workbench}>
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <IconSearch size={14} aria-hidden="true" className={styles.searchIcon} />
            <input
              ref={searchInputRef}
              className={styles.searchInput}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('routing.search_placeholder')}
              aria-label={t('routing.search_label')}
            />
            {search && (
              <button
                type="button"
                className={styles.clearSearch}
                aria-label={t('routing.search_clear')}
                title={t('routing.search_clear')}
                onClick={() => {
                  setSearch('');
                  searchInputRef.current?.focus();
                }}
              >
                <IconX size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className={styles.accountFilter}>
            <Select
              value={effectiveAccountFilter}
              options={accountOptions}
              onChange={setAccountFilter}
              ariaLabel={t('routing.account_filter_label')}
              size="sm"
            />
          </div>
          {visibleThreads.length !== threads.length && (
            <span className={styles.filterCount}>
              {visibleThreads.length} / {threads.length}
            </span>
          )}
        </div>
        {renderBody()}
      </section>
    </div>
  );
}
