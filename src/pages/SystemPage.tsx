import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { IconExternalLink } from '@/components/ui/icons';
import { useAuthStore, useConfigStore, useNotificationStore, useModelsStore } from '@/stores';
import { configApi, versionApi } from '@/services/api';
import { useApiKeysForModels } from '@/hooks/useApiKeysForModels';
import { formatDateTimeValue } from '@/utils/format';
import { classifyModels } from '@/utils/models';
import { STORAGE_KEY_AUTH } from '@/utils/constants';
import styles from './SystemPage.module.scss';

type StatusTone = 'success' | 'warning' | 'error' | 'muted';

const QUICK_LINKS = [
  {
    href: 'https://github.com/router-for-me/CLIProxyAPI',
    titleKey: 'system_info.link_main_repo',
    descKey: 'system_info.link_main_repo_desc',
  },
  {
    href: 'https://github.com/router-for-me/Cli-Proxy-API-Management-Center',
    titleKey: 'system_info.link_webui_repo',
    descKey: 'system_info.link_webui_repo_desc',
  },
  {
    href: 'https://help.router-for.me/',
    titleKey: 'system_info.link_docs',
    descKey: 'system_info.link_docs_desc',
  },
] as const;

// Labels borrowed from other namespaces may carry a trailing colon for inline use.
const stripTrailingColon = (label: string) => label.replace(/\s*[:：]\s*$/, '');

const parseVersionSegments = (version?: string | null) => {
  if (!version) return null;
  const cleaned = version.trim().replace(/^v/i, '');
  if (!cleaned) return null;
  const parts = cleaned
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((segment) => Number.parseInt(segment, 10))
    .filter(Number.isFinite);
  return parts.length ? parts : null;
};

const compareVersions = (latest?: string | null, current?: string | null) => {
  const latestParts = parseVersionSegments(latest);
  const currentParts = parseVersionSegments(current);
  if (!latestParts || !currentParts) return null;
  const length = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < length; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return 1;
    if (l < c) return -1;
  }
  return 0;
};

