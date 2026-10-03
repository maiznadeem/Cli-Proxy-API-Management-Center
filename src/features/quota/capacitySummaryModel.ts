/**
 * Capacity summary derivation. Pure functions so the strip can be tested without React.
 */

import { getQuotaCacheKey, getQuotaDisplayName } from '@/utils/quota/identity';
import { QUOTA_TAB_ORDER } from './constants';
import type { QuotaFileEntry } from './logic';
import type { QuotaCardState } from './providers';
import type { QuotaProviderType } from './providers/types';
import { buildTimelineLane, type TimelineLane } from './quotaTimelineModel';

export interface ProviderCapacity {
  provider: QuotaProviderType;
  total: number;
  loaded: number;
  /** Sum of remaining percent over loaded credentials, 0..loaded*100. */
  remainingSum: number;
  /** Per-credential remaining percent in list order; null when not loaded. */
  segments: Array<number | null>;
  /** Soonest reset instant among loaded credentials. */
  nextResetMs: number | null;
  /** Label of the headline window (for example "7-day Fable 5" or "Weekly limit"). */
  headlineLabel: string | null;
}

const pickHeadline = (lane: TimelineLane): { remaining: number | null; label: string | null } => {
  if (lane.provider === 'claude') {
    const fable = lane.limits.find((limit) => /fable/i.test(limit.label));
    if (fable) return { remaining: fable.remaining, label: fable.label };
  }
  if (lane.remaining !== null) {
    const match = lane.limits.find((limit) => limit.remaining === lane.remaining);
    return { remaining: lane.remaining, label: match?.label ?? null };
  }
  const first = lane.limits[0];
  return first ? { remaining: first.remaining, label: first.label } : { remaining: null, label: null };
};

export function summarizeCapacity(
  entries: QuotaFileEntry[],
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined
): ProviderCapacity[] {
  const byProvider = new Map<QuotaProviderType, ProviderCapacity>();
  for (const entry of entries) {
    const current = byProvider.get(entry.type) ?? {
      provider: entry.type,
      total: 0,
      loaded: 0,
      remainingSum: 0,
      segments: [],
      nextResetMs: null,
      headlineLabel: null,
    };
    current.total += 1;
    const lane = buildTimelineLane({
      name: getQuotaCacheKey(entry.file),
      displayName: getQuotaDisplayName(entry.file),
      provider: entry.type,
      quota: quotaFor(entry),
    });
    const headline = pickHeadline(lane);
    if (headline.remaining !== null) {
      current.loaded += 1;
      current.remainingSum += headline.remaining;
      current.headlineLabel ??= headline.label;
    }
    current.segments.push(headline.remaining);
    if (lane.anchorMs !== null && lane.anchorMs > 0) {
      current.nextResetMs =
        current.nextResetMs === null ? lane.anchorMs : Math.min(current.nextResetMs, lane.anchorMs);
    }
    byProvider.set(entry.type, current);
  }
  return QUOTA_TAB_ORDER.filter((type) => byProvider.has(type)).map(
    (type) => byProvider.get(type) as ProviderCapacity
  );
}

