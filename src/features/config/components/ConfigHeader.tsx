import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import type { HeaderMetaSegment } from '../uiState';
import styles from './ConfigHeader.module.scss';

export type ConfigHeaderProps = {
  /** Summary line segments (output of uiState.buildHeaderMeta). */
  meta: HeaderMetaSegment[];
  reloadDisabled: boolean;
  reloading: boolean;
  onReload: () => void;
  /** Right-side controls before the reload action: mode search and the ModeSwitch. */
  extraActions?: ReactNode;
};

/**
 * Settings header: page title, a muted summary line with hairline separators, and the
 * page controls on the right. Saving lives in FloatingSaveBar, shown only while dirty.
 */
export function ConfigHeader({
  meta,
  reloadDisabled,
  reloading,
  onReload,
  extraActions,
}: ConfigHeaderProps) {
  const { t } = useTranslation();
  const toneClass: Record<HeaderMetaSegment['tone'], string> = {
    muted: styles.metaMuted,
    warning: styles.metaWarning,
    error: styles.metaError,
    ok: styles.metaMuted,
  };

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1 className={styles.title}>{t('config_management.title')}</h1>
        <p className={styles.meta}>
          {meta.map((segment, index) => (
            <Fragment key={segment.key}>
              {index > 0 ? <span className={styles.metaSep} aria-hidden="true" /> : null}
              <span className={toneClass[segment.tone]}>
                {segment.count !== undefined
                  ? t(segment.labelKey, { count: segment.count })
                  : t(segment.labelKey)}
              </span>
            </Fragment>
          ))}
        </p>
      </div>
      <div className={styles.actions}>
        {extraActions}
        <button
          type="button"
          className={styles.ghostAction}
          onClick={onReload}
          disabled={reloadDisabled}
        >
          <IconRefreshCw size={14} className={reloading ? styles.spinning : undefined} />
          {t('config_management.reload')}
        </button>
      </div>
    </header>
  );
}
