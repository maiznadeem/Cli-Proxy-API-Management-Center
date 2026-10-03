/**
 * Usage: token totals and estimated API-equivalent cost from the proxy's usage stats.
 * State lives in useUsageStore; useUsagePoll refreshes it every 60 s.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { IconRefreshCw } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotificationStore } from '@/stores';
import { useUsageStore } from '@/stores/useUsageStore';
import { getErrorMessage } from '@/utils/helpers';
import { PricingEditor } from './components/PricingEditor';
import { UsageChart } from './components/UsageChart';
import { UsageTables } from './components/UsageTables';
import { useUsagePoll } from './hooks';
import { estimateTotal, formatTokens, formatUsd, USAGE_RANGES } from './model';
import styles from './UsagePage.module.scss';

const RANGE_KEYS = { today: 'range_today', '7d': 'range_7d', '30d': 'range_30d', all: 'range_all' };

export function UsagePage() {
  const { t, i18n } = useTranslation();
  const { connected } = useUsagePoll();
  const showNotification = useNotificationStore((s) => s.showNotification);
  const range = useUsageStore((s) => s.range);
  const data = useUsageStore((s) => s.data);
  const status = useUsageStore((s) => s.status);
  const error = useUsageStore((s) => s.error);
  const lastUpdated = useUsageStore((s) => s.lastUpdated);
  const pricing = useUsageStore((s) => s.pricing);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  const cost = useMemo(() => (data ? estimateTotal(data, pricing) : null), [data, pricing]);

  const clear = async () => {
    setClearing(true);
    try {
      await useUsageStore.getState().clearHistory();
      setConfirmOpen(false);
      showNotification(t('usage.clear_success'), 'success');
    } catch (err: unknown) {
      showNotification(`${t('usage.clear_failed')}: ${getErrorMessage(err)}`, 'error');
    } finally {
      setClearing(false);
    }
  };

  const updatedLabel = lastUpdated
    ? t('usage.updated', {
        time: new Date(lastUpdated).toLocaleTimeString(i18n.resolvedLanguage, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })
    : t('usage.waiting');

  const renderBody = () => {
    if (!connected) return <p className={styles.notice}>{t('usage.disconnected')}</p>;
    if (status === 'unsupported') {
      return <EmptyState title={t('usage.unsupported_title')} description={t('usage.unsupported_desc')} />;
    }
    if (!data) {
      if (status === 'error') return null;
      return (
        <div className={styles.skeletons} aria-busy="true">
          <Skeleton height={88} rounded={10} />
          <Skeleton height={200} rounded={10} />
        </div>
      );
    }
    if (data.totals.requests === 0) {
      return <EmptyState title={t('usage.empty_title')} description={t('usage.empty_desc')} />;
    }
    const { totals } = data;
    return (
      <>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{t('usage.tile_requests')}</span>
            <span className={styles.tileValue}>{totals.requests.toLocaleString()}</span>
            <span className={totals.failed > 0 ? styles.tileSubWarn : styles.tileSub}>
              {t('usage.tile_failed', { count: totals.failed })}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{t('usage.tile_tokens')}</span>
            <span className={styles.tileValue} title={totals.total.toLocaleString()}>
              {formatTokens(totals.total)}
            </span>
            <span className={styles.tileSub}>
              {t('usage.tile_tokens_sub', { input: formatTokens(totals.input + totals.cache_read + totals.cache_write) })}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{t('usage.tile_output')}</span>
            <span className={styles.tileValue}>{formatTokens(totals.output + totals.reasoning)}</span>
            <span className={styles.tileSub}>
              {t('usage.tile_output_sub', { reasoning: formatTokens(totals.reasoning) })}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{t('usage.tile_cost')}</span>
            <span className={styles.tileValue}>{cost ? formatUsd(cost.value) : '-'}</span>
            <span className={styles.tileSub}>
              {cost && cost.unpriced > 0
                ? t('usage.tile_cost_unpriced', { count: cost.unpriced })
                : t('usage.tile_cost_sub')}
            </span>
          </div>
        </div>
        <UsageChart data={data} pricing={pricing} />
        <UsageTables data={data} pricing={pricing} />
      </>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.copy}>
          <h1 className={styles.title}>{t('usage.title')}</h1>
          <p className={styles.meta}>{updatedLabel}</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.segmented} role="group" aria-label={t('usage.range_label')}>
            {USAGE_RANGES.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={range === id}
                className={`${styles.segment} ${range === id ? styles.segmentActive : ''}`}
                onClick={() => useUsageStore.getState().setRange(id)}
              >
                {t(`usage.${RANGE_KEYS[id]}`)}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="md"
            className={styles.iconButton}
            onClick={() => void useUsageStore.getState().refresh()}
            disabled={!connected}
            aria-label={t('usage.refresh')}
            title={t('usage.refresh')}
          >
            <IconRefreshCw size={16} aria-hidden="true" />
          </Button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {t('usage.load_error', { message: error })}
        </div>
      )}

      {renderBody()}

      <footer className={styles.footer}>
        <Button variant="ghost" size="sm" onClick={() => setPricingOpen((open) => !open)} aria-expanded={pricingOpen} aria-controls="usage-pricing">
          {t('usage.pricing_toggle')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={!connected || status === 'unsupported'}
        >
          {t('usage.clear')}
        </Button>
      </footer>

      {pricingOpen && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>{t('usage.pricing_title')}</h2>
          </div>
          <PricingEditor
            pricing={pricing}
            onChange={(table) => useUsageStore.getState().setPricing(table)}
            onReset={() => useUsageStore.getState().resetPricing()}
          />
        </section>
      )}

      <Modal
        open={confirmOpen}
        title={t('usage.clear_title')}
        onClose={() => setConfirmOpen(false)}
        closeDisabled={clearing}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={clearing}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void clear()} loading={clearing}>
              {t('usage.clear_confirm')}
            </Button>
          </>
        }
      >
        <p>{t('usage.clear_body')}</p>
      </Modal>
    </div>
  );
}
