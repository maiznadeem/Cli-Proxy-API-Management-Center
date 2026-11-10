/**
 * Claude details drawer: the explanatory layer behind a ribbon.
 *
 * Sections, left to right: the account (plan, credits, allowances, the file),
 * billing when it is in the way, free reset grants, and the week by surface.
 * Every fact is a label / value row; nothing here repeats the meters above.
 */

import { useTranslation } from 'react-i18next';
import type { AnthropicResetGrant } from '@/services/api/claudeResetGrants';
import type { ClaudeQuotaState } from '@/types';
import { buildResetDisplay, formatQuotaResetTime, resolveResetMs } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import {
  FactLink,
  FactNotice,
  FactPill,
  FactRow,
  FactSection,
  FactSheet,
} from '../../components/FactSheet';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import type { QuotaDetailsProps } from '../types';
import { ClaudeResetGrantDetails } from './ClaudeResetGrantDetails';
import { ClaudeWeekBreakdown } from './ClaudeWeekBreakdown';
import { CLAUDE_BILLING_URL, CLAUDE_USAGE_SETTINGS_URL } from './ClaudeQuotaBody';
import { formatResetDate, formatUsd } from './format';

export interface ClaudeDetailsExtras {
  grants: readonly AnthropicResetGrant[];
  /** A grant read or claim message, already a `claude_reset.*` key suffix. */
  grantMessage: string;
}

