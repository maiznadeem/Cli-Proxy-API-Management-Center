import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconPlus, IconRefreshCw } from '@/components/ui/icons';
import styles from './ProviderHeaderCard.module.scss';

interface ProviderHeaderCardProps {
  title?: string;
  totalActive: number;
  totalResources: number;
  providerFamilies: number;
  updatedAtLabel: string;
  isFetching?: boolean;
  isNewDisabled?: boolean;
  showNewAction?: boolean;
  showSummary?: boolean;
  newLabel?: string;
  variant?: 'quickStart';
  onRefresh: () => void;
  onNew: () => void;
}

export function ProviderHeaderCard({
  title,
  totalActive,
  totalResources,
  providerFamilies,
  updatedAtLabel,
  isFetching = false,
  isNewDisabled = false,
  showNewAction = true,
  showSummary = true,
  newLabel,
  variant,
  onRefresh,
  onNew,
}: ProviderHeaderCardProps) {
  const { t } = useTranslation();
  const headerClassName = [styles.header, variant === 'quickStart' ? styles.quickStart : '']
    .filter(Boolean)
    .join(' ');
  const refreshLabel = isFetching
    ? t('providersPage.actions.syncing')
    : t('providersPage.actions.refresh');

  return (
    <header className={headerClassName}>
      <div className={styles.copy}>
        <h1 className={styles.title}>{title ?? t('providersPage.header.title')}</h1>
        {showSummary ? (
          <p className={styles.meta}>
            <span className={styles.metaStrong}>
              {t('providersPage.header.activeResources', {
                active: totalActive,
                total: totalResources,
              })}
            </span>
            <span className={styles.metaSep} aria-hidden="true" />
            <span>{t('providersPage.header.providerFamilies', { count: providerFamilies })}</span>
            <span className={styles.metaSep} aria-hidden="true" />
            <span className={styles.metaFaint}>
              {t('providersPage.header.updatedAt', { time: updatedAtLabel })}
            </span>
          </p>
        ) : null}
      </div>
      <div className={styles.actions}>
        <Button
          variant={showNewAction ? 'secondary' : 'primary'}
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={refreshLabel}
          className={styles.actionButton}
        >
          <IconRefreshCw
            size={14}
            aria-hidden="true"
            className={isFetching ? styles.spinning : undefined}
          />
          {refreshLabel}
        </Button>
        {showNewAction ? (
          <Button
            variant="primary"
            onClick={onNew}
            disabled={isNewDisabled}
            className={styles.actionButton}
          >
            <IconPlus size={14} aria-hidden="true" />
            {newLabel ?? t('providersPage.actions.new')}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
