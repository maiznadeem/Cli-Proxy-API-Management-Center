import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNow } from '@/hooks/useNow';
import type { AnthropicResetGrant } from '@/services/api/claudeResetGrants';
import { buildResetDisplay, parseIsoToMs } from '@/utils/quota';
import { resolveTimeZoneLabel } from '@/utils/time/timezone';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import type { QuotaClassMap } from '../../types';

interface ClaudeResetGrantDetailsProps {
  grants: readonly AnthropicResetGrant[];
  classes: QuotaClassMap;
}

/**
 * Anthropic labels grants with campaign copy ("New model launch: one more Fable
 * reset at 12 months' tenure"). The id carries the same facts in a stable
 * shape, so derive a short label from it and keep the copy only as a fallback.
 */
const describeResetGrant =(grant: AnthropicResetGrant, index: number, t: TFunction) => {
  const tenure = /-(\d+)mo$/.exec(grant.id);
  if (tenure) return t('claude_reset.label_tenure', { months: Number(tenure[1]) });
  if (grant.id.startsWith('launch-')) return t('claude_reset.label_launch');
  return grant.label || t('claude_reset.grant_number', { index: index + 1 });
};

const describeWindows = (grant: AnthropicResetGrant, t: TFunction) => {
  const names = new Set(grant.clears.map((window) => t(`claude_reset.window_${window}`)));
  return names.size > 0 ? [...names].join(', ') : t('claude_reset.window_unknown');
};

/** Match Codex's reset-credit details without treating a multi-reset grant as one credit. */
export function ClaudeResetGrantDetails({ grants, classes }: ClaudeResetGrantDetailsProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const remaining = grants
    .filter((grant) => grant.resetsLeft > 0)
    .sort((a, b) => (parseIsoToMs(a.endsAt) ?? Infinity) - (parseIsoToMs(b.endsAt) ?? Infinity));

  if (remaining.length === 0) return null;
  const left = remaining.reduce((sum, grant) => sum + grant.resetsLeft, 0);

  return (
    <div className={classes.codexResetCredits}>
      <div className={classes.codexResetCreditsTitle}>
        {t('claude_reset.details_title', { count: left })}
      </div>
      <div className={classes.quotaReset}>
        {t('claude_reset.details_hint', { timezone: resolveTimeZoneLabel() })}
      </div>
      {remaining.map((grant, index) => {
        const display = buildResetDisplay(
          null,
          parseIsoToMs(grant.endsAt),
          now,
          i18n.resolvedLanguage
        );
        const uses =
          grant.resetsTotal === 1
            ? t('claude_reset.one_left')
            : t('claude_reset.count', { left: grant.resetsLeft, total: grant.resetsTotal });
        return (
          <div key={grant.id} className={classes.codexResetCreditRow}>
            <span className={classes.codexResetCreditLabel} title={grant.label || undefined}>
              {describeResetGrant(grant, index, t)}
              {' · '}
              {describeWindows(grant, t)}
              {' · '}
              {uses}
            </span>
            <span className={classes.codexResetCreditTime}>
              {display ? (
                <QuotaResetLabel display={display} classes={classes} verb="expires" />
              ) : (
                <span className={classes.quotaReset}>{t('claude_reset.expiry_unknown')}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