export function ClaudeDetails({
  quota,
  file,
  classes,
  extras,
}: QuotaDetailsProps<ClaudeQuotaState, ClaudeDetailsExtras>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const language = i18n.resolvedLanguage;
  const billing = quota.billing ?? null;
  const billingAccess = billing?.access ?? 'active';
  const locked = (quota.windows ?? []).some((window) => window.locked === true);
  const hasGrants = extras.grants.some((grant) => grant.resetsLeft > 0);
  const weekUsed =
    (quota.windows ?? []).find((window) => window.id === 'seven-day')?.usedPercent ?? null;
  const credits = quota.credits ?? null;
  const allowances = quota.allowances ?? [];
  const extraUsage = quota.extraUsage ?? null;
  const dollarWindows = (quota.dollarWindows ?? []).filter(
    (balance) =>
      balance.key !== 'iguana_necktie' || !allowances.some((bucket) => bucket.limitDollars !== null)
  );
  const observedMs = resolveResetMs([quota.observedAt ?? null]);
  // Server and browser clocks drift; a snapshot stamped at or ahead of now reads "just now".
  const observed =
    observedMs === null
      ? null
      : observedMs >= now - 30_000
        ? { absolute: formatQuotaResetTime(quota.observedAt ?? undefined), relative: null }
        : buildResetDisplay(null, observedMs, now, language);
  const billingNoticeKey =
    billingAccess === 'inactive'
      ? 'claude_quota.billing_inactive_notice'
      : locked
        ? 'claude_quota.billing_locked_notice'
        : 'claude_quota.billing_warning_notice';
  const money = (value: number | null, currency = 'USD', divisor = 1) =>
    value === null
      ? '--'
      : new Intl.NumberFormat(language, { style: 'currency', currency }).format(value / divisor);

  return (
    <FactSheet>
      <FactSection title={t('quota_management.details_account')}>
        {quota.planType && (
          <FactRow label={t('claude_quota.plan_label')}>
            <span>{t(`claude_quota.${quota.planType}`)}</span>
          </FactRow>
        )}
        {credits && credits.status !== 'unknown' && (
          <FactRow
            label={t('claude_quota.credits_label')}
            hint={
              credits.canToggle ? undefined : (
                <FactLink href={CLAUDE_USAGE_SETTINGS_URL}>
                  {t('claude_quota.credits_hint')}
                </FactLink>
              )
            }
          >
            <FactPill tone={credits.status === 'enabled' ? 'on' : 'default'}>
              {t(`claude_quota.credits_${credits.status}`)}
            </FactPill>
            {credits.limitCents !== null && (
              <span>
                {t('claude_quota.credits_spent', {
                  used: formatUsd((credits.usedCents ?? 0) / 100, language),
                  limit: formatUsd(credits.limitCents / 100, language),
                })}
              </span>
            )}
          </FactRow>
        )}
        {allowances.map((bucket) => {
          if (bucket.limitDollars === null) return null;
          const used = formatUsd(
            Math.max(bucket.limitDollars - (bucket.usedDollars ?? 0), 0),
            language
          );
          const limit = formatUsd(bucket.limitDollars, language);
          return (
            <FactRow
              key={bucket.id}
              label={t(bucket.labelKey)}
              hint={
                bucket.lockedReason
                  ? t('claude_quota.allowance_locked', { reason: bucket.lockedReason })
                  : undefined
              }
            >
              {bucket.resetAtMs !== null
                ? t('claude_quota.allowance_amount', {
                    used,
                    limit,
                    date: formatResetDate(bucket.resetAtMs, language),
                  })
                : t('claude_quota.allowance_amount_no_reset', { used, limit })}
            </FactRow>
          );
        })}
        {extraUsage && !credits && (
          <FactRow
            label={t('claude_quota.extra_usage_label')}
            hint={
              extraUsage.disabledReason
                ? t('claude_quota.extra_usage_disabled_reason', {
                    reason: extraUsage.disabledReason,
                  })
                : undefined
            }
          >
            <span>
              {t(
                extraUsage.isEnabled === null
                  ? 'claude_quota.plan_unknown'
                  : extraUsage.isEnabled
                    ? 'claude_quota.extra_usage_enabled'
                    : 'claude_quota.extra_usage_disabled'
              )}
            </span>
            <span>
              {t('claude_quota.usage_spent_limit', {
                spent: money(extraUsage.usedCredits, extraUsage.currency ?? 'USD', 100),
                limit: money(extraUsage.monthlyLimit, extraUsage.currency ?? 'USD', 100),
              })}
            </span>
          </FactRow>
        )}
        {dollarWindows.map((balance) => {
          const resetDisplay = buildResetDisplay(
            formatQuotaResetTime(balance.resetsAt ?? undefined),
            resolveResetMs([balance.resetsAt]),
            now,
            language
          );
          return (
            <FactRow
              key={balance.key}
              label={balance.key}
              aside={
                resetDisplay ? (
                  <QuotaResetLabel display={resetDisplay} classes={classes} verb="resets" />
                ) : undefined
              }
            >
              {t('claude_quota.usage_spent_limit', {
                spent: money(balance.usedDollars),
                limit: money(balance.limitDollars),
              })}
            </FactRow>
          );
        })}
        <FactRow label={t('quota_management.details_credential')}>
          <span className={classes.quotaAmount}>{file.name}</span>
        </FactRow>
        {observed && (
          <FactRow
            label={t('quota_management.details_checked')}
            tone={quota.stale ? 'warn' : 'default'}
            hint={
              quota.stale
                ? t('claude_quota.stale_snapshot', { time: observed.absolute })
                : undefined
            }
          >
            <span>{observed.relative ?? t('quota_management.just_now')}</span>
          </FactRow>
        )}
      </FactSection>

      <FactSection title={t('quota_management.details_billing')}>
        <FactRow label={t('claude_quota.billing_status_label')}>
          <FactPill tone={billingAccess === 'active' ? 'on' : 'warn'}>
            {t(`claude_quota.billing_${billingAccess}`)}
          </FactPill>
        </FactRow>
        {billingAccess !== 'active' && (
          <FactNotice>
            {t(billingNoticeKey)}
            <FactLink href={billing?.invoiceUrl ?? CLAUDE_BILLING_URL}>
              {t(
                billingAccess === 'past_due'
                  ? 'claude_quota.billing_pay_invoice'
                  : 'claude_quota.billing_manage'
              )}
            </FactLink>
          </FactNotice>
        )}
      </FactSection>

      {hasGrants ? (
        <ClaudeResetGrantDetails grants={extras.grants} classes={classes} />
      ) : (
        <FactSection
          title={t('claude_reset.section_title')}
          count={0}
          note={locked ? t('claude_reset.locked') : t('claude_reset.empty')}
        >
          {extras.grantMessage && !locked && (
            <FactNotice tone="error">{t(`claude_reset.${extras.grantMessage}`)}</FactNotice>
          )}
        </FactSection>
      )}
      {hasGrants && extras.grantMessage && (
        <FactSection title={t('claude_reset.section_title')}>
          <FactNotice tone="error">{t(`claude_reset.${extras.grantMessage}`)}</FactNotice>
        </FactSection>
      )}

      <FactSection
        title={t('claude_quota.breakdown_title')}
        note={
          quota.breakdown
            ? undefined
            : weekUsed !== null && weekUsed < 1
              ? t('claude_quota.breakdown_empty')
              : t('claude_quota.breakdown_unavailable')
        }
      >
        {quota.breakdown && (
          <ClaudeWeekBreakdown breakdown={quota.breakdown} classes={classes} bare />
        )}
      </FactSection>
    </FactSheet>
  );
}
