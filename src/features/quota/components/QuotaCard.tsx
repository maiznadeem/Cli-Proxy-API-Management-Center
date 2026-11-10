/**
 * Account ribbon on the Capacity page.
 *
 * Collapsed, a band says who the account is, how much is left on each window,
 * what state it is in (past due, free resets banked, focused routing) and what
 * you can do about it. Expanded, a sunken drawer beneath carries the fact sheet:
 * plan, credits, grants, breakdowns, notices. The band never changes shape
 * between the two, so the list stays scannable while one row is open.
 */

import { useState, type CSSProperties, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconChevronDown, IconRefreshCw } from '@/components/ui/icons';
import type { ClaudeQuotaState, ResolvedTheme, RoutingMode } from '@/types';
import { getRoutingMode } from '@/features/authFiles/routingMode';
import { RoutingModeControl } from '@/features/authFiles/components/RoutingModeControl';
import { deriveAuthFileIdentity } from '@/features/authFiles/identity';
import { resolveQuotaErrorMessage } from '@/utils/quota';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isRuntimeOnlyAuthFile,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';
import { bindQuotaClasses } from '../types';
import { QUOTA_ADAPTERS, type QuotaCardState } from '../providers';
import { QUOTA_DETAILS, resolvePlanLabel } from '../providers/details';
import { isQuotaRefreshDisabled, type QuotaFileEntry } from '../logic';
import { useClaudeResetGrants } from '../providers/claude/ClaudeResetGrants';
import { hasClaudeUsageData } from '../providers/claude/data';
import bodyStyles from './QuotaBody.module.scss';
import styles from './QuotaCard.module.scss';

/** Bind the quota-page styles to the shared rendering contract. */
const quotaClasses = bindQuotaClasses(bodyStyles, 'QuotaBody.module.scss');

const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"]';

export type QuotaCardProps = {
  entry: QuotaFileEntry;
  quota?: QuotaCardState;
  resolvedTheme: ResolvedTheme;
  canRefresh: boolean;
  resetting: boolean;
  /** Initial cascade delay; null disables entrance motion for later mounts. */
  entranceDelayMs?: number | null;
  onRefresh: () => void;
  onReset: () => void;
  /** When omitted the routing control is not rendered. */
  onRoutingModeChange?: (mode: RoutingMode) => void;
  routingBusy?: boolean;
  routingDisabled?: boolean;
};

