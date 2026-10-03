import { useTranslation } from 'react-i18next';
import type { ResolvedTheme } from '@/types';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';
import type { RoutingAccount } from '../model/parseRoutingLines';
import styles from './RoutingAccounts.module.scss';

export interface RoutingAccountsProps {
  accounts: RoutingAccount[];
  resolvedTheme: ResolvedTheme;
}

/** One panel per account seen in the log: requests served, active threads, share of traffic. */
export function RoutingAccounts({ accounts, resolvedTheme }: RoutingAccountsProps) {
  const { t } = useTranslation();
  if (accounts.length === 0) return null;

  return (
    <ul className={styles.strip} aria-label={t('routing.accounts_label')}>
      {accounts.map((account) => {
        const iconSrc = getAuthFileIcon(account.provider, resolvedTheme);
        const percent = Math.round(account.share * 100);
        return (
          <li key={account.auth} className={styles.panel}>
            <span className={styles.head}>
              <span
                className={styles.iconWrap}
                style={
                  isThemeSurfaceIconProvider(account.provider)
                    ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
                    : undefined
                }
              >
                {iconSrc ? (
                  <img src={iconSrc} alt="" className={styles.icon} />
                ) : (
                  <span className={styles.iconFallback} aria-hidden="true">
                    {(account.provider || account.label).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span className={styles.name} title={account.auth}>
                {account.label}
              </span>
            </span>
            <span className={styles.figures}>
              <span className={styles.figureMain}>
                {t('routing.account_requests', { count: account.requests })}
              </span>
              <span className={styles.figureSub}>
                {t('routing.account_active', { count: account.activeThreads })}
              </span>
            </span>
            <span
              className={styles.share}
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={t('routing.account_share', { percent })}
            >
              <span className={styles.shareFill} style={{ width: `${percent}%` }} />
            </span>
            <span className={styles.shareLabel}>{t('routing.account_share', { percent })}</span>
          </li>
        );
      })}
    </ul>
  );
}
