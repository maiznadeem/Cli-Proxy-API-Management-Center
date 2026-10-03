import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import type { UsageBucket, UsageStatsResponse } from '@/services/api/usageStats';
import type { PricingTable } from '../pricing';
import {
  estimateBucket,
  formatTokens,
  formatUsd,
  sortByTotalDesc,
  truncateMiddle,
  type BucketKind,
} from '../model';
import styles from '../UsagePage.module.scss';

type TabId = 'model' | 'credential' | 'api_key' | 'session';
const TABS: readonly TabId[] = ['model', 'credential', 'api_key', 'session'];

const ROWS: Record<TabId, (data: UsageStatsResponse) => UsageBucket[]> = {
  model: (d) => d.by_model,
  credential: (d) => d.by_credential,
  api_key: (d) => d.by_api_key,
  session: (d) => d.by_session,
};

interface UsageTablesProps {
  data: UsageStatsResponse;
  pricing: PricingTable;
}

export function UsageTables({ data, pricing }: UsageTablesProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>('model');
  const rows = useMemo(() => sortByTotalDesc(ROWS[tab](data)), [data, tab]);
  const sourceByCredential = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data.by_credential) map.set(row.key, row.source || row.key);
    return map;
  }, [data.by_credential]);

  const renderLabel = (row: UsageBucket) => {
    if (tab === 'model') {
      return (
        <>
          <span className={styles.cellMain}>{row.key}</span>
          {row.provider && <span className={styles.cellSub}>{row.provider}</span>}
        </>
      );
    }
    if (tab === 'credential') {
      return (
        <>
          <span className={styles.cellMain}>{row.source || row.key}</span>
          {row.provider && <span className={styles.cellSub}>{row.provider}</span>}
        </>
      );
    }
    if (tab === 'api_key') return <span className={styles.mono}>{row.key}</span>;
    return (
      <>
        <span className={styles.mono} title={row.key}>
          {truncateMiddle(row.key, 18)}
        </span>
        <span className={styles.chips}>
          {(row.models ?? []).map((model) => (
            <span key={`m-${model}`} className={styles.chip}>
              {model}
            </span>
          ))}
          {(row.credentials ?? []).map((cred) => (
            <span key={`c-${cred}`} className={styles.chip}>
              {sourceByCredential.get(cred) ?? cred}
            </span>
          ))}
        </span>
      </>
    );
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div className={styles.tabs} role="tablist" aria-label={t('usage.tables_label')}>
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`${styles.segment} ${tab === id ? styles.segmentActive : ''}`}
              onClick={() => setTab(id)}
            >
              {t(`usage.tab_${id}`)}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className={styles.muted}>{t('usage.table_empty')}</p>
      ) : (
        <Table className={styles.table}>
          <TableHeader>
            <TableRow>
              <TableHead>{t(`usage.tab_${tab}`)}</TableHead>
              <TableHead alignRight>{t('usage.col_requests')}</TableHead>
              <TableHead alignRight>{t('usage.col_input')}</TableHead>
              <TableHead alignRight>{t('usage.col_cache_read')}</TableHead>
              <TableHead alignRight>{t('usage.col_cache_write')}</TableHead>
              <TableHead alignRight>{t('usage.col_output')}</TableHead>
              <TableHead alignRight>{t('usage.col_total')}</TableHead>
              <TableHead alignRight>{t('usage.col_cost')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const cost = estimateBucket(tab as BucketKind, row, data, pricing);
              return (
                <TableRow key={row.key}>
                  <TableCell className={styles.labelCell}>{renderLabel(row)}</TableCell>
                  <TableCell alignRight className={styles.num}>
                    {row.requests.toLocaleString()}
                    {row.failed > 0 && (
                      <span className={styles.failed}> ({row.failed})</span>
                    )}
                  </TableCell>
                  <TableCell alignRight className={styles.num}>
                    {formatTokens(row.input)}
                  </TableCell>
                  <TableCell alignRight className={styles.num}>
                    {formatTokens(row.cache_read)}
                  </TableCell>
                  <TableCell alignRight className={styles.num}>
                    {formatTokens(row.cache_write)}
                  </TableCell>
                  <TableCell alignRight className={styles.num}>
                    {formatTokens(row.output + row.reasoning)}
                  </TableCell>
                  <TableCell alignRight className={styles.num}>
                    {formatTokens(row.total)}
                  </TableCell>
                  <TableCell alignRight className={styles.num}>
                    {cost.value === null ? (
                      <span className={styles.noPrice}>{t('usage.no_price')}</span>
                    ) : (
                      <span title={cost.approx ? t('usage.approx_hint') : undefined}>
                        {cost.approx ? '≈ ' : ''}
                        {formatUsd(cost.value)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
