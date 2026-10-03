import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UsageBucket, UsageStatsResponse } from '@/services/api/usageStats';
import type { PricingTable } from '../pricing';
import { estimateBucket, formatTokens, formatUsd } from '../model';
import styles from '../UsagePage.module.scss';

interface UsageChartProps {
  data: UsageStatsResponse;
  pricing: PricingTable;
}

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

function dayLabel(key: string): string {
  // key is YYYY-MM-DD; show MM-DD to keep columns narrow.
  return key.length >= 10 ? key.slice(5, 10) : key;
}

export function UsageChart({ data, pricing }: UsageChartProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<string | null>(null);
  const days: UsageBucket[] = [...data.by_day].sort((a, b) => a.key.localeCompare(b.key));
  const max = days.reduce((m, d) => Math.max(m, d.total), 0);
  const labelStep = Math.max(1, Math.ceil(days.length / 10));

  return (
    <section className={styles.panel} aria-label={t('usage.chart_title')}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{t('usage.chart_title')}</h2>
        <ul className={styles.legend}>
          <li>
            <span className={`${styles.swatch} ${styles.swatchInput}`} aria-hidden="true" />
            {t('usage.col_input')}
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.swatchCache}`} aria-hidden="true" />
            {t('usage.legend_cache')}
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.swatchOutput}`} aria-hidden="true" />
            {t('usage.col_output')}
          </li>
        </ul>
      </div>
      {days.length === 0 ? (
        <p className={styles.muted}>{t('usage.chart_empty')}</p>
      ) : (
        <div className={styles.chart} role="list">
          {days.map((day, index) => {
            const output = day.output + day.reasoning;
            const cache = day.cache_read + day.cache_write;
            const height = pct(day.total, max);
            const cost = estimateBucket('day', day, data, pricing);
            const open = active === day.key;
            return (
              <div
                key={day.key}
                role="listitem"
                className={`${styles.column} ${open ? styles.columnActive : ''}`}
                tabIndex={0}
                aria-label={t('usage.chart_day_label', {
                  day: day.key,
                  tokens: formatTokens(day.total),
                })}
                onMouseEnter={() => setActive(day.key)}
                onMouseLeave={() => setActive((c) => (c === day.key ? null : c))}
                onFocus={() => setActive(day.key)}
                onBlur={() => setActive((c) => (c === day.key ? null : c))}
              >
                <div className={styles.barSlot}>
                  <div className={styles.bar} style={{ height: `${Math.max(height, 1.5)}%` }}>
                    <span
                      className={styles.segOutput}
                      style={{ flexGrow: output, display: output > 0 ? undefined : 'none' }}
                    />
                    <span
                      className={styles.segCache}
                      style={{ flexGrow: cache, display: cache > 0 ? undefined : 'none' }}
                    />
                    <span
                      className={styles.segInput}
                      style={{ flexGrow: day.input, display: day.input > 0 ? undefined : 'none' }}
                    />
                  </div>
                </div>
                <span className={styles.dayLabel}>
                  {index % labelStep === 0 ? dayLabel(day.key) : ''}
                </span>
                {open && (
                  <div className={styles.tooltip} role="tooltip">
                    <div className={styles.tooltipTitle}>{day.key}</div>
                    <dl className={styles.tooltipRows}>
                      <dt>{t('usage.col_requests')}</dt>
                      <dd>{day.requests.toLocaleString()}</dd>
                      <dt>{t('usage.col_input')}</dt>
                      <dd>{formatTokens(day.input)}</dd>
                      <dt>{t('usage.legend_cache')}</dt>
                      <dd>{formatTokens(cache)}</dd>
                      <dt>{t('usage.col_output')}</dt>
                      <dd>{formatTokens(output)}</dd>
                      <dt>{t('usage.col_total')}</dt>
                      <dd>{formatTokens(day.total)}</dd>
                      <dt>{t('usage.col_cost')}</dt>
                      <dd>
                        {cost.value === null
                          ? t('usage.no_price')
                          : `${cost.approx ? '≈ ' : ''}${formatUsd(cost.value)}`}
                      </dd>
                    </dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
