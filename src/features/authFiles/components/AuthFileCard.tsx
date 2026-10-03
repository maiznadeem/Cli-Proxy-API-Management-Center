import { useState, type CSSProperties } from 'react';
import { getAuthFileRefreshKey } from '@/features/authFiles/manualRefresh';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  IconDownload,
  IconModelCluster,
  IconRefreshCw,
  IconSettings,
  IconTrash2,
} from '@/components/ui/icons';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import type { AuthFileItem, RoutingMode } from '@/types';
import { getRoutingMode } from '@/features/authFiles/routingMode';
import { RoutingModeBadge } from '@/features/authFiles/components/RoutingModeBadge';
import { RoutingModeControl } from '@/features/authFiles/components/RoutingModeControl';
import { statusBarDataFromRecentRequests } from '@/utils/recentRequests';
import { formatFileSize } from '@/utils/format';
import {
  formatModified,
  getAuthFileIcon,
  getAuthFileStatusMessage,
  getThemeSurfaceIconBackground,
  hasAuthFileStatusWarning,
  getTypeLabel,
  isRuntimeOnlyAuthFile,
  isThemeSurfaceIconProvider,
  normalizeProviderKey,
  supportsAuthFileManualRefresh,
  type AuthFileQuotaFilter,
  type ResolvedTheme,
} from '@/features/authFiles/constants';
import { deriveAuthFileIdentity } from '@/features/authFiles/identity';
import { resolveAuthFileQuotaType } from '@/features/authFiles/logic';
import type { AuthFileStatusBarData } from '@/features/authFiles/hooks/useAuthFilesStatusBarCache';
import { AuthFileQuotaSection } from '@/features/authFiles/components/AuthFileQuotaSection';
import { AuthFileCooldownSection } from './AuthFileCooldownSection';
import styles from './AuthFileCard.module.scss';

export type AuthFileCardProps = {
  file: AuthFileItem;
  compact: boolean;
  selected: boolean;
  resolvedTheme: ResolvedTheme;
  disableControls: boolean;
  deleting: string | null;
  statusUpdating: Record<string, boolean>;
  manualRefreshing: Record<string, boolean>;
  cooldownResetting: Record<string, boolean>;
  quotaFilterType: AuthFileQuotaFilter;
  statusBarCache: Map<string, AuthFileStatusBarData>;
  /** Delay for the one-off first-load fade; null/undefined means no entrance. */
  entranceDelayMs?: number | null;
  onShowModels: (file: AuthFileItem) => void;
  onDownload: (name: string) => void;
  onManualRefresh: (file: AuthFileItem) => void;
  onCooldownReset: (file: AuthFileItem) => void;
  onOpenPrefixProxyEditor: (file: AuthFileItem) => void;
  onDelete: (name: string) => void;
  onToggleStatus: (file: AuthFileItem, enabled: boolean) => void;
  /** Keys (getAuthFileRefreshKey) with a routing-mode patch in flight. */
  routingUpdating?: Record<string, boolean>;
  /** When omitted the routing control is not rendered. */
  onRoutingModeChange?: (file: AuthFileItem, mode: RoutingMode) => void;
  onToggleSelect: (name: string) => void;
};

/**
 * Credential ribbon: one full-width row per auth file.
 *   [ select | icon | identity ] [ status ] [ quota, in quota mode ] [ actions ]
 * Identity leads with the account; the filename is a mono fact underneath.
 */