export function SystemPage() {
  const { t, i18n } = useTranslation();
  const { showNotification, showConfirmation } = useNotificationStore();
  const auth = useAuthStore();
  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const clearCache = useConfigStore((state) => state.clearCache);
  const updateConfigValue = useConfigStore((state) => state.updateConfigValue);

  const models = useModelsStore((state) => state.models);
  const modelsLoading = useModelsStore((state) => state.loading);
  const modelsError = useModelsStore((state) => state.error);
  const fetchModelsFromStore = useModelsStore((state) => state.fetchModels);

  const [modelStatus, setModelStatus] = useState<{
    type: StatusTone;
    message: string;
  }>();
  const [updateStatus, setUpdateStatus] = useState<{
    type: StatusTone;
    message: string;
  }>();
  const [requestLogModalOpen, setRequestLogModalOpen] = useState(false);
  const [requestLogDraft, setRequestLogDraft] = useState(false);
  const [requestLogTouched, setRequestLogTouched] = useState(false);
  const [requestLogSaving, setRequestLogSaving] = useState(false);
  const [checkingVersion, setCheckingVersion] = useState(false);

  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingId = useId();

  const otherLabel = useMemo(
    () => (i18n.language?.toLowerCase().startsWith('zh') ? '其他' : 'Other'),
    [i18n.language]
  );
  const groupedModels = useMemo(() => classifyModels(models, { otherLabel }), [models, otherLabel]);
  const requestLogEnabled = config?.requestLog ?? false;
  const requestLogDirty = requestLogDraft !== requestLogEnabled;
  const canEditRequestLog = auth.connectionStatus === 'connected' && Boolean(config);

  const appVersion = __APP_VERSION__ || t('system_info.version_unknown');
  const apiVersion = auth.serverVersion || t('system_info.version_unknown');
  const buildTime =
    formatDateTimeValue(auth.serverBuildDate, i18n.language) || t('system_info.version_unknown');

  const resolveApiKeysForModels = useApiKeysForModels();

  const fetchModels = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
    if (auth.connectionStatus !== 'connected') {
      setModelStatus({
        type: 'warning',
        message: t('notification.connection_required'),
      });
      return;
    }

    if (!auth.apiBase) {
      showNotification(t('notification.connection_required'), 'warning');
      return;
    }

    setModelStatus({ type: 'muted', message: t('system_info.models_loading') });
    try {
      const apiKeys = await resolveApiKeysForModels({ force: forceRefresh });
      const primaryKey = apiKeys[0];
      const list = await fetchModelsFromStore(auth.apiBase, primaryKey, forceRefresh);
      const hasModels = list.length > 0;
      setModelStatus({
        type: hasModels ? 'success' : 'warning',
        message: hasModels
          ? t('system_info.models_count', { count: list.length })
          : t('system_info.models_empty'),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
      const suffix = message ? `: ${message}` : '';
      const text = `${t('system_info.models_error')}${suffix}`;
      setModelStatus({ type: 'error', message: text });
    }
  };

  const handleClearLoginStorage = () => {
    showConfirmation({
      title: t('system_info.clear_login_title', { defaultValue: 'Clear Login Storage' }),
      message: t('system_info.clear_login_confirm'),
      variant: 'danger',
      confirmText: t('common.confirm'),
      onConfirm: () => {
        auth.logout();
        if (typeof localStorage === 'undefined') return;
        const keysToRemove = [STORAGE_KEY_AUTH, 'isLoggedIn', 'apiBase', 'apiUrl', 'managementKey'];
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        showNotification(t('notification.login_storage_cleared'), 'success');
      },
    });
  };

  const openRequestLogModal = useCallback(() => {
    setRequestLogTouched(false);
    setRequestLogDraft(requestLogEnabled);
    setRequestLogModalOpen(true);
  }, [requestLogEnabled]);

  const handleInfoVersionTap = useCallback(() => {
    versionTapCount.current += 1;
    if (versionTapTimer.current) {
      clearTimeout(versionTapTimer.current);
    }

    if (versionTapCount.current >= 7) {
      versionTapCount.current = 0;
      versionTapTimer.current = null;
      openRequestLogModal();
      return;
    }

    versionTapTimer.current = setTimeout(() => {
      versionTapCount.current = 0;
      versionTapTimer.current = null;
    }, 1500);
  }, [openRequestLogModal]);

  const handleRequestLogClose = useCallback(() => {
    setRequestLogModalOpen(false);
    setRequestLogTouched(false);
  }, []);

  const handleRequestLogSave = async () => {
    if (!canEditRequestLog) return;
    if (!requestLogDirty) {
      setRequestLogModalOpen(false);
      return;
    }

    const previous = requestLogEnabled;
    setRequestLogSaving(true);
    updateConfigValue('request-log', requestLogDraft);

    try {
      await configApi.updateRequestLog(requestLogDraft);
      clearCache('request-log');
      showNotification(t('notification.request_log_updated'), 'success');
      setRequestLogModalOpen(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      updateConfigValue('request-log', previous);
      showNotification(
        `${t('notification.update_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    } finally {
      setRequestLogSaving(false);
    }
  };

  const handleVersionCheck = useCallback(async () => {
    // Result shows inline next to the button and as a toast, as before.
    const report = (type: 'success' | 'warning' | 'error', message: string) => {
      setUpdateStatus({ type, message });
      showNotification(message, type);
    };
    setCheckingVersion(true);
    try {
      const data = await versionApi.checkLatest();
      const latestRaw = data?.['latest-version'] ?? data?.latest_version ?? data?.latest ?? '';
      const latest = typeof latestRaw === 'string' ? latestRaw : String(latestRaw ?? '');
      const comparison = compareVersions(latest, auth.serverVersion);

      if (!latest) {
        report('error', t('system_info.version_check_error'));
        return;
      }

      if (comparison === null) {
        report('warning', t('system_info.version_current_missing'));
        return;
      }

      if (comparison > 0) {
        report('warning', t('system_info.version_update_available', { version: latest }));
      } else {
        report('success', t('system_info.version_is_latest'));
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      const suffix = message ? `: ${message}` : '';
      report('error', `${t('system_info.version_check_error')}${suffix}`);
    } finally {
      setCheckingVersion(false);
    }
  }, [auth.serverVersion, showNotification, t]);

  useEffect(() => {
    fetchConfig().catch(() => {
      // ignore
    });
  }, [fetchConfig]);

  useEffect(() => {
    if (requestLogModalOpen && !requestLogTouched) {
      setRequestLogDraft(requestLogEnabled);
    }
  }, [requestLogModalOpen, requestLogTouched, requestLogEnabled]);

  useEffect(() => {
    return () => {
      if (versionTapTimer.current) {
        clearTimeout(versionTapTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.connectionStatus, auth.apiBase]);

  const sectionId = (name: string) => `${headingId}-${name}`;
  const connectionTone: StatusTone =
    auth.connectionStatus === 'connected'
      ? 'success'
      : auth.connectionStatus === 'error'
        ? 'error'
        : 'muted';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>{t('system_info.title')}</h1>
        <p className={styles.meta}>{t('system_info.about_title')}</p>
      </header>

      <div className={styles.content}>
        <section className={styles.panel} aria-labelledby={sectionId('versions')}>
          <h2 id={sectionId('versions')} className={styles.panelTitle}>
            {t('system_info.versions_title')}
          </h2>
          <dl className={styles.definitions}>
            <div className={styles.definitionRow}>
              <dt>{t('footer.version')}</dt>
              <dd>
                <button type="button" className={styles.versionTap} onClick={handleInfoVersionTap}>
                  {appVersion}
                </button>
              </dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>{t('footer.api_version')}</dt>
              <dd className={styles.mono}>{apiVersion}</dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>{t('footer.build_date')}</dt>
              <dd className={styles.numeric}>{buildTime}</dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>{stripTrailingColon(t('connection.status'))}</dt>
              <dd>
                <span className={styles.status} data-tone={connectionTone}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  {t(`common.${auth.connectionStatus}_status`)}
                </span>
                <span className={`${styles.mono} ${styles.subValue}`}>{auth.apiBase || '-'}</span>
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.panel} aria-labelledby={sectionId('updates')}>
          <h2 id={sectionId('updates')} className={styles.panelTitle}>
            {t('system_info.updates_title')}
          </h2>
          <div className={styles.updateRow}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleVersionCheck()}
              loading={checkingVersion}
            >
              {t('system_info.version_check_button')}
            </Button>
            {updateStatus && (
              <span className={styles.status} data-tone={updateStatus.type} role="status">
                <span className={styles.statusDot} aria-hidden="true" />
                {updateStatus.message}
              </span>
            )}
          </div>
        </section>

        <section
          className={`${styles.panel} ${styles.panelWide}`}
          aria-labelledby={sectionId('models')}
        >
          <div className={styles.panelHeader}>
            <h2 id={sectionId('models')} className={styles.panelTitle}>
              {t('system_info.models_title')}
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchModels({ forceRefresh: true })}
              loading={modelsLoading}
            >
              {t('common.refresh')}
            </Button>
          </div>
          <p className={styles.description}>{t('system_info.models_desc')}</p>
          {modelStatus && (
            <span className={styles.status} data-tone={modelStatus.type} role="status">
              <span className={styles.statusDot} aria-hidden="true" />
              {modelStatus.message}
            </span>
          )}
          {modelsError && <div className="error-box">{modelsError}</div>}
          {modelsLoading ? (
            <p className={styles.description}>{t('common.loading')}</p>
          ) : models.length === 0 ? (
            <p className={styles.description}>{t('system_info.models_empty')}</p>
          ) : (
            <div className={styles.modelsTable}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('system_info.models_col_model')}</TableHead>
                    <TableHead>{t('system_info.models_col_provider')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedModels.flatMap((group) =>
                    group.items.map((model) => (
                      <TableRow
                        key={`${group.id}-${model.name}-${model.alias ?? 'default'}`}
                        title={model.description || undefined}
                      >
                        <TableCell>
                          <span className={styles.modelName}>{model.name}</span>
                          {model.alias && <span className={styles.modelAlias}>{model.alias}</span>}
                        </TableCell>
                        <TableCell className={styles.providerCell}>{group.label}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className={styles.panel} aria-labelledby={sectionId('links')}>
          <h2 id={sectionId('links')} className={styles.panelTitle}>
            {t('system_info.quick_links_title')}
          </h2>
          <p className={styles.description}>{t('system_info.quick_links_desc')}</p>
          <ul className={styles.links}>
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  <span className={styles.linkText}>
                    <span className={styles.linkTitle}>{t(link.titleKey)}</span>
                    <span className={styles.linkDesc}>{t(link.descKey)}</span>
                  </span>
                  <IconExternalLink size={14} className={styles.linkIcon} />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.panel} aria-labelledby={sectionId('local')}>
          <h2 id={sectionId('local')} className={styles.panelTitle}>
            {t('system_info.clear_login_title')}
          </h2>
          <p className={styles.description}>{t('system_info.clear_login_desc')}</p>
          <div>
            <Button variant="danger" onClick={handleClearLoginStorage}>
              {t('system_info.clear_login_button')}
            </Button>
          </div>
        </section>
      </div>

      <Modal
        open={requestLogModalOpen}
        onClose={handleRequestLogClose}
        title={t('basic_settings.request_log_title')}
        footer={
          <>
            <Button variant="secondary" onClick={handleRequestLogClose} disabled={requestLogSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleRequestLogSave}
              loading={requestLogSaving}
              disabled={!canEditRequestLog || !requestLogDirty}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="request-log-modal">
          <div className="status-badge warning">{t('basic_settings.request_log_warning')}</div>
          <ToggleSwitch
            label={t('basic_settings.request_log_enable')}
            labelPosition="left"
            checked={requestLogDraft}
            disabled={!canEditRequestLog || requestLogSaving}
            onChange={(value) => {
              setRequestLogDraft(value);
              setRequestLogTouched(true);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
