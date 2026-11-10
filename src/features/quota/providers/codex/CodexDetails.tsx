/**
 * Codex details drawer: plan, renewal, credit balance, the file, then the
 * manual reset credits as one row each with their expiry.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CodexQuotaState } from '@/types';
import {
  buildResetDisplay,
  formatInstantShort,
  parseIsoToMs,
  resolvePlanTier,
  resolveResetMs,
} from '@/utils/quota';
import { formatDateTimeValue } from '@/utils/format';
import { resolveTimeZoneLabel } from '@/utils/time/timezone';
import { useNow } from '@/hooks/useNow';
import { FactNotice, FactRow, FactSection, FactSheet } from '../../components/FactSheet';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { collectQuotaRowInstants, pickUrgentRowId, resetCreditRowId } from '../../resetSchedule';
import type { QuotaDetailsProps } from '../types';
import { getCodexPlanLabel } from './planLabel';

export function CodexDetails({ quota, file, classes }: QuotaDetailsProps<CodexQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const locale = i18n.resolvedLanguage;
  const soonestRowId = useMemo(
    () => pickUrgentRowId(collectQuotaRowInstants('codex', quota), now),
    [quota, now]
  );
  const planLabel = getCodexPlanLabel(quota.planType, t);
  const tier = resolvePlanTier(quota.planType);
  const planClass =
    tier === 'elite'
      ? classes.elitePlanValue
      : tier === 'premium'
        ? classes.premiumPlanValue
        : undefined;
  const renewalMs = resolveResetMs([quota.subscriptionActiveUntil ?? null]);
  const renewal = quota.subscriptionActiveUntil
    ? buildResetDisplay(
        renewalMs === null ? formatDateTimeValue(quota.subscriptionActiveUntil) : null,
        renewalMs,
        now,
        locale
      )
    : null;
  const credits = quota.rateLimitResetCredits ?? [];
  const available = quota.rateLimitResetCreditsAvailableCount ?? null;

  return (
    <FactSheet>
      <FactSection title={t('quota_management.details_account')}>
        {planLabel && (
          <FactRow label={t('codex_quota.plan_label')}>
            <span className={planClass}>{planLabel}</span>
          </FactRow>
        )}
        {renewal && (
          <FactRow label={t('codex_quota.expires_label')}>
            <QuotaResetLabel display={renewal} classes={classes} />
          </FactRow>
        )}
        {(quota.creditsUnlimited || (quota.creditBalance ?? null) !== null) && (
          <FactRow label={t('codex_quota.credit_balance_label')}>
            {quota.creditsUnlimited ? t('codex_quota.credit_unlimited') : quota.creditBalance}
          </FactRow>
        )}
        <FactRow label={t('quota_management.details_credential')}>
          <span className={classes.quotaAmount}>{file.name}</span>
        </FactRow>
      </FactSection>

      {(credits.length > 0 || available !== null || quota.rateLimitResetCreditsError) && (
        <FactSection
          title={t('codex_quota.reset_credits_label')}
          count={available}
          note={
            credits.length > 0
              ? t('codex_quota.reset_credits_expiry_label', { timezone: resolveTimeZoneLabel() })
              : undefined
          }
        >
          {credits.map((credit, index) => {
            const expiresAtMs = parseIsoToMs(credit.expiresAt);
            const display = buildResetDisplay(
              expiresAtMs === null ? credit.expiresAt : formatInstantShort(expiresAtMs),
              expiresAtMs,
              now,
              locale
            );
            const rowId = resetCreditRowId(credit, index);
            const soon = rowId === soonestRowId;
            return (
              <FactRow
                key={rowId}
                label={t('codex_quota.reset_credit_number', { index: index + 1 })}
                tone={soon ? 'warn' : 'default'}
                title={soon ? t('quota_management.soonest_row_hint') : undefined}
                aside={
                  display ? (
                    <QuotaResetLabel
                      display={display}
                      classes={classes}
                      soon={soon}
                      verb="expires"
                    />
                  ) : undefined
                }
              />
            );
          })}
          {quota.rateLimitResetCreditsError && (
            <FactNotice tone="error">
              {t('codex_quota.reset_credits_expiry_failed', {
                message: quota.rateLimitResetCreditsError,
              })}
            </FactNotice>
          )}
        </FactSection>
      )}
    </FactSheet>
  );
}
