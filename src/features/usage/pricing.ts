/**
 * Estimated API-equivalent cost: what the same tokens would cost at pay-as-you-go prices.
 * Rates are USD per million tokens, matched by the longest model-key prefix. Reasoning
 * tokens are billed as output. Users can override rates; overrides live in localStorage.
 */

export interface ModelPrice {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

export type PricingTable = Record<string, ModelPrice>;

export interface UsageCounters {
  input: number;
  cache_read: number;
  cache_write: number;
  output: number;
  reasoning: number;
}

export const PRICING_STORAGE_KEY = 'agent-tracker.pricing';

/** Verified USD-per-million rates, as of this date. */
export const PRICING_AS_OF = '2026-10-04';

export const DEFAULT_PRICING: PricingTable = {
  'claude-fable-5-1': { input: 10, cacheRead: 0.25, cacheWrite: 12.5, output: 50 },
  'claude-fable-5': { input: 10, cacheRead: 1, cacheWrite: 12.5, output: 50 },
  'claude-opus-5-5': { input: 4, cacheRead: 0.2, cacheWrite: 5, output: 20 },
  'claude-sonnet-5-5': { input: 2, cacheRead: 0.2, cacheWrite: 2.5, output: 10 },
  'claude-haiku-4-5': { input: 1, cacheRead: 0.1, cacheWrite: 1.25, output: 5 },
  'gpt-5.6-sol': { input: 4, cacheRead: 0.4, cacheWrite: 5, output: 20 },
  'gpt-5.6-terra': { input: 2, cacheRead: 0.2, cacheWrite: 2.5, output: 12 },
  'gpt-5.6-luna': { input: 0.2, cacheRead: 0.02, cacheWrite: 0.25, output: 1.2 },
  'gpt-5.5': { input: 5, cacheRead: 0.5, cacheWrite: 0, output: 30 },
  'gpt-5.4-mini': { input: 0.75, cacheRead: 0.075, cacheWrite: 0, output: 4.5 },
  'gpt-5.4': { input: 2.5, cacheRead: 0.25, cacheWrite: 0, output: 15 },
  'gpt-5.3-codex': { input: 1.75, cacheRead: 0.175, cacheWrite: 0, output: 14 },
  'gpt-5.2': { input: 1.75, cacheRead: 0.175, cacheWrite: 0, output: 14 },
  'gpt-5.1': { input: 1.25, cacheRead: 0.125, cacheWrite: 0, output: 10 },
  'gpt-5': { input: 1.25, cacheRead: 0.125, cacheWrite: 0, output: 10 },
  'gemini-3.1-pro': { input: 2, cacheRead: 0.2, cacheWrite: 0, output: 12 },
  'gemini-3.5-flash-lite': { input: 0.3, cacheRead: 0.03, cacheWrite: 0, output: 2.5 },
  'gemini-3.5-flash': { input: 1.5, cacheRead: 0.15, cacheWrite: 0, output: 9 },
  'gemini-3.8-flash': { input: 0.75, cacheRead: 0.075, cacheWrite: 0, output: 3.75 },
  'gemini-3.7-flash': { input: 0.75, cacheRead: 0.075, cacheWrite: 0, output: 3.75 },
  'gemini-3.6-flash': { input: 0.75, cacheRead: 0.075, cacheWrite: 0, output: 3.75 },
  'gemini-3-flash': { input: 0.5, cacheRead: 0.05, cacheWrite: 0, output: 3 },
};

/** Longest-prefix match on the lower-cased model key; null when nothing matches. */
export function findPrice(model: string, table: PricingTable): ModelPrice | null {
  const key = model.trim().toLowerCase();
  let best: string | null = null;
  for (const pattern of Object.keys(table)) {
    const p = pattern.trim().toLowerCase();
    if (p && key.startsWith(p) && (best === null || p.length > best.length)) best = p;
  }
  if (best === null) return null;
  const hit = Object.entries(table).find(([pattern]) => pattern.trim().toLowerCase() === best);
  return hit ? hit[1] : null;
}

/** sum(tokens x rate) / 1e6, reasoning billed at the output rate. */
export function computeCost(counters: UsageCounters, price: ModelPrice): number {
  return (
    (counters.input * price.input +
      counters.cache_read * price.cacheRead +
      counters.cache_write * price.cacheWrite +
      (counters.output + counters.reasoning) * price.output) /
    1e6
  );
}

/** Cost for one model key, or null when the model has no price ("no price"). */
export function modelCost(model: string, counters: UsageCounters, table: PricingTable): number | null {
  const price = findPrice(model, table);
  return price ? computeCost(counters, price) : null;
}

const isRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Keeps only well-formed entries from untrusted JSON. */
export function sanitizePricing(raw: unknown): PricingTable | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out: PricingTable = {};
  for (const [pattern, value] of Object.entries(raw)) {
    const v = value as Partial<ModelPrice> | null;
    if (!pattern.trim() || !v) continue;
    if (isRate(v.input) && isRate(v.cacheRead) && isRate(v.cacheWrite) && isRate(v.output)) {
      out[pattern.trim().toLowerCase()] = {
        input: v.input,
        cacheRead: v.cacheRead,
        cacheWrite: v.cacheWrite,
        output: v.output,
      };
    }
  }
  return out;
}

/** The effective table: stored overrides when present, otherwise the defaults. */
export function loadPricing(): PricingTable {
  try {
    const stored = window.localStorage.getItem(PRICING_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PRICING };
    return sanitizePricing(JSON.parse(stored)) ?? { ...DEFAULT_PRICING };
  } catch {
    return { ...DEFAULT_PRICING };
  }
}

export function savePricing(table: PricingTable): void {
  try {
    window.localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(table));
  } catch {
    // Storage may be unavailable or full; the in-memory table still applies this session.
  }
}

export function resetPricing(): PricingTable {
  try {
    window.localStorage.removeItem(PRICING_STORAGE_KEY);
  } catch {
    // ignore
  }
  return { ...DEFAULT_PRICING };
}
