/**
 * Quota error message resolution shared by the quota page and auth-files cards.
 */

import type { TFunction } from 'i18next';
import type { QuotaFailure, QuotaFailureKind } from '@/types';
import type { ApiCallResult } from '@/services/api/apiCall';
import { isRecord } from '@/utils/helpers';

const readHeader = (header: Record<string, string[]> | undefined, name: string): string | null => {
  if (!header) return null;
  const wanted = name.toLowerCase();
  for (const [key, values] of Object.entries(header)) {
    if (key.toLowerCase() === wanted && Array.isArray(values) && values.length > 0) {
      return values[0] ?? null;
    }
  }
  return null;
};

/** Retry-After as seconds. Accepts the delta-seconds form and an HTTP date. */
export const parseRetryAfterSeconds = (value: string | null, nowMs = Date.now()): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.round((at - nowMs) / 1000));
};

/** Provider error code from the usual `{ error: { type, error_code } }` shapes. */
export const readQuotaErrorCode = (body: unknown): string | null => {
  if (!isRecord(body)) return null;
  const error = body.error;
  const source = isRecord(error) ? error : body;
  for (const key of ['error_code', 'code', 'type']) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

/**
 * Turns a failed upstream probe into a failure kind the cards can explain.
 * A 403 that names OAuth is an org/plan policy, not a bad token; 401 is the
 * token; 429 carries Retry-After; 5xx is the provider.
 */
export const classifyQuotaFailure = (result: ApiCallResult, nowMs = Date.now()): QuotaFailure => {
  const status = result.statusCode;
  const code = readQuotaErrorCode(result.body);
  const text = `${code ?? ''} ${result.bodyText ?? ''}`.toLowerCase();
  let kind: QuotaFailureKind = 'unknown';
  if (status === 401) kind = 'unauthorized';
  else if (status === 403) kind = text.includes('oauth') ? 'oauth_blocked' : 'forbidden';
  else if (status === 429) kind = 'rate_limited';
  else if (status >= 500) kind = 'upstream';
  return {
    kind,
    code,
    retryAfterSeconds:
      kind === 'rate_limited' ? parseRetryAfterSeconds(readHeader(result.header, 'retry-after'), nowMs) : null,
  };
};

/** 配额接口错误 → 用户可读文案（404=后端需升级，403=检查凭证）。 */
export const resolveQuotaErrorMessage = (
  t: TFunction,
  status: number | undefined,
  fallback: string,
  failure?: QuotaFailure
): string => {
  if (status === 404) return t('common.quota_update_required');
  if (failure && failure.kind !== 'unknown') {
    if (failure.kind === 'rate_limited') {
      const seconds = failure.retryAfterSeconds;
      if (typeof seconds === 'number' && seconds > 0) {
        return t('common.quota_failure_rate_limited_retry', {
          minutes: Math.max(1, Math.ceil(seconds / 60)),
        });
      }
    }
    return t(`common.quota_failure_${failure.kind}`);
  }
  if (status === 403) return t('common.quota_check_credential');
  return fallback;
};
