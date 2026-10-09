import type { UsageBucket, UsageStatsResponse } from '@/services/api/usageStats';
import { computeCost, resolvePrice, type PricingTable, type UsageCounters } from './pricing';

export type UsageRange = 'today' | '7d' | '30d' | 'all';
export const USAGE_RANGES: readonly UsageRange[] = ['today', '7d', '30d', 'all'];

/** Start of the range as RFC3339, or undefined for "all". Days are local calendar days. */
export function rangeSince(range: UsageRange, now = new Date()): string | undefined {
  if (range === 'all') return undefined;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === '7d') start.setDate(start.getDate() - 6);
  if (range === '30d') start.setDate(start.getDate() - 29);
  return start.toISOString();
}

/** 12.4k, 3.2M, 1.1B; plain integers below 1000. */
export function formatTokens(value: number): string {
  const n = Math.abs(value);
  const units: Array<[number, string]> = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const scaled = value / size;
      const digits = Math.abs(scaled) >= 100 ? 0 : 1;
      return `${scaled.toFixed(digits).replace(/\.0$/, '')}${suffix}`;
    }
  }
  return String(Math.round(value));
}

export function formatUsd(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface CostEstimate {
  /** null when no price applies. */
  value: number | null;
  /** True when derived from blended rates or a family fallback rather than an exact row. */
  approx: boolean;
}

const NO_PRICE: CostEstimate = { value: null, approx: false };

/**
 * Blended per-class rates (USD per million) over priced models, optionally limited to one
 * provider. Buckets that carry no model (accounts, client keys, days) use these.
 */
export function blendedPrice(
  byModel: UsageBucket[],
  table: PricingTable,
  provider?: string
): { input: number; cacheRead: number; cacheWrite: number; output: number } | null {
  const tokens = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  const spend = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  let priced = false;
  for (const row of byModel) {
    if (provider && row.provider && row.provider !== provider) continue;
    const match = resolvePrice(row.key, table);
    if (!match) continue;
    const price = match.price;
    priced = true;
    const out = row.output + row.reasoning;
    tokens.input += row.input;
    tokens.cacheRead += row.cache_read;
    tokens.cacheWrite += row.cache_write;
    tokens.output += out;
    spend.input += row.input * price.input;
    spend.cacheRead += row.cache_read * price.cacheRead;
    spend.cacheWrite += row.cache_write * price.cacheWrite;
    spend.output += out * price.output;
  }
  if (!priced) return null;
  const rate = (s: number, n: number) => (n > 0 ? s / n : 0);
  return {
    input: rate(spend.input, tokens.input),
    cacheRead: rate(spend.cacheRead, tokens.cacheRead),
    cacheWrite: rate(spend.cacheWrite, tokens.cacheWrite),
    output: rate(spend.output, tokens.output),
  };
}

export type BucketKind = 'model' | 'credential' | 'api_key' | 'session' | 'day';

export function estimateBucket(
  kind: BucketKind,
  bucket: UsageBucket,
  data: UsageStatsResponse,
  table: PricingTable
): CostEstimate {
  const counters: UsageCounters = bucket;
  if (kind === 'model') {
    const match = resolvePrice(bucket.key, table);
    return match ? { value: computeCost(counters, match.price), approx: match.fallback } : NO_PRICE;
  }
  if (kind === 'session' && bucket.models?.length === 1) {
    const match = resolvePrice(bucket.models[0], table);
    return match ? { value: computeCost(counters, match.price), approx: match.fallback } : NO_PRICE;
  }
  const blended = blendedPrice(
    data.by_model,
    table,
    kind === 'credential' ? bucket.provider : undefined
  );
  return blended ? { value: computeCost(counters, blended), approx: true } : NO_PRICE;
}

/**
 * Sum of per-model costs. Models without any price are counted in `unpriced`; models
 * priced through a family fallback are counted in `estimated`.
 */
export function estimateTotal(
  data: UsageStatsResponse,
  table: PricingTable
): { value: number; unpriced: number; estimated: number } {
  let value = 0;
  let unpriced = 0;
  let estimated = 0;
  for (const row of data.by_model) {
    const match = resolvePrice(row.key, table);
    if (!match) {
      unpriced += 1;
      continue;
    }
    value += computeCost(row, match.price);
    if (match.fallback) estimated += 1;
  }
  return { value, unpriced, estimated };
}

export const sortByTotalDesc = (rows: UsageBucket[]): UsageBucket[] =>
  [...rows].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));

export function truncateMiddle(value: string, max = 16): string {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}
