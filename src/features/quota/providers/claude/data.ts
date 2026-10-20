/**
 * Claude quota data: plan windows, extra usage, and independent dollar balances.
 * React-free and SCSS-free so fixture tests can consume the data layer directly.
 */

import type { TFunction } from 'i18next';
import type {
  AuthFileItem,
  ClaudeBilling,
  ClaudeBillingAccess,
  ClaudeCredits,
  ClaudeDollarBucket,
  ClaudeDollarWindow,
  ClaudeExtraUsage,
  ClaudeProfileResponse,
  ClaudeQuotaState,
  ClaudeQuotaWindow,
  ClaudeUsageWindow,
  ClaudeUsagePayload,
} from '@/types';
import { apiCallApi, getApiCallErrorMessage } from '@/services/api';
import { normalizeClaudeUsageSnapshot } from '@/services/api/claudeUsage';
import {
  CLAUDE_PROFILE_URL,
  CLAUDE_USAGE_URL,
  CLAUDE_REQUEST_HEADERS,
  CLAUDE_USAGE_WINDOW_KEYS,
  claudePeriodHours,
  normalizeNumberValue,
  normalizeStringValue,
  parseClaudeUsagePayload,
  formatQuotaResetTime,
  resolveResetMs,
  classifyQuotaFailure,
  createStatusError,
  isClaudeFile,
  isDisabledAuthFile,
} from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

export type ClaudeQuotaData = {
  windows: ClaudeQuotaWindow[];
  extraUsage?: ClaudeExtraUsage | null;
  credits?: ClaudeCredits;
  allowances?: ClaudeDollarBucket[];
  planType?: string | null;
  dollarWindows: ClaudeDollarWindow[];
  observedAt: string;
  billing?: ClaudeBilling | null;
};

/** Minor units at `decimalPlaces` -> cents. Null when the amount is absent. */
const toCents = (minor: unknown, decimalPlaces: number): number | null => {
  const value = normalizeNumberValue(minor);
  if (value === null) return null;
  return Math.round(value * 10 ** (2 - decimalPlaces));
};

export const deriveClaudeCredits = (payload: ClaudeUsagePayload): ClaudeCredits => {
  const extra = payload.extra_usage ?? null;
  const spend = payload.spend ?? null;
  const decimalPlaces = normalizeNumberValue(extra?.decimal_places) ?? 2;
  const usedCents =
    toCents(extra?.used_credits, decimalPlaces) ??
    toCents(spend?.used?.amount_minor, normalizeNumberValue(spend?.used?.exponent) ?? 2);
  const limitCents =
    toCents(extra?.monthly_limit, decimalPlaces) ??
    toCents(spend?.limit?.amount_minor, normalizeNumberValue(spend?.limit?.exponent) ?? 2);

  let status: ClaudeCredits['status'] = 'unknown';
  if (extra) {
    if (extra.is_enabled === true) status = 'enabled';
    else if (extra.disabled_reason === 'out_of_credits') status = 'off_out_of_credits';
    else if (extra.user_disabled === true) status = 'off_user_disabled';
    else if (extra.spend_limit_reached === true) status = 'off_limit_reached';
    else if (extra.credits_ever_enabled === false) status = 'never_enabled';
  }

  return { status, usedCents, limitCents, canToggle: spend?.can_toggle === true };
};

export const buildClaudeAllowances = (
  payload: ClaudeUsagePayload,
  t: TFunction
): ClaudeDollarBucket[] => {
  const bucket = payload.iguana_necktie;
  if (!bucket || typeof bucket !== 'object') return [];
  const labelKey = 'claude_quota.monthly_allowance';
  return [
    {
      id: 'monthly-allowance',
      label: t(labelKey),
      labelKey,
      usedDollars: normalizeNumberValue(bucket.used_dollars),
      limitDollars: normalizeNumberValue(bucket.limit_dollars),
      remainingDollars: normalizeNumberValue(bucket.remaining_dollars),
      resetAtMs: resolveResetMs([bucket.resets_at]),
      lockedReason: normalizeStringValue(bucket.locked_reason) ?? null,
    },
  ];
};
export const hasClaudeUsageData = (quota?: ClaudeQuotaState): boolean =>
  Boolean(
    quota?.observedAt || quota?.windows?.length || quota?.extraUsage || quota?.dollarWindows?.length
  );

const findFableUsageLimit = (payload: ClaudeUsagePayload) => {
  if (!Array.isArray(payload.limits)) return null;

  const candidates = payload.limits.filter((limit) => {
    const kind = (normalizeStringValue(limit?.kind) ?? '').trim().toLowerCase();
    const modelName = (normalizeStringValue(limit?.scope?.model?.display_name) ?? '')
      .trim()
      .toLowerCase();
    const isFable = modelName === 'fable' || modelName === 'fable 5';
    return kind === 'weekly_scoped' && isFable && normalizeNumberValue(limit?.percent) !== null;
  });

  return candidates.find((limit) => limit.is_active === true) ?? candidates[0] ?? null;
};

