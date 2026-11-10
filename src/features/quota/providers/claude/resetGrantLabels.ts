/**
 * Anthropic labels grants with campaign copy ("New model launch: one more Fable
 * reset at 12 months' tenure"). The id carries the same facts in a stable shape,
 * so derive a short label from it and keep the copy only as a tooltip.
 */

import type { TFunction } from 'i18next';
import type { AnthropicResetGrant } from '@/services/api/claudeResetGrants';

export const describeResetGrant = (
  grant: AnthropicResetGrant,
  index: number,
  t: TFunction
): string => {
  const tenure = /-(\d+)mo$/.exec(grant.id);
  if (tenure) return t('claude_reset.label_tenure', { months: Number(tenure[1]) });
  if (grant.id.startsWith('launch-')) return t('claude_reset.label_launch');
  return grant.label || t('claude_reset.grant_number', { index: index + 1 });
};

/** The usage windows a grant clears, named once each. */
export const describeResetWindows = (grant: AnthropicResetGrant, t: TFunction): string => {
  const names = new Set(grant.clears.map((window) => t(`claude_reset.window_${window}`)));
  return names.size > 0 ? [...names].join(', ') : t('claude_reset.window_unknown');
};

export const describeResetUses = (grant: AnthropicResetGrant, t: TFunction): string =>
  grant.resetsTotal === 1
    ? t('claude_reset.one_left')
    : t('claude_reset.count', { left: grant.resetsLeft, total: grant.resetsTotal });
