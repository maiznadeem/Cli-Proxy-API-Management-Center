import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import {
  buildLockedClaudeWindows,
  resolveClaudeBilling,
} from '@/features/quota/providers/claude/data';
import {
  classifyQuotaFailure,
  createStatusError,
  getQuotaFailureFromError,
  parseRetryAfterSeconds,
  resolveQuotaErrorMessage,
} from '@/utils/quota';
import type { ApiCallResult } from '@/services/api/apiCall';

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as unknown as TFunction;

const INVOICE_URL = 'https://claude.ai/settings/billing?action=pay_overdue_invoice';

const pastDueProfile = {
  account: { has_claude_max: true, has_claude_pro: false },
  organization: {
    organization_type: 'claude_max',
    subscription_status: 'past_due',
    payment_auth_hosted_invoice_url: INVOICE_URL,
  },
};

const result = (statusCode: number, body: unknown, header: Record<string, string[]> = {}) =>
  ({
    statusCode,
    header,
    body,
    bodyText: typeof body === 'string' ? body : JSON.stringify(body ?? ''),
  }) satisfies ApiCallResult;

describe('Claude billing standing', () => {
  test('reads a past-due subscription and its invoice link from the profile', () => {
    expect(resolveClaudeBilling(pastDueProfile)).toEqual({
      access: 'past_due',
      subscriptionStatus: 'past_due',
      invoiceUrl: INVOICE_URL,
    });
  });

  test.each([
    ['active', 'active'],
    ['trialing', 'active'],
    ['unpaid', 'past_due'],
    ['canceled', 'inactive'],
    ['INACTIVE', 'inactive'],
  ])('maps subscription status %s to %s', (status, access) => {
    expect(
      resolveClaudeBilling({ organization: { subscription_status: status } })?.access
    ).toBe(access);
  });

  test('treats an unknown status with an invoice link as past due', () => {
    expect(
      resolveClaudeBilling({
        organization: { subscription_status: 'mystery', payment_auth_hosted_invoice_url: INVOICE_URL },
      })?.access
    ).toBe('past_due');
  });

  test('returns null when the profile carries no billing signal', () => {
    expect(resolveClaudeBilling(null)).toBeNull();
    expect(resolveClaudeBilling({ account: { has_claude_max: true } })).toBeNull();
  });

  test('locked windows read 0% remaining with no reset to count down to', () => {
    const windows = buildLockedClaudeWindows(t);
    expect(windows.map((w) => w.id)).toEqual(['five-hour', 'seven-day']);
    for (const window of windows) {
      expect(window.usedPercent).toBe(100);
      expect(window.resetAtMs).toBeNull();
      expect(window.locked).toBe(true);
    }
    expect(windows[0].periodHours).toBe(5);
    expect(windows[1].periodHours).toBe(24 * 7);
  });
});

describe('Quota failure classification', () => {
  test('a 403 that names OAuth is an org policy, not a bad token', () => {
    const failure = classifyQuotaFailure(
      result(403, {
        error: {
          type: 'permission_error',
          message: 'OAuth authentication is currently not allowed for this organization.',
          error_code: 'oauth_not_allowed_for_organization',
        },
      })
    );
    expect(failure).toEqual({
      kind: 'oauth_blocked',
      code: 'oauth_not_allowed_for_organization',
      retryAfterSeconds: null,
    });
    expect(resolveQuotaErrorMessage(t, 403, 'raw', failure)).toBe(
      'common.quota_failure_oauth_blocked'
    );
  });

  test('a plain 403 keeps the generic credential hint', () => {
    const failure = classifyQuotaFailure(result(403, { error: { type: 'permission_error' } }));
    expect(failure.kind).toBe('forbidden');
    expect(resolveQuotaErrorMessage(t, 403, 'raw', failure)).toBe('common.quota_failure_forbidden');
    expect(resolveQuotaErrorMessage(t, 403, 'raw')).toBe('common.quota_check_credential');
  });

  test('a 429 carries Retry-After as minutes', () => {
    const failure = classifyQuotaFailure(
      result(
        429,
        { error: { type: 'rate_limit_error', message: 'Rate limited.' } },
        { 'Retry-After': ['3593'] }
      )
    );
    expect(failure).toEqual({ kind: 'rate_limited', code: 'rate_limit_error', retryAfterSeconds: 3593 });
    expect(resolveQuotaErrorMessage(t, 429, 'raw', failure)).toBe(
      'common.quota_failure_rate_limited_retry:{"minutes":60}'
    );
  });

  test('a 429 without Retry-After uses the open-ended message', () => {
    const failure = classifyQuotaFailure(result(429, 'Too many requests'));
    expect(resolveQuotaErrorMessage(t, 429, 'raw', failure)).toBe(
      'common.quota_failure_rate_limited'
    );
  });

  test.each([
    [401, 'unauthorized'],
    [500, 'upstream'],
    [503, 'upstream'],
    [418, 'unknown'],
  ])('status %i classifies as %s', (status, kind) => {
    expect(classifyQuotaFailure(result(status, '')).kind).toBe(kind);
  });

  test('an unknown kind falls back to the raw message and 404 still wins', () => {
    const failure = classifyQuotaFailure(result(418, ''));
    expect(resolveQuotaErrorMessage(t, 418, 'raw', failure)).toBe('raw');
    expect(resolveQuotaErrorMessage(t, 404, 'raw', failure)).toBe('common.quota_update_required');
  });

  test('Retry-After accepts an HTTP date', () => {
    const now = Date.parse('2026-10-20T07:00:00Z');
    expect(parseRetryAfterSeconds('Tue, 20 Oct 2026 07:10:00 GMT', now)).toBe(600);
    expect(parseRetryAfterSeconds('garbage', now)).toBeNull();
    expect(parseRetryAfterSeconds(null, now)).toBeNull();
  });

  test('the failure rides on the thrown error', () => {
    const failure = classifyQuotaFailure(result(401, ''));
    const err = createStatusError('401 nope', 401, failure);
    expect(getQuotaFailureFromError(err)).toEqual(failure);
    expect(getQuotaFailureFromError(new Error('plain'))).toBeUndefined();
  });
});
