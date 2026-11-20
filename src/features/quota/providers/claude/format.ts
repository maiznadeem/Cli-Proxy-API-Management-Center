/** Money and short-date formatting shared by the Claude ribbon body and its details drawer. */

import type { TFunction } from 'i18next';
import type { ClaudeExtraUsage } from '@/types';

export const formatUsd = (amount: number, language?: string): string => {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatResetDate = (ms: number, language?: string): string =>
  new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(ms));

/** One state for every upstream "extra usage is off" signal, shown beside its label. */
export const claudeExtraUsageStatusKey = (extraUsage: ClaudeExtraUsage | null): string => {
  const userDisabled =
    extraUsage?.userDisabled === true || extraUsage?.disabledReason === 'user_disabled';
  if (extraUsage?.isEnabled === false || userDisabled) return 'claude_quota.extra_usage_disabled';
  if (extraUsage?.isEnabled === true) return 'claude_quota.extra_usage_enabled';
  return 'claude_quota.plan_unknown';
};

/** Notes beyond the state: spend limit reached, and a disabled reason other than the user's. */
export const claudeExtraUsageNotes = (
  extraUsage: ClaudeExtraUsage | null,
  t: TFunction
): string[] =>
  extraUsage
    ? [
        extraUsage.spendLimitReached ? t('claude_quota.extra_usage_spend_limit_reached') : '',
        extraUsage.disabledReason && extraUsage.disabledReason !== 'user_disabled'
          ? t('claude_quota.extra_usage_disabled_reason', { reason: extraUsage.disabledReason })
          : '',
      ].filter(Boolean)
    : [];
