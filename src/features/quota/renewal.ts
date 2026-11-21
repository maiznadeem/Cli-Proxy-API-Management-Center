/**
 * Subscription renewal dates, shared by the Capacity card, the details drawer
 * and the quota-windows timeline.
 *
 * Codex reports the instant the paid period ends (`subscriptionActiveUntil`).
 * Anthropic reports no billing date at all, only when the subscription started,
 * so a Claude renewal is the next monthly anniversary of that start: exact for
 * monthly plans, which is what Max is sold as, and flagged as an estimate.
 * Other providers expose nothing and get no renewal.
 */
import { resolveResetMs } from '@/utils/quota';

export type QuotaRenewalSource =
  { kind: 'exact'; atMs: number } | { kind: 'monthly'; startedAtMs: number };

export interface QuotaRenewalInfo {
  source: QuotaRenewalSource;
  /** Auto-renew is off: the date is when access ends, not when it renews. */
  ending: boolean;
}

export interface QuotaRenewal {
  atMs: number;
  estimated: boolean;
  ending: boolean;
}

const daysInUtcMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * First monthly anniversary of `startedAtMs` strictly after `afterMs`. A start
 * on the 31st renews on the last day of shorter months, as card billing does.
 */
export function nextMonthlyAnniversary(startedAtMs: number, afterMs: number): number | null {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(afterMs)) return null;
  const start = new Date(startedAtMs);
  const day = start.getUTCDate();
  const timeOfDay = startedAtMs - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day);
  const after = new Date(Math.max(afterMs, startedAtMs));
  let year = after.getUTCFullYear();
  let month = after.getUTCMonth() - 1;
  for (let step = 0; step < 4; step += 1) {
    const at = Date.UTC(year, month, Math.min(day, daysInUtcMonth(year, month))) + timeOfDay;
    if (at > afterMs && at > startedAtMs) return at;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return null;
}

/** Where a credential's renewal date comes from, or null when the provider reports none. */
export function resolveRenewalInfo(provider: string, quota: unknown): QuotaRenewalInfo | null {
  if (!quota || typeof quota !== 'object') return null;
  if (provider === 'codex') {
    const atMs = resolveResetMs([
      (quota as { subscriptionActiveUntil?: unknown }).subscriptionActiveUntil ?? null,
    ]);
    return atMs === null ? null : { source: { kind: 'exact', atMs }, ending: false };
  }
  if (provider === 'claude') {
    const claude = quota as {
      subscriptionCreatedAt?: string | null;
      billing?: { access?: string } | null;
    };
    const startedAtMs = resolveResetMs([claude.subscriptionCreatedAt ?? null]);
    if (startedAtMs === null) return null;
    const access = claude.billing?.access;
    return {
      source: { kind: 'monthly', startedAtMs },
      ending: access === 'ending' || access === 'inactive',
    };
  }
  return null;
}

/** The next renewal (or end of access) at or after `fromMs`. */
export function renewalAfter(info: QuotaRenewalInfo, fromMs: number): QuotaRenewal | null {
  if (info.source.kind === 'exact') {
    return info.source.atMs > fromMs
      ? { atMs: info.source.atMs, estimated: false, ending: info.ending }
      : null;
  }
  const atMs = nextMonthlyAnniversary(info.source.startedAtMs, fromMs);
  return atMs === null ? null : { atMs, estimated: true, ending: info.ending };
}

/** Next renewal for a credential's quota state, or null. */
export function resolveQuotaRenewal(
  provider: string,
  quota: unknown,
  now: number
): QuotaRenewal | null {
  const info = resolveRenewalInfo(provider, quota);
  return info ? renewalAfter(info, now) : null;
}

/** Day and month only, in the viewer's order ("14/12" or "12/14"). */
export function formatRenewalDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
}
