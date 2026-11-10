import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import type { AnthropicResetGrant } from '@/services/api/claudeResetGrants';
import { buildResetDisplay, parseIsoToMs } from '@/utils/quota';
import { resolveTimeZoneLabel } from '@/utils/time/timezone';
import { FactRow, FactSection } from '../../components/FactSheet';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import type { QuotaClassMap } from '../../types';
import { describeResetGrant, describeResetUses, describeResetWindows } from './resetGrantLabels';

interface ClaudeResetGrantDetailsProps {
  grants: readonly AnthropicResetGrant[];
  classes: QuotaClassMap;
}

/** Free reset grants as one fact-sheet section: a row per unspent grant, soonest expiry first. */
export function ClaudeResetGrantDetails({ grants, classes }: ClaudeResetGrantDetailsProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const remaining = grants
    .filter((grant) => grant.resetsLeft > 0)
    .sort((a, b) => (parseIsoToMs(a.endsAt) ?? Infinity) - (parseIsoToMs(b.endsAt) ?? Infinity));

  if (remaining.length === 0) return null;
  const left = remaining.reduce((sum, grant) => sum + grant.resetsLeft, 0);

  return (
    <FactSection
      title={t('claude_reset.section_title')}
      count={left}
      note={t('claude_reset.details_hint', { timezone: resolveTimeZoneLabel() })}
    >
      {remaining.map((grant, index) => {
        const display = buildResetDisplay(
          null,
          parseIsoToMs(grant.endsAt),
          now,
          i18n.resolvedLanguage
        );
        return (
          <FactRow
            key={grant.id}
            label={describeResetGrant(grant, index, t)}
            title={grant.label || undefined}
            aside={
              display ? (
                <QuotaResetLabel display={display} classes={classes} verb="expires" />
              ) : (
                t('claude_reset.expiry_unknown')
              )
            }
          >
            <span>{describeResetWindows(grant, t)}</span>
            <span>{describeResetUses(grant, t)}</span>
          </FactRow>
        );
      })}
    </FactSection>
  );
}