export function AuthFileCard(props: AuthFileCardProps) {
  const { t } = useTranslation();
  const {
    file,
    compact,
    selected,
    resolvedTheme,
    disableControls,
    deleting,
    statusUpdating,
    manualRefreshing,
    cooldownResetting,
    quotaFilterType,
    statusBarCache,
    entranceDelayMs,
    onShowModels,
    onDownload,
    onManualRefresh,
    onCooldownReset,
    onOpenPrefixProxyEditor,
    onDelete,
    onToggleStatus,
    routingUpdating,
    onRoutingModeChange,
    onToggleSelect,
  } = props;

  const isRuntimeOnly = isRuntimeOnlyAuthFile(file);
  const providerKey = normalizeProviderKey(String(file.type ?? file.provider ?? 'unknown'));
  const isAistudio = providerKey === 'aistudio';
  const showModelsButton = !isRuntimeOnly || isAistudio;
  const showManualRefreshButton = !isRuntimeOnly && supportsAuthFileManualRefresh(providerKey);
  const isManualRefreshing = manualRefreshing[getAuthFileRefreshKey(file)] === true;
  const typeLabel = getTypeLabel(t, providerKey);
  const iconSrc = getAuthFileIcon(providerKey, resolvedTheme);

  const quotaType = resolveAuthFileQuotaType(file, quotaFilterType);
  const showQuotaLayout = Boolean(quotaType) && !isRuntimeOnly && !compact;

  const successCount = file.successCount ?? 0;
  const failureCount = file.failureCount ?? 0;
  const authIndexKey = typeof file.authIndex === 'string' ? file.authIndex : null;
  const isCooldownResetting = Boolean(authIndexKey && cooldownResetting[authIndexKey]);
  const statusData =
    (authIndexKey && statusBarCache.get(authIndexKey)) ||
    statusBarDataFromRecentRequests(file.recentRequests ?? []);

  const rawStatusMessage = getAuthFileStatusMessage(file);
  const hasStatusWarning = hasAuthFileStatusWarning(file);

  const priorityValue = Number.isSafeInteger(file.priority) ? file.priority : undefined;
  const weightValue = Number.isSafeInteger(file.weight) ? file.weight : undefined;
  const noteValue = typeof file.note === 'string' ? file.note.trim() : '';
  const identity = deriveAuthFileIdentity(file);
  const isExhausted = file.quota?.exhausted === true;
  const isOnCredits = isExhausted && file.quota?.usage_credits?.enabled === true;
  const routingMode = getRoutingMode(file);

  // Capture the entrance delay once on mount so a later null does not cut the fade short.
  const [mountEntranceDelayMs] = useState<number | null>(entranceDelayMs ?? null);
  const cardClasses = [
    styles.card,
    compact ? styles.cardCompact : '',
    showQuotaLayout ? styles.cardQuota : '',
    selected ? styles.cardSelected : '',
    file.disabled === true ? styles.cardDisabled : '',
    mountEntranceDelayMs != null ? styles.cardEnter : '',
  ]
    .filter(Boolean)
    .join(' ');
  const cardStyle =
    mountEntranceDelayMs != null
      ? ({ '--card-delay': `${mountEntranceDelayMs}ms` } as CSSProperties)
      : undefined;

  return (
    <article className={cardClasses} style={cardStyle}>
      <header className={styles.head}>
        {!isRuntimeOnly ? (
          <SelectionCheckbox
            checked={selected}
            onChange={() => onToggleSelect(file.name)}
            className={styles.selection}
            ariaLabel={t('auth_files.card_select', { name: file.name })}
            title={t('auth_files.card_select', { name: file.name })}
          />
        ) : (
          <span className={styles.selectionSpacer} />
        )}
        <span
          className={styles.iconWrap}
          title={typeLabel}
          style={
            // Kimi's icon needs a theme-aware surface behind it, as on the providers page.
            isThemeSurfaceIconProvider(providerKey)
              ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
              : undefined
          }
        >
          {iconSrc ? (
            <img src={iconSrc} alt="" className={styles.icon} />
          ) : (
            <span className={styles.iconFallback}>{typeLabel.slice(0, 1).toUpperCase()}</span>
          )}
        </span>
        <div className={styles.identityText}>
          <h3 className={styles.identity}>
            <span
              className={`${styles.account} ${identity.kind === 'fileName' ? styles.accountMono : ''}`}
              title={identity.primary}
            >
              {identity.primary}
            </span>
            {isExhausted && (
              <span className={`${styles.badge} ${styles.badgeExhausted}`}>
                {t('auth_files.badge_exhausted')}
              </span>
            )}
            {isOnCredits && (
              <span
                className={`${styles.badge} ${styles.badgeOnCredits}`}
                title={t('auth_files.badge_on_credits_hint')}
              >
                {t('auth_files.badge_on_credits')}
              </span>
            )}
            <RoutingModeBadge mode={routingMode} />
          </h3>
          <p className={styles.facts}>
            <span>{typeLabel}</span>
            {isRuntimeOnly && <span>{t('auth_files.type_virtual')}</span>}
            {identity.secondary && (
              <span className={styles.fileName} title={identity.fullName}>
                {identity.secondary}
              </span>
            )}
            {!compact && (
              <>
                <span title={t('auth_files.file_size')}>
                  {file.size ? formatFileSize(file.size) : '-'}
                </span>
                <span title={t('auth_files.file_modified')}>{formatModified(file)}</span>
              </>
            )}
            {priorityValue !== undefined && (
              <span title={t('auth_files.priority_hint')}>
                {t('auth_files.priority_display')}{' '}
                <span className={styles.factValue}>{priorityValue}</span>
              </span>
            )}
            {weightValue !== undefined && (
              <span title={t('auth_files.weight_tooltip')}>
                {t('auth_files.weight_display')}{' '}
                <span className={styles.factValue}>{weightValue}</span>
              </span>
            )}
          </p>
          {!compact && noteValue && (
            <p className={styles.note} title={noteValue}>
              {noteValue}
            </p>
          )}
        </div>
      </header>

      <div className={styles.status}>
        <div className={styles.statusLine}>
          {!isRuntimeOnly && (
            <ToggleSwitch
              ariaLabel={t('auth_files.card_toggle', { name: file.name })}
              label={
                file.disabled
                  ? t('auth_files.health_status_disabled')
                  : t('auth_files.status_toggle_label')
              }
              checked={!file.disabled}
              disabled={
                disableControls ||
                statusUpdating[getAuthFileRefreshKey(file)] === true ||
                isManualRefreshing
              }
              onChange={(value) => onToggleStatus(file, value)}
            />
          )}
          {!isRuntimeOnly && onRoutingModeChange && (
            <RoutingModeControl
              name={file.name}
              value={routingMode}
              disabled={
                disableControls ||
                routingUpdating?.[getAuthFileRefreshKey(file)] === true ||
                isManualRefreshing
              }
              onChange={(mode) => onRoutingModeChange(file, mode)}
            />
          )}
          <span className={styles.healthCounts}>
            <span
              className={`${styles.countOk} ${successCount > 0 ? styles.countLive : ''}`}
              title={t('stats.success')}
            >
              {t('stats.success')} {successCount}
            </span>
            <span
              className={`${styles.countFail} ${failureCount > 0 ? styles.countLive : ''}`}
              title={t('stats.failure')}
            >
              {t('stats.failure')} {failureCount}
            </span>
          </span>
        </div>

        {rawStatusMessage && hasStatusWarning && (
          <p className={styles.warning} title={rawStatusMessage}>
            {rawStatusMessage}
          </p>
        )}

        {!compact && <ProviderStatusBar statusData={statusData} styles={styles} />}

        <AuthFileCooldownSection
          snapshot={file.cooldownSnapshot}
          resetting={isCooldownResetting}
          resetDisabled={
            disableControls ||
            statusUpdating[getAuthFileRefreshKey(file)] === true ||
            isManualRefreshing
          }
          onReset={authIndexKey ? () => onCooldownReset(file) : undefined}
        />
      </div>

      {showQuotaLayout && quotaType && (
        <div className={styles.quota}>
          <AuthFileQuotaSection file={file} quotaType={quotaType} disableControls={disableControls} />
        </div>
      )}

      <footer className={styles.actions}>
        {showModelsButton && (
          <Button
            variant="ghost"
            onClick={() => onShowModels(file)}
            className={styles.iconButton}
            title={t('auth_files.models_button')}
            aria-label={t('auth_files.models_button')}
            disabled={disableControls}
          >
            <IconModelCluster size={16} />
          </Button>
        )}
        {!isRuntimeOnly && (
          <>
            {showManualRefreshButton && (
              <Button
                variant="ghost"
                onClick={() => onManualRefresh(file)}
                className={styles.iconButton}
                title={t('auth_files.manual_refresh_button')}
                aria-label={t('auth_files.manual_refresh_button')}
                disabled={
                  disableControls ||
                  file.disabled ||
                  statusUpdating[getAuthFileRefreshKey(file)] === true ||
                  isManualRefreshing
                }
              >
                {isManualRefreshing ? <LoadingSpinner size={14} /> : <IconRefreshCw size={16} />}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => onDownload(file.name)}
              className={styles.iconButton}
              title={t('auth_files.download_button')}
              aria-label={t('auth_files.download_button')}
              disabled={disableControls}
            >
              <IconDownload size={16} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenPrefixProxyEditor(file)}
              className={styles.iconButton}
              title={t('auth_files.prefix_proxy_button')}
              aria-label={t('auth_files.prefix_proxy_button')}
              disabled={disableControls || isManualRefreshing}
            >
              <IconSettings size={16} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => onDelete(file.name)}
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              title={t('auth_files.delete_button')}
              aria-label={t('auth_files.delete_button')}
              disabled={disableControls || deleting === file.name || isManualRefreshing}
            >
              {deleting === file.name ? <LoadingSpinner size={14} /> : <IconTrash2 size={16} />}
            </Button>
          </>
        )}
      </footer>
    </article>
  );
}
