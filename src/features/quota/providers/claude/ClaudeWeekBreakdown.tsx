/**
 * Week by surface: one stacked bar on the 7-day limit's 0..100 scale, split by
 * where the usage came from (Claude Code, chats, Cowork). The bar fills as far
 * as the 7-day meter is spent; the legend gives each surface's share of that.
 * Answers "who ate the week"; the capacity meter beside it answers "how much is left".
 */

import { useTranslation } from 'react-i18next';
import type { ClaudeUsageBreakdown } from '@/types';
import type { QuotaClassMap } from '../../types';
import styles from './ClaudeCredits.module.scss';

export interface ClaudeWeekBreakdownProps {
  breakdown: ClaudeUsageBreakdown;
  classes: QuotaClassMap;
  /** Omit the title; the host already names the section. */
  bare?: boolean;
}

export function ClaudeWeekBreakdown({
  breakdown,
  classes,
  bare = false,
}: ClaudeWeekBreakdownProps) {
  const { t } = useTranslation();
  // Shares sum to the used part of the week; scale them onto the limit's axis.
  const shareTotal = breakdown.rows.reduce((sum, row) => sum + row.percent, 0) || 100;
  const used = breakdown.usedPercent ?? Math.min(100, shareTotal);
  const widthOf = (share: number) => Math.min(100, (share / shareTotal) * used);
  const unused = Math.max(0, Math.round(100 - used));
  const title = t('claude_quota.breakdown_title');
  const summary = breakdown.rows
    .map((row) => `${row.label} ${Math.round(row.percent)}%`)
    .join(', ');

  return (
    <div className={bare ? `${styles.breakdown} ${styles.breakdownBare}` : styles.breakdown}>
      {!bare && <span className={`${classes.quotaModel} ${styles.breakdownTitle}`}>{title}</span>}
      <ul className={styles.legend}>
        {breakdown.rows.map((row, rank) => (
          <li key={row.key} className={styles.legendItem}>
            <span className={styles.swatch} data-rank={Math.min(rank, 3)} aria-hidden="true" />
            <span>{row.label}</span>
            <span className={styles.legendValue}>{Math.round(row.percent)}%</span>
          </li>
        ))}
        {unused > 0 && (
          <li className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.swatchUnused}`} aria-hidden="true" />
            <span>{t('claude_quota.breakdown_unused', { percent: unused })}</span>
          </li>
        )}
      </ul>
      <div className={styles.stack} role="img" aria-label={`${title}: ${summary}`}>
        {breakdown.rows.map((row, rank) => (
          <span
            key={row.key}
            className={styles.segment}
            data-rank={Math.min(rank, 3)}
            style={{ width: `${widthOf(row.percent)}%` }}
            title={`${row.label} ${Math.round(row.percent)}%`}
          />
        ))}
      </div>
    </div>
  );
}
