/**
 * Claude 额度渲染体：套餐 chip 行 + 用量积分行 + 月度额度行 + 用量窗口水位条。
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClaudeDollarBucket, ClaudeQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { collectQuotaRowInstants, pickUrgentRowId } from '../../resetSchedule';
import type { QuotaBodyProps } from '../../types';
import styles from './ClaudeCredits.module.scss';

export const CLAUDE_USAGE_SETTINGS_URL = 'https://claude.ai/settings/usage';

const formatUsd = (amount: number, language?: string): string => {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatResetDate = (ms: number, language?: string): string =>
  new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(ms));

export function ClaudeQuotaBody({ quota, classes }: QuotaBodyProps<ClaudeQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const soonestRowId = useMemo(
    () => pickUrgentRowId(collectQuotaRowInstants('claude', quota), now),
    [quota, now]
  );
  const windows = quota.windows ?? [];
  const credits = quota.credits ?? null;
  const allowances = quota.allowances ?? [];
  const language = i18n.resolvedLanguage;
  const planType = quota.planType ?? null;

  return (
    <>
      {planType && (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanLabel}>{t('claude_quota.plan_label')}</span>
          <span className={classes.codexPlanValue}>{t(`claude_quota.${planType}`)}</span>
        </div>
      )}
      {credits && credits.status !== 'unknown' && (
        <div className={styles.credits}>
          <div className={styles.line}>
            <span className={styles.label}>{t('claude_quota.credits_label')}</span>
            <span
              className={`${styles.pill} ${credits.status === 'enabled' ? styles.pillOn : ''}`}
            >
              <span className={styles.dot} aria-hidden="true" />
              {t(`claude_quota.credits_${credits.status}`)}
            </span>
            {credits.limitCents !== null && (
              <span className={styles.amount}>
                {t('claude_quota.credits_spent', {
                  used: formatUsd((credits.usedCents ?? 0) / 100, language),
                  limit: formatUsd(credits.limitCents / 100, language),
                })}
              </span>
            )}
          </div>
          {!credits.canToggle && (
            <div className={styles.line}>
              <a
                className={styles.link}
                href={CLAUDE_USAGE_SETTINGS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('claude_quota.credits_hint')}
              </a>
            </div>
          )}
        </div>
      )}
      {allowances.map((bucket: ClaudeDollarBucket) => {
        if (bucket.limitDollars === null) return null;
        const used = formatUsd(Math.max(bucket.limitDollars - (bucket.usedDollars ?? 0), 0), language);
        const limit = formatUsd(bucket.limitDollars, language);
        return (
          <div key={bucket.id} className={styles.credits}>
            <div className={styles.line}>
              <span className={styles.label}>{t(bucket.labelKey)}</span>
              <span className={styles.amount}>
                {bucket.resetAtMs !== null
                  ? t('claude_quota.allowance_amount', {
                      used,
                      limit,
                      date: formatResetDate(bucket.resetAtMs, language),
                    })
                  : t('claude_quota.allowance_amount_no_reset', { used, limit })}
              </span>
              {bucket.lockedReason && (
                <span className={styles.hint}>
                  {t('claude_quota.allowance_locked', { reason: bucket.lockedReason })}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {windows.length === 0 ? (
        <div className={classes.quotaMessage}>{t('claude_quota.empty_windows')}</div>
      ) : (
        windows.map((window, index) => {
          const used = window.usedPercent;
          const clampedUsed = used === null ? null : Math.max(0, Math.min(100, used));
          const remaining =
            clampedUsed === null ? null : Math.max(0, Math.min(100, 100 - clampedUsed));
          const percentLabel = remaining === null ? '--' : `${Math.round(remaining)}%`;
          const windowLabel = window.labelKey ? t(window.labelKey) : window.label;
          const resetDisplay = buildResetDisplay(
            window.resetLabel,
            window.resetAtMs,
            now,
            i18n.resolvedLanguage
          );

          const soon = window.id === soonestRowId;

          return (
            <div
              key={window.id}
              className={classes.quotaRow}
              title={soon ? t('quota_management.soonest_row_hint') : undefined}
            >
              <div className={classes.quotaRowHeader}>
                <span className={classes.quotaModel}>{windowLabel}</span>
                <div className={classes.quotaMeta}>
                  <span className={classes.quotaPercent}>{percentLabel}</span>
                  {resetDisplay ? (
                    <QuotaResetLabel display={resetDisplay} classes={classes} soon={soon} />
                  ) : (
                    <span className={classes.quotaReset}>{t('quota_management.no_reset_pending')}</span>
                  )}
                </div>
              </div>
              <QuotaMeter percent={remaining} classes={classes} index={index} />
            </div>
          );
        })
      )}
    </>
  );
}