const isDollarDenominatedWindow = (window: ClaudeUsageWindow) =>
  normalizeNumberValue(window.limit_dollars) !== null ||
  normalizeNumberValue(window.used_dollars) !== null ||
  normalizeNumberValue(window.remaining_dollars) !== null;

export const buildClaudeQuotaWindows = (
  payload: ClaudeUsagePayload,
  t: TFunction
): ClaudeQuotaWindow[] => {
  const windows: ClaudeQuotaWindow[] = [];
  const fableLimit = findFableUsageLimit(payload);

  for (const { key, id, labelKey } of CLAUDE_USAGE_WINDOW_KEYS) {
    const window = payload[key as keyof ClaudeUsagePayload];
    if (!window || typeof window !== 'object' || !('utilization' in window)) continue;
    const typedWindow = window as ClaudeUsageWindow;
    const isCreditPool = key === 'iguana_necktie' && isDollarDenominatedWindow(typedWindow);
    if (key === 'iguana_necktie' && fableLimit && !isCreditPool) continue;
    if (isCreditPool) {
      windows.push({
        id: 'cloud-session-credits',
        label: t('claude_quota.cloud_session_credits'),
        labelKey: 'claude_quota.cloud_session_credits',
        usedPercent: normalizeNumberValue(typedWindow.utilization),
        resetLabel: formatQuotaResetTime(typedWindow.resets_at ?? undefined),
        resetAtMs: resolveResetMs([typedWindow.resets_at]),
        periodHours: null,
      });
      continue;
    }
    const usedPercent = normalizeNumberValue(typedWindow.utilization);
    const resetLabel = formatQuotaResetTime(typedWindow.resets_at ?? undefined);
    windows.push({
      id,
      label: t(labelKey),
      labelKey,
      usedPercent,
      resetLabel,
      // Claude states the period nowhere in the payload, so it comes from the
      // key: `five_hour` is the rolling window, everything else is weekly.
      resetAtMs: resolveResetMs([typedWindow.resets_at]),
      periodHours: claudePeriodHours(key),
    });
  }

  if (fableLimit) {
    const usedPercent = normalizeNumberValue(fableLimit.percent);
    if (usedPercent !== null) {
      windows.push({
        id: 'seven-day-fable',
        label: t('claude_quota.seven_day_fable'),
        labelKey: 'claude_quota.seven_day_fable',
        usedPercent,
        resetLabel: formatQuotaResetTime(fableLimit.resets_at ?? undefined),
        // `weekly_scoped` is a 7-day window by definition, so the timeline can
        // place this row alongside the ones derived from the named keys.
        resetAtMs: resolveResetMs([fableLimit.resets_at]),
        periodHours: claudePeriodHours('seven_day'),
      });
    }
  }

  return windows;
};

const normalizeFlagValue = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(trimmed)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(trimmed)) return false;
  }
  return undefined;
};

const parseClaudeProfilePayload = (payload: unknown): ClaudeProfileResponse | null => {
  if (payload === undefined || payload === null) return null;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as ClaudeProfileResponse;
    } catch {
      return null;
    }
  }
  if (typeof payload === 'object') {
    return payload as ClaudeProfileResponse;
  }
  return null;
};

export const resolveClaudePlanType = (profile: ClaudeProfileResponse | null): string | null => {
  if (!profile) return null;

  const organizationType = normalizeStringValue(
    profile.organization?.organization_type
  )?.toLowerCase();
  const subscriptionStatus = normalizeStringValue(
    profile.organization?.subscription_status
  )?.toLowerCase();

  if (organizationType === 'claude_team' && subscriptionStatus === 'active') {
    return 'plan_team';
  }

  // Account flags include personal subscriptions even for a Team-scoped token.
  const hasClaudeMax = normalizeFlagValue(profile.account?.has_claude_max);
  if (hasClaudeMax) return 'plan_max';

  const hasClaudePro = normalizeFlagValue(profile.account?.has_claude_pro);
  if (hasClaudePro) return 'plan_pro';

  if (hasClaudeMax === false && hasClaudePro === false) return 'plan_free';

  return null;
};

/** Stripe-style subscription statuses -> whether the account can still be served. */
const SUBSCRIPTION_ACCESS: Record<string, ClaudeBillingAccess> = {
  active: 'active',
  trialing: 'active',
  trial: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  incomplete: 'past_due',
  canceled: 'inactive',
  cancelled: 'inactive',
  inactive: 'inactive',
  expired: 'inactive',
  incomplete_expired: 'inactive',
  paused: 'inactive',
};

/**
 * Subscription standing from the profile. Anthropic keeps answering the
 * profile call while the usage call fails for an unpaid account, so this is
 * what tells "the invoice is overdue" apart from "the credential is broken".
 */
