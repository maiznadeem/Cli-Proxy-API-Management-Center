import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { IconRefreshCw, IconUpload } from '@/components/ui/icons';
import styles from './VaultHeader.module.scss';

export type VaultHeaderProps = {
  totalCount: number;
  activeCount: number;
  problemCount: number;
  loading: boolean;
  refreshing: boolean;
  uploading: boolean;
  disableControls: boolean;
  onUpload: () => void;
  onRefresh: () => void;
  onOpenOAuth?: () => void;
  refreshingCredentials?: boolean;
  credentialRefreshDisabled?: boolean;
  onRefreshCredentials?: () => void;
};

/**
 * Credentials page header: title, a one-line summary, and the page actions.
 * Summary parts are separated by spacing and a hairline, not punctuation; the summary is
 * also the text equivalent of the health strip below it.
 */
export function VaultHeader(props: VaultHeaderProps) {
  const {
    totalCount,
    activeCount,
    problemCount,
    loading,
    refreshing,
    uploading,
    disableControls,
    onUpload,
    onRefresh,
    onOpenOAuth,
    refreshingCredentials = false,
    credentialRefreshDisabled = false,
    onRefreshCredentials,
  } = props;
  const { t } = useTranslation();

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1 className={styles.title}>{t('auth_files.title')}</h1>
        <p className={styles.meta}>
          <span className={styles.metaTotal}>
            {t('auth_files.meta_total', { count: totalCount })}
          </span>
          <span className={styles.metaSep} aria-hidden="true" />
          <span className={activeCount > 0 ? styles.metaActive : styles.metaMuted}>
            {t('auth_files.meta_active', { count: activeCount })}
          </span>
          {problemCount > 0 && (
            <>
              <span className={styles.metaSep} aria-hidden="true" />
              <span className={styles.metaProblem}>
                {t('auth_files.meta_problem', { count: problemCount })}
              </span>
            </>
          )}
        </p>
      </div>
      <div className={styles.actions}>
        <Button
          variant="ghost"
          onClick={onRefresh}
          disabled={loading || refreshing}
          className={styles.iconAction}
          title={t('common.refresh')}
          aria-label={t('common.refresh')}
        >
          <IconRefreshCw
            size={16}
            aria-hidden="true"
            className={refreshing ? styles.spinning : undefined}
          />
        </Button>
        {onRefreshCredentials && (
          <Button
            variant="ghost"
            onClick={onRefreshCredentials}
            disabled={
              disableControls || loading || refreshingCredentials || credentialRefreshDisabled
            }
          >
            {refreshingCredentials ? (
              <LoadingSpinner size={14} />
            ) : (
              <IconRefreshCw size={14} aria-hidden="true" />
            )}
            {t('auth_files.refresh_all_button')}
          </Button>
        )}
        {onOpenOAuth && (
          <Button variant="secondary" onClick={onOpenOAuth}>
            {t('auth_files.empty_oauth_link')}
          </Button>
        )}
        <Button variant="primary" onClick={onUpload} disabled={disableControls || uploading}>
          {uploading ? <LoadingSpinner size={14} /> : <IconUpload size={14} aria-hidden="true" />}
          {t('auth_files.upload_button')}
        </Button>
      </div>
    </header>
  );
}
