import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import {
  buildClaudeAllowances,
  deriveClaudeCredits,
} from '@/features/quota/providers/claude/data';
import type { ClaudeUsagePayload } from '@/types';

const t = ((key: string) => key) as TFunction;

const spendA = {
  used: { amount_minor: 0, currency: 'USD', exponent: 2 },
  limit: { amount_minor: 10000, currency: 'USD', exponent: 2 },
  percent: 0,
  enabled: false,
  can_purchase_credits: false,
  can_toggle: false,
};

describe('Claude usage credits status', () => {
  test('payload A: off, out of credits, with a $100 cap', () => {
    const credits = deriveClaudeCredits({
      extra_usage: {
        is_enabled: false,
        monthly_limit: 10000,
        used_credits: 0,
        utilization: 0,
        currency: 'USD',
        decimal_places: 2,
        disabled_reason: 'out_of_credits',
        user_disabled: false,
        spend_limit_reached: false,
        credits_ever_enabled: true,
      },
      spend: spendA,
    });
    expect(credits).toEqual({
      status: 'off_out_of_credits',
      usedCents: 0,
      limitCents: 10000,
      canToggle: false,
    });
  });

  test('payload B: never enabled, no amounts', () => {
    const credits = deriveClaudeCredits({
      extra_usage: {
        is_enabled: false,
        monthly_limit: null,
        used_credits: null,
        disabled_reason: null,
        user_disabled: false,
        credits_ever_enabled: false,
      },
    });
    expect(credits).toEqual({
      status: 'never_enabled',
      usedCents: null,
      limitCents: null,
      canToggle: false,
    });
  });

  test('is_enabled wins over every disabled flag', () => {
    const credits = deriveClaudeCredits({
      extra_usage: {
        is_enabled: true,
        monthly_limit: 5000,
        used_credits: 1250,
        disabled_reason: 'out_of_credits',
        user_disabled: true,
        spend_limit_reached: true,
        credits_ever_enabled: false,
      },
    });
    expect(credits.status).toBe('enabled');
    expect(credits.usedCents).toBe(1250);
    expect(credits.limitCents).toBe(5000);
  });

  test('disabled flags follow the documented precedence', () => {
    const base = { is_enabled: false, monthly_limit: null, used_credits: null };
    const status = (extra: Record<string, unknown>) =>
      deriveClaudeCredits({ extra_usage: { ...base, ...extra } } as ClaudeUsagePayload).status;

    expect(
      status({ disabled_reason: 'out_of_credits', user_disabled: true, spend_limit_reached: true })
    ).toBe('off_out_of_credits');
    expect(status({ user_disabled: true, spend_limit_reached: true })).toBe('off_user_disabled');
    expect(status({ spend_limit_reached: true, credits_ever_enabled: false })).toBe(
      'off_limit_reached'
    );
    expect(status({ credits_ever_enabled: false })).toBe('never_enabled');
    expect(status({ credits_ever_enabled: true })).toBe('unknown');
  });

  test('missing extra_usage is unknown; spend supplies amounts and can_toggle', () => {
    expect(deriveClaudeCredits({}).status).toBe('unknown');
    const credits = deriveClaudeCredits({
      extra_usage: { is_enabled: true, monthly_limit: null, used_credits: null },
      spend: { ...spendA, used: { amount_minor: 125, exponent: 2 }, can_toggle: true },
    });
    expect(credits).toEqual({
      status: 'enabled',
      usedCents: 125,
      limitCents: 10000,
      canToggle: true,
    });
  });
});

describe('Claude monthly credit allowance', () => {
  test('maps iguana_necktie to a dollar bucket', () => {
    const resetsAt = '2026-11-05T07:59:00+00:00';
    const [bucket, ...rest] = buildClaudeAllowances(
      {
        iguana_necktie: {
          utilization: 0,
          resets_at: resetsAt,
          limit_dollars: 250,
          used_dollars: 0,
          remaining_dollars: 250,
          locked_reason: null,
        },
      },
      t
    );
    expect(rest).toEqual([]);
    expect(bucket).toEqual({
      id: 'monthly-allowance',
      label: 'claude_quota.monthly_allowance',
      labelKey: 'claude_quota.monthly_allowance',
      usedDollars: 0,
      limitDollars: 250,
      remainingDollars: 250,
      resetAtMs: Date.parse(resetsAt),
      lockedReason: null,
    });
  });

  test('is empty when the bucket is null or absent', () => {
    expect(buildClaudeAllowances({ iguana_necktie: null }, t)).toEqual([]);
    expect(buildClaudeAllowances({}, t)).toEqual([]);
  });
});
