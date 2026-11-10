/**
 * Details drawers and plan labels per provider.
 *
 * A provider without a drawer has nothing to explain beyond its meters, so its
 * ribbon does not expand. Plan labels feed the ribbon's second identity line.
 */

import type { ComponentType } from 'react';
import type { TFunction } from 'i18next';
import type { AntigravityQuotaState, ClaudeQuotaState, CodexQuotaState } from '@/types';
import type { QuotaCardState } from './index';
import type { QuotaDetailsProps, QuotaProviderType } from './types';
import { AntigravityDetails } from './antigravity/AntigravityDetails';
import { getAntigravityPlanLabel } from './antigravity/planLabel';
import { ClaudeDetails } from './claude/ClaudeDetails';
import { CodexDetails } from './codex/CodexDetails';
import { getCodexPlanLabel } from './codex/planLabel';

export type QuotaDetailsComponent = ComponentType<QuotaDetailsProps<QuotaCardState, unknown>>;

export const QUOTA_DETAILS: Partial<Record<QuotaProviderType, QuotaDetailsComponent>> = {
  antigravity: AntigravityDetails as unknown as QuotaDetailsComponent,
  claude: ClaudeDetails as unknown as QuotaDetailsComponent,
  codex: CodexDetails as unknown as QuotaDetailsComponent,
};

export function resolvePlanLabel(
  type: QuotaProviderType,
  quota: QuotaCardState | undefined,
  t: TFunction
): string | null {
  if (!quota || quota.status !== 'success') return null;
  switch (type) {
    case 'claude': {
      const planType = (quota as ClaudeQuotaState).planType ?? null;
      return planType ? t(`claude_quota.${planType}`) : null;
    }
    case 'codex':
      return getCodexPlanLabel((quota as CodexQuotaState).planType, t);
    case 'antigravity':
      return getAntigravityPlanLabel((quota as AntigravityQuotaState).subscription, t);
    default:
      return null;
  }
}