export const resolveClaudeBilling = (
  profile: ClaudeProfileResponse | null
): ClaudeBilling | null => {
  const subscriptionStatus =
    normalizeStringValue(profile?.organization?.subscription_status)?.toLowerCase() ?? null;
  const invoiceUrl =
    normalizeStringValue(profile?.organization?.payment_auth_hosted_invoice_url) ?? null;
  if (!subscriptionStatus && !invoiceUrl) return null;
  const known = subscriptionStatus ? SUBSCRIPTION_ACCESS[subscriptionStatus] : undefined;
  const access: ClaudeBillingAccess = known ?? (invoiceUrl ? 'past_due' : 'active');
  return { access, subscriptionStatus, invoiceUrl };
};

/**
 * Placeholder rows pinned at 0% remaining for an account whose subscription
 * lapsed. Anthropic returns no usage payload for it, but "0% left, pay the
 * invoice" is the truthful reading, not "failed to load".
 */
export const buildLockedClaudeWindows = (t: TFunction): ClaudeQuotaWindow[] =>
  CLAUDE_USAGE_WINDOW_KEYS.filter(({ key }) => key === 'five_hour' || key === 'seven_day').map(
    ({ key, id, labelKey }) => ({
      id,
      label: t(labelKey),
      labelKey,
      usedPercent: 100,
      resetLabel: '-',
      resetAtMs: null,
      periodHours: claudePeriodHours(key),
      locked: true,
    })
  );

const fetchClaudeQuota = async (file: AuthFileItem, t: TFunction): Promise<ClaudeQuotaData> => {
  const rawAuthIndex = file['auth_index'] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error(t('claude_quota.missing_auth_index'));
  }

  const [usageResult, profileResult] = await Promise.allSettled([
    apiCallApi.request({
      authIndex,
      method: 'GET',
      url: CLAUDE_USAGE_URL,
      header: { ...CLAUDE_REQUEST_HEADERS, Accept: 'application/json' },
    }),
    apiCallApi.request({
      authIndex,
      method: 'GET',
      url: CLAUDE_PROFILE_URL,
      header: { ...CLAUDE_REQUEST_HEADERS },
    }),
  ]);

  const profile =
    profileResult.status === 'fulfilled' &&
    profileResult.value.statusCode >= 200 &&
    profileResult.value.statusCode < 300
      ? parseClaudeProfilePayload(profileResult.value.body ?? profileResult.value.bodyText)
      : null;
  const planType = resolveClaudePlanType(profile);
  const billing = resolveClaudeBilling(profile);

  if (usageResult.status === 'rejected') {
    throw usageResult.reason;
  }

  const result = usageResult.value;

  if (result.statusCode < 200 || result.statusCode >= 300) {
    if (billing && billing.access !== 'active') {
      return {
        windows: buildLockedClaudeWindows(t),
        allowances: [],
        dollarWindows: [],
        observedAt: new Date().toISOString(),
        planType,
        billing,
      };
    }
    throw createStatusError(
      getApiCallErrorMessage(result),
      result.statusCode,
      classifyQuotaFailure(result)
    );
  }

  const payload = parseClaudeUsagePayload(result.body ?? result.bodyText);
  if (!payload) {
    throw new Error(t('claude_quota.empty_windows'));
  }

  const snapshot = normalizeClaudeUsageSnapshot(payload);
  if (!snapshot) {
    throw new Error(t('claude_quota.empty_windows'));
  }
  const dollarWindows = snapshot.dollarWindows;
  // Full dollar balances get their own amount/reset rows, not a second plan meter.
  const windows = buildClaudeQuotaWindows(payload, t).filter(
    (window) =>
      window.id !== 'cloud-session-credits' ||
      !dollarWindows.some((balance) => balance.key === 'iguana_necktie')
  );

  return {
    windows,
    credits: deriveClaudeCredits(payload),
    allowances: buildClaudeAllowances(payload, t),
    extraUsage: snapshot.extraUsage,
    dollarWindows,
    observedAt: new Date().toISOString(),
    planType,
    billing,
  };
};

export const CLAUDE_CONFIG: QuotaProviderData<ClaudeQuotaState, ClaudeQuotaData> = {
  type: 'claude',
  i18nPrefix: 'claude_quota',
  filterFn: (file) => isClaudeFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchClaudeQuota,
  storeSelector: (state) => state.claudeQuota,
  storeSetter: 'setClaudeQuota',
  buildLoadingState: () => ({ status: 'loading', windows: [] }),
  buildSuccessState: (data) => ({
    status: 'success',
    windows: data.windows,
    extraUsage: data.extraUsage,
    credits: data.credits,
    allowances: data.allowances,
    planType: data.planType,
    dollarWindows: data.dollarWindows,
    observedAt: data.observedAt,
    stale: false,
    billing: data.billing ?? null,
  }),
  buildErrorState: (message, status, failure) => ({
    status: 'error',
    windows: [],
    error: message,
    errorStatus: status,
    failure,
  }),
};
