import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import styles from './QuotaHeader.module.scss';

export type QuotaHeaderProps = {
  totalCount: number;
  loadedCount: number;
  attentionCount: number;
  refreshing: boolean;
  disableControls: boolean;
  onRefreshAll: () => void;
};

/**
 * Capacity page header: title, a one-line summary of what is loaded, and the refresh action.
 * Summary parts are separated by spacing and a hairline, not punctuation.
 */
export function QuotaHeader(props: QuotaHeaderProps) {
  const { totalCount, loadedCount, attentionCount, refreshing, disableControls, onRefreshAll } =
    props;
  const { t } = useTranslation();

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1 className={styles.title}>{t('quota_management.title')}</h1>
        <p className={styles.meta}>
          <span className={styles.metaTotal}>
            {t('quota_management.meta_credentials', { count: totalCount })}
          </span>
          <span className={styles.metaSep} aria-hidden="true" />
          <span className={loadedCount > 0 ? styles.metaLoaded : styles.metaMuted}>
            {t('quota_management.meta_loaded', { count: loadedCount })}
          </span>
          {attentionCount > 0 && (
            <>
              <span className={styles.metaSep} aria-hidden="true" />
              <span className={styles.metaAttention}>
                {t('quota_management.meta_attention', { count: attentionCount })}
              </span>
            </>
          )}
        </p>
      </div>
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="md"
          onClick={onRefreshAll}
          disabled={disableControls || refreshing}
          className={styles.refresh}
        >
          <IconRefreshCw
            size={14}
            aria-hidden="true"
            className={refreshing ? styles.spinning : undefined}
          />
          {t('quota_management.refresh_all_credentials')}
        </Button>
      </div>
    </header>
  );
}
