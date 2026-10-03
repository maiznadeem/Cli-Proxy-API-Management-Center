/**
 * Capacity summary: one panel per provider that has credentials.
 *
 * Answers "how much is left across all my accounts, and when does the next one come back?"
 * before the per-account ribbons answer it credential by credential. Aggregate remaining is
 * shown as a sum over loaded accounts ("312% of 400%") because that is how people with several
 * subscriptions actually reason about their budget.
 *
 * Pure derivation lives in `summarizeCapacity` so it can be tested without React.
 */

import { useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResolvedTheme } from '@/types';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';
import type { QuotaFileEntry } from '../logic';
import type { QuotaCardState } from '../providers';
import { summarizeCapacity } from '../capacitySummaryModel';
import styles from './CapacitySummary.module.scss';

const relativeReset = (
  targetMs: number,
  now: number,
  t: (key: string, options?: Record<string, unknown>) => string
): string => {
  const diff = Math.max(0, targetMs - now);
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return t('quota_management.summary_reset_soon', { defaultValue: 'within the hour' });
  if (hours < 48) return t('quota_management.summary_reset_hours', { defaultValue: 'in {{count}} h', count: hours });
  const days = Math.round(hours / 24);
  return t('quota_management.summary_reset_days', { defaultValue: 'in {{count}} days', count: days });
};

export interface CapacitySummaryProps {
  entries: QuotaFileEntry[];
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined;
  resolvedTheme: ResolvedTheme;
  activeTab: string;
  onSelect: (tab: string) => void;
  now: number;
}

export function CapacitySummary(props: CapacitySummaryProps) {
  const { entries, quotaFor, resolvedTheme, activeTab, onSelect, now } = props;
  const { t, i18n } = useTranslation();
  const summaries = useMemo(() => summarizeCapacity(entries, quotaFor), [entries, quotaFor]);

  if (summaries.length === 0) return null;

  const absolute = (ms: number) =>
    new Date(ms).toLocaleString(i18n.resolvedLanguage, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className={styles.strip} role="list">
      {summaries.map((summary) => {
        const iconSrc = getAuthFileIcon(summary.provider, resolvedTheme);
        const typeLabel = getTypeLabel(t, summary.provider);
        const selected = activeTab === summary.provider;
        const loadedAny = summary.loaded > 0;
        const capacity = summary.loaded * 100;
        return (
          <button
            key={summary.provider}
            type="button"
            role="listitem"
            className={`${styles.panel} ${selected ? styles.panelSelected : ''}`}
            aria-pressed={selected}
            onClick={() => onSelect(selected ? 'all' : summary.provider)}
          >
            <span className={styles.head}>
              <span
                className={styles.iconWrap}
                style={
                  isThemeSurfaceIconProvider(summary.provider)
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
              <span className={styles.name}>{typeLabel}</span>
              <span className={styles.count}>
                {t('quota_management.summary_credentials', {
                  defaultValue: '{{count}} credentials',
                  count: summary.total,
                })}
              </span>
            </span>

            <span className={styles.label}>
              {summary.headlineLabel ??
                t('quota_management.summary_remaining', { defaultValue: 'Remaining' })}
            </span>
            <span className={styles.figure}>
              {loadedAny ? (
                <>
                  <span className={styles.figureMain}>{Math.round(summary.remainingSum)}%</span>
                  <span className={styles.figureOf}>
                    {t('quota_management.summary_of', { defaultValue: 'of {{total}}%', total: capacity })}
                  </span>
                </>
              ) : (
                <span className={styles.figureMuted}>
                  {t('quota_management.summary_not_loaded', { defaultValue: 'Not loaded' })}
                </span>
              )}
            </span>

            <span className={styles.segments} aria-hidden="true">
              {summary.segments.map((remaining, index) => (
                <span
                  key={index}
                  className={styles.segment}
                  data-tone={
                    remaining === null
                      ? 'none'
                      : remaining >= 70
                        ? 'plenty'
                        : remaining >= 30
                          ? 'watch'
                          : 'depleted'
                  }
                >
                  {remaining !== null && (
                    <span
                      className={styles.segmentFill}
                      style={{ width: `${remaining}%`, '--meter-value': remaining } as CSSProperties}
                    />
                  )}
                </span>
              ))}
            </span>

            <span className={styles.reset}>
              {summary.nextResetMs !== null ? (
                <>
                  <span className={styles.resetRelative}>
                    {relativeReset(summary.nextResetMs, now, t)}
                  </span>
                  <span className={styles.resetAbsolute}>{absolute(summary.nextResetMs)}</span>
                </>
              ) : (
                <span className={styles.resetAbsolute}>
                  {t('quota_management.summary_no_reset', { defaultValue: 'No reset scheduled' })}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
