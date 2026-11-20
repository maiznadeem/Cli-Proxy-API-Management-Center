/**
 * Codex details drawer: plan, renewal, credit balance, the file, then the
 * manual reset credits as one row each with their expiry.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CodexCreditOverageEntry, CodexQuotaState } from '@/types';
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
import { FactNotice, FactPill, FactRow, FactSection, FactSheet } from '../../components/FactSheet';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { collectQuotaRowInstants, pickUrgentRowId, resetCreditRowId } from '../../resetSchedule';
import type { QuotaDetailsProps } from '../types';
import {
  formatCodexCreditOverageConfirmedAt,
  resolveCodexCreditOverageState,
} from './creditOverage';
import { getCodexPlanLabel } from './planLabel';

export interface CodexDetailsExtras {
  /** Account-level "credits after the usage limit" setting; null when this credential can't carry it. */
  creditOverage?: { entry: CodexCreditOverageEntry | undefined } | null;
}

export function CodexDetails({
  quota,
  file,
  classes,
  extras,
}: QuotaDetailsProps<CodexQuotaState, CodexDetailsExtras>) {
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
  const overage = extras?.creditOverage ?? null;
  const overageState = overage ? resolveCodexCreditOverageState(overage.entry) : null;

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
        {overage && overageState && (
          <FactRow
            label={t('codex_quota.credit_overage_label')}
            hint={
              overage.entry?.status === 'known'
                ? t('codex_quota.credit_overage_confirmed_at', {
                    time: formatCodexCreditOverageConfirmedAt(overage.entry.at),
                  })
                : undefined
            }
          >
            <FactPill
              tone={
                overageState === 'allowed'
                  ? 'on'
                  : overageState === 'unconfirmed'
                    ? 'warn'
                    : 'default'
              }
            >
              {t(`codex_quota.credit_overage_state_${overageState}`)}
            </FactPill>
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