export function QuotaCard(props: QuotaCardProps) {
  const {
    entry,
    quota,
    resolvedTheme,
    canRefresh,
    resetting,
    entranceDelayMs,
    onRefresh,
    onReset,
    onRoutingModeChange,
    routingBusy = false,
    routingDisabled = false,
  } = props;
  const { t } = useTranslation();
  const adapter = QUOTA_ADAPTERS[entry.type];
  const Details = QUOTA_DETAILS[entry.type];
  const file = entry.file;
  const retainedClaudeUsage =
    entry.type === 'claude' && hasClaudeUsageData(quota as ClaudeQuotaState | undefined);
  const identity = deriveAuthFileIdentity(file);
  const routingMode = getRoutingMode(file);
  const showRouting = Boolean(onRoutingModeChange) && !isRuntimeOnlyAuthFile(file);
  const [expanded, setExpanded] = useState(false);

  // Capture the entrance delay only at mount, without a render-time ref read.
  const [mountEntranceDelayMs] = useState<number | null>(entranceDelayMs ?? null);
  const entranceStyle =
    mountEntranceDelayMs === null
      ? undefined
      : ({ '--card-delay': `${mountEntranceDelayMs}ms` } as CSSProperties);

  const status = quota?.status ?? 'idle';
  const loading = status === 'loading';
  // A lapsed subscription has no grants to read or spend; skip the probe so the
  // card does not stack a "grants could not be read" line on the billing notice.
  const billingAccess =
    entry.type === 'claude'
      ? ((quota as { billing?: { access?: string } } | undefined)?.billing?.access ?? 'active')
      : 'active';
  const claudeLocked = billingAccess !== 'active';
  const claudeReset = useClaudeResetGrants(
    file,
    entry.type === 'claude' && status !== 'idle' && !claudeLocked,
    !canRefresh || loading || resetting,
    quota,
    onRefresh
  );
  const providerType =
    entry.type === 'plugin'
      ? String(
          file.quotaProvider ?? file['quota_provider'] ?? file.provider ?? file.type ?? 'plugin'
        )
      : entry.type;
  const iconSrc = getAuthFileIcon(providerType, resolvedTheme);
  const typeLabel = getTypeLabel(t, providerType);
  const planLabel = resolvePlanLabel(entry.type, quota, t);
  const errorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error'),
    quota?.failure
  );
  const showReset =
    status === 'success' &&
    Boolean(adapter.resetQuota) &&
    quota !== undefined &&
    Boolean(adapter.canResetQuota?.(quota));
  const hasBody = status === 'success' || retainedClaudeUsage;
  const canExpand = hasBody && Boolean(Details) && quota !== undefined;
  const toggleLabel = t(
    expanded ? 'quota_management.details_hide' : 'quota_management.details_show'
  );
  const freeResets = entry.type === 'claude' && !claudeLocked ? claudeReset.count : null;

  const onCardClick = (event: MouseEvent<HTMLElement>) => {
    if (!canExpand) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    if (window.getSelection()?.toString()) return;
    setExpanded((value) => !value);
  };

  const cardClass = [
    styles.card,
    mountEntranceDelayMs === null ? '' : styles.cardEnter,
    canExpand ? styles.cardToggle : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={cardClass}
      style={entranceStyle}
      data-expanded={expanded && canExpand ? 'true' : undefined}
      onClick={onCardClick}
    >
      <div className={styles.identity}>
        <span
          className={styles.iconWrap}
          title={typeLabel}
          style={
            isThemeSurfaceIconProvider(providerType)
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
        <span
          className={
            identity.kind === 'fileName'
              ? `${styles.primary} ${styles.primaryMono}`
              : styles.primary
          }
          title={identity.fullName}
        >
          {identity.primary}
        </span>
        <span className={styles.secondary}>
          <span>{typeLabel}</span>
          {planLabel && (
            <>
              <span className={styles.secondarySep} aria-hidden="true" />
              <span>{planLabel}</span>
            </>
          )}
        </span>
      </div>

      <div className={styles.body}>
        {status === 'idle' ? (
          <button
            type="button"
            className={styles.idleBody}
            onClick={onRefresh}
            disabled={!canRefresh}
          >
            <IconRefreshCw size={15} aria-hidden="true" className={styles.idleGlyph} />
            <span className={styles.idleHint}>{t(`${adapter.i18nPrefix}.idle`)}</span>
          </button>
        ) : loading && !retainedClaudeUsage ? (
          <div className={styles.skeleton} aria-busy="true">
            <span className={styles.srOnly}>{t(`${adapter.i18nPrefix}.loading`)}</span>
            {[0, 1].map((row) => (
              <div key={row} className={styles.skeletonRow} aria-hidden="true">
                <span className={styles.skeletonLabel} />
                <span className={styles.skeletonTrack} />
              </div>
            ))}
          </div>
        ) : status === 'error' ? (
          <div className={styles.errorStrip} role="alert">
            {t(`${adapter.i18nPrefix}.load_failed`, { message: errorMessage })}
          </div>
        ) : quota && !retainedClaudeUsage ? (
          <adapter.Body quota={quota} classes={quotaClasses} expanded={false} />
        ) : !retainedClaudeUsage ? (
          <div className={styles.idleHint}>{t(`${adapter.i18nPrefix}.idle`)}</div>
        ) : null}
        {loading && retainedClaudeUsage && (
          <div role="status" aria-busy="true" className={quotaClasses.quotaMessage}>
            {t(`${adapter.i18nPrefix}.loading`)}
          </div>
        )}
        {retainedClaudeUsage && quota && (
          <adapter.Body quota={quota} classes={quotaClasses} expanded={false} />
        )}
      </div>

      <div className={styles.state}>
        {claudeLocked && status === 'success' && (
          <span className={`${styles.pill} ${styles.pillWarn}`}>
            <span className={styles.pillDot} aria-hidden="true" />
            {t(`claude_quota.billing_${billingAccess}`)}
          </span>
        )}
        {routingMode !== 'normal' && (
          <span
            className={`${styles.pill} ${routingMode === 'focus' ? styles.pillAccent : ''}`}
            title={t(`auth_files.routing_mode.${routingMode}_hint`)}
          >
            <span className={styles.pillDot} aria-hidden="true" />
            {t(
              routingMode === 'focus'
                ? 'auth_files.routing_mode.badge_focused'
                : 'auth_files.routing_mode.badge_preserved'
            )}
          </span>
        )}
        {freeResets !== null && freeResets > 0 && (
          <span className={styles.pill} title={t('claude_reset.title')}>
            <span className={styles.pillDot} aria-hidden="true" />
            {t('quota_management.state_free_resets', { count: freeResets })}
          </span>
        )}
      </div>

      {(status !== 'idle' || showRouting) && (
        <div className={styles.actions}>
          {showRouting && onRoutingModeChange && (
            <RoutingModeControl
              className={styles.routing}
              name={identity.primary}
              value={routingMode}
              disabled={routingDisabled || routingBusy}
              onChange={onRoutingModeChange}
            />
          )}
          {status !== 'idle' && entry.type === 'claude' && !claudeLocked && (
            <button
              type="button"
              className={styles.actionPill}
              disabled={claudeReset.blocked}
              onClick={claudeReset.confirm}
              title={t(`claude_reset.${claudeReset.buttonLabel}`)}
            >
              <IconRefreshCw size={13} className={claudeReset.busy ? styles.spinning : undefined} />
              {t(`claude_reset.${claudeReset.buttonLabel}`)}
            </button>
          )}
          {showReset && (
            <button
              type="button"
              className={styles.actionPill}
              onClick={onReset}
              disabled={!canRefresh || loading || resetting}
              title={t('codex_quota.reset_button')}
            >
              <IconRefreshCw size={13} className={resetting ? styles.spinning : undefined} />
              {t('codex_quota.reset_button')}
            </button>
          )}
          {status !== 'idle' && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onRefresh}
              disabled={isQuotaRefreshDisabled(canRefresh, loading, resetting || claudeReset.busy)}
              title={t('auth_files.quota_refresh_single')}
              aria-label={t('auth_files.quota_refresh_single')}
            >
              <IconRefreshCw size={14} className={loading ? styles.spinning : undefined} />
            </button>
          )}
          {canExpand && (
            <button
              type="button"
              className={styles.iconButton}
              aria-expanded={expanded}
              aria-label={toggleLabel}
              title={toggleLabel}
              onClick={() => setExpanded((value) => !value)}
            >
              <IconChevronDown size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {expanded && canExpand && Details && quota && (
        <div className={styles.drawer}>
          <Details
            quota={quota}
            file={file}
            classes={quotaClasses}
            extras={{ grants: claudeReset.grants, grantMessage: claudeReset.message }}
          />
        </div>
      )}
    </article>
  );
}
