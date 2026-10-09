import { describe, expect, test } from 'bun:test';
import {
  computeCost,
  DEFAULT_PRICING,
  findPrice,
  resolvePrice,
  modelCost,
  sanitizePricing,
} from '@/features/usage/pricing';
import { estimateBucket, estimateTotal, formatTokens, formatUsd } from '@/features/usage/model';
import type { UsageBucket, UsageStatsResponse } from '@/services/api/usageStats';

const bucket = (key: string, over: Partial<UsageBucket> = {}): UsageBucket => ({
  key,
  requests: 1,
  failed: 0,
  input: 0,
  cache_read: 0,
  cache_write: 0,
  output: 0,
  reasoning: 0,
  total: 0,
  ...over,
});

describe('findPrice', () => {
  test('longest prefix wins', () => {
    expect(findPrice('claude-fable-5-1', DEFAULT_PRICING)).toBe(
      DEFAULT_PRICING['claude-fable-5-1']
    );
    expect(findPrice('claude-fable-5-1-20261001', DEFAULT_PRICING)).toBe(
      DEFAULT_PRICING['claude-fable-5-1']
    );
    expect(findPrice('claude-fable-5', DEFAULT_PRICING)).toBe(DEFAULT_PRICING['claude-fable-5']);
    expect(findPrice('gpt-5.3-codex', DEFAULT_PRICING)).toBe(DEFAULT_PRICING['gpt-5.3-codex']);
    expect(findPrice('gpt-5.4-mini', DEFAULT_PRICING)).toBe(DEFAULT_PRICING['gpt-5.4-mini']);
    expect(findPrice('gemini-3.5-flash-lite', DEFAULT_PRICING)).toBe(
      DEFAULT_PRICING['gemini-3.5-flash-lite']
    );
    expect(findPrice('gpt-5-mini', DEFAULT_PRICING)).toBe(DEFAULT_PRICING['gpt-5']);
  });

  test('is case-insensitive and null when nothing matches', () => {
    expect(findPrice('GPT-5.5', DEFAULT_PRICING)).toBe(DEFAULT_PRICING['gpt-5.5']);
    expect(findPrice('mystery-model', DEFAULT_PRICING)).toBeNull();
    expect(resolvePrice('mystery-model', DEFAULT_PRICING)).toBeNull();
    // A brand-new model id inherits its family's newest rate, flagged as a fallback.
    expect(resolvePrice('claude-opus-6', DEFAULT_PRICING)).toEqual({
      price: DEFAULT_PRICING['claude-opus-5-5'],
      fallback: true,
    });
    expect(resolvePrice('gpt-6-nova', DEFAULT_PRICING)).toEqual({
      price: DEFAULT_PRICING['gpt-5.6-sol'],
      fallback: true,
    });
    expect(resolvePrice('claude-opus-5-5', DEFAULT_PRICING)).toEqual({
      price: DEFAULT_PRICING['claude-opus-5-5'],
      fallback: false,
    });
    expect(modelCost('mystery-model', bucket('x', { input: 5 }), DEFAULT_PRICING)).toBeNull();
  });
});

describe('computeCost', () => {
  test('sums tokens x rate per million and bills reasoning as output', () => {
    const price = { input: 10, cacheRead: 1, cacheWrite: 12.5, output: 50 };
    const cost = computeCost(
      {
        input: 1_000_000,
        cache_read: 2_000_000,
        cache_write: 400_000,
        output: 100_000,
        reasoning: 100_000,
      },
      price
    );
    // 10 + 2 + 5 + (200k * 50 / 1e6 = 10)
    expect(cost).toBeCloseTo(27, 10);
  });

  test('uses user overrides in place of defaults', () => {
    const table = { 'claude-fable-5': { input: 1, cacheRead: 0, cacheWrite: 0, output: 2 } };
    expect(
      modelCost('claude-fable-5-1', bucket('k', { input: 1e6, output: 1e6 }), table)
    ).toBeCloseTo(3);
  });
});

describe('bucket estimates', () => {
  const data = {
    totals: {} as UsageStatsResponse['totals'],
    by_model: [
      bucket('claude-fable-5-1', { provider: 'claude', input: 1e6, total: 1e6 }),
      bucket('mystery', { provider: 'x', input: 1e6, total: 1e6 }),
    ],
    by_credential: [],
    by_api_key: [],
    by_session: [],
    by_day: [],
  } as UsageStatsResponse;

  test('total prices known models and counts unpriced ones', () => {
    const total = estimateTotal(data, DEFAULT_PRICING);
    expect(total.value).toBeCloseTo(10);
    expect(total.unpriced).toBe(1);
  });

  test('single-model sessions are exact, others are approximate', () => {
    const single = estimateBucket(
      'session',
      bucket('s', { models: ['claude-fable-5-1'], input: 1e6 }),
      data,
      DEFAULT_PRICING
    );
    expect(single).toEqual({ value: 10, approx: false });
    const day = estimateBucket('day', bucket('2026-10-03', { input: 1e6 }), data, DEFAULT_PRICING);
    expect(day.approx).toBe(true);
    expect(day.value).toBeCloseTo(10);
  });
});

describe('formatting and storage', () => {
  test('formats tokens and dollars', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(12_400)).toBe('12.4k');
    expect(formatTokens(3_200_000)).toBe('3.2M');
    expect(formatUsd(0.001)).toBe('<$0.01');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
  });

  test('sanitizePricing drops malformed rows', () => {
    const table = sanitizePricing({
      Good: { input: 1, cacheRead: 0, cacheWrite: 0, output: 2 },
      bad: { input: -1, cacheRead: 0, cacheWrite: 0, output: 2 },
      worse: 'x',
    });
    expect(Object.keys(table ?? {})).toEqual(['good']);
    expect(sanitizePricing([])).toBeNull();
  });
});
