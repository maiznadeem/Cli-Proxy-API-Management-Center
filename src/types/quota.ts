/**
 * Quota management types.
 */

// Theme types
export type ThemeColors = { bg: string; text: string; border?: string };
export type TypeColorSet = { light: ThemeColors; dark?: ThemeColors };
export type ResolvedTheme = 'light' | 'dark';

// API payload types
export interface AntigravityQuotaSummaryBucketPayload {
  bucketId?: string;
  bucket_id?: string;
  displayName?: string;
  display_name?: string;
  window?: string;
  resetTime?: string;
  reset_time?: string;
  remainingFraction?: number | string;
  remaining_fraction?: number | string;
  description?: string;
}

export interface AntigravityQuotaSummaryGroupPayload {
  displayName?: string;
  display_name?: string;
  description?: string;
  buckets?: AntigravityQuotaSummaryBucketPayload[];
}

export interface AntigravityQuotaSummaryPayload {
  groups?: AntigravityQuotaSummaryGroupPayload[];
}

export interface CodexUsageWindow {
  used_percent?: number | string;
  usedPercent?: number | string;
  limit_window_seconds?: number | string;
  limitWindowSeconds?: number | string;
  reset_after_seconds?: number | string;
  resetAfterSeconds?: number | string;
  reset_at?: number | string;
  resetAt?: number | string;
}

export interface CodexRateLimitInfo {
  allowed?: boolean;
  limit_reached?: boolean;
  limitReached?: boolean;
  primary_window?: CodexUsageWindow | null;
  primaryWindow?: CodexUsageWindow | null;
  secondary_window?: CodexUsageWindow | null;
  secondaryWindow?: CodexUsageWindow | null;
}

export interface CodexAdditionalRateLimit {
  limit_name?: string;
  limitName?: string;
  metered_feature?: string;
  meteredFeature?: string;
  rate_limit?: CodexRateLimitInfo | null;
  rateLimit?: CodexRateLimitInfo | null;
}

export interface CodexRateLimitResetCredits {
  available_count?: number | string;
  availableCount?: number | string;
  applicable_available_count?: number | string;
  applicableAvailableCount?: number | string;
}

export interface CodexRateLimitResetCredit {
  id: string;
  status: string;
  grantedAt: string;
  expiresAt: string;
}

export interface CodexAccountCredits {
  has_credits?: boolean;
  unlimited?: boolean;
  balance?: string | number | null;
}

export interface CodexUsagePayload {
  credits?: CodexAccountCredits | null;
  plan_type?: string;
  planType?: string;
  rate_limit?: CodexRateLimitInfo | null;
  rateLimit?: CodexRateLimitInfo | null;
  code_review_rate_limit?: CodexRateLimitInfo | null;
  codeReviewRateLimit?: CodexRateLimitInfo | null;
  additional_rate_limits?: CodexAdditionalRateLimit[] | null;
  additionalRateLimits?: CodexAdditionalRateLimit[] | null;
  rate_limit_reset_credits?: CodexRateLimitResetCredits | null;
  rateLimitResetCredits?: CodexRateLimitResetCredits | null;
}

// Claude API payload types
export interface ClaudeUsageWindow {
  utilization: number | null;
  resets_at: string | null;
  limit_dollars?: number | null;
  used_dollars?: number | null;
  remaining_dollars?: number | null;
}

export interface ClaudeUsageLimit {
  kind?: string | null;
  group?: string | null;
  percent?: number | null;
  resets_at?: string | null;
  is_active?: boolean | null;
  scope?: {
    model?: {
      id?: string | null;
      display_name?: string | null;
    } | null;
  } | null;
}

export interface ClaudeExtraUsagePayload extends Partial<Omit<ClaudeExtraUsageRaw, 'is_enabled'>> {
  is_enabled?: boolean | null;
  monthly_limit?: number | null;
  used_credits?: number | null;
  utilization?: number | null;
  currency?: string | null;
  disabled_reason?: string | null;
  user_disabled?: boolean | null;
  spend_limit_reached?: boolean | null;
}

/** Amounts are in minor currency units, unlike the separate dollar windows. */
export interface ClaudeExtraUsageRaw {
  is_enabled: boolean;
  /** Minor units (cents when decimal_places is 2). Null when no cap is set. */
  monthly_limit: number | null;
  used_credits: number | null;
  utilization?: number | null;
  currency?: string | null;
  decimal_places?: number | null;
  disabled_reason?: string | null;
  user_disabled?: boolean | null;
  spend_limit_reached?: boolean | null;
  credits_ever_enabled?: boolean | null;
}

export interface ClaudeMoney {
  amount_minor: number;
  currency?: string | null;
  exponent?: number | null;
}

export interface ClaudeSpend {
  used?: ClaudeMoney | null;
  limit?: ClaudeMoney | null;
  percent?: number | null;
  enabled?: boolean | null;
  disabled_reason?: string | null;
  can_purchase_credits?: boolean | null;
  can_toggle?: boolean | null;
}

/** Monthly dollar allowance (`iguana_necktie`), not a time window. */
export interface ClaudeDollarBucketPayload {
  utilization?: number | null;
  resets_at?: string | null;
  limit_dollars?: number | null;
  used_dollars?: number | null;
  remaining_dollars?: number | null;
  locked_reason?: string | null;
}

export interface ClaudeDollarBucket {
  id: string;
  label: string;
  labelKey: string;
  usedDollars: number | null;
  limitDollars: number | null;
  remainingDollars: number | null;
  resetAtMs: number | null;
  lockedReason: string | null;
}

export type ClaudeCreditsStatus =
  | 'enabled'
  | 'off_out_of_credits'
  | 'off_user_disabled'
  | 'off_limit_reached'
  | 'never_enabled'
  | 'unknown';

export interface ClaudeCredits {
  status: ClaudeCreditsStatus;
  usedCents: number | null;
  limitCents: number | null;
  canToggle: boolean;
}

export interface ClaudeExtraUsage {
  isEnabled: boolean | null;
  monthlyLimit: number | null;
  usedCredits: number | null;
  utilization: number | null;
  currency: string | null;
  disabledReason: string | null;
  userDisabled: boolean | null;
  spendLimitReached: boolean | null;
}

export interface ClaudeDollarWindow {
  /** Original upstream key; never conflated with extra usage. */
  key: string;
  limitDollars: number | null;
  usedDollars: number | null;
  remainingDollars: number | null;
  utilization: number | null;
  resetsAt: string | null;
}

export interface ClaudeUsageSnapshot {
  fiveHour: { utilization: number | null; resetsAt: string | null } | null;
  sevenDay: { utilization: number | null; resetsAt: string | null } | null;
  extraUsage: ClaudeExtraUsage | null;
  dollarWindows: ClaudeDollarWindow[];
}

export interface ClaudeUsagePayload {
  five_hour?: ClaudeUsageWindow | null;
  seven_day?: ClaudeUsageWindow | null;
  seven_day_oauth_apps?: ClaudeUsageWindow | null;
  seven_day_opus?: ClaudeUsageWindow | null;
  seven_day_sonnet?: ClaudeUsageWindow | null;
  seven_day_cowork?: ClaudeUsageWindow | null;
  iguana_necktie?: ClaudeDollarBucketPayload | null;
  limits?: ClaudeUsageLimit[] | null;
  spend?: ClaudeSpend | null;
  extra_usage?: ClaudeExtraUsagePayload | null;
  [key: string]: unknown;
}

export interface ClaudeProfileResponse {
  account?: {
    uuid?: string;
    full_name?: string;
    display_name?: string;
    email?: string;
    has_claude_max?: boolean;
    has_claude_pro?: boolean;
    created_at?: string;
  };
  organization?: {
    uuid?: string;
    name?: string;
    organization_type?: string;
    billing_type?: string;
    rate_limit_tier?: string;
    has_extra_usage_enabled?: boolean;
    subscription_status?: string;
    subscription_created_at?: string;
    payment_auth_hosted_invoice_url?: string | null;
  };
}

/**
 * Why a quota probe failed, beyond the bare HTTP status. Lets the cards say
 * "OAuth is blocked for this org" or "rate limited, retry in 59 min" instead
 * of a generic "check the credential".
 */
export type QuotaFailureKind =
  'oauth_blocked' | 'unauthorized' | 'forbidden' | 'rate_limited' | 'upstream' | 'unknown';

export interface QuotaFailure {
  kind: QuotaFailureKind;
  /** Provider error code when one was returned (e.g. oauth_not_allowed_for_organization). */
  code?: string | null;
  /** Seconds until a retry is allowed, from Retry-After, when the provider said so. */
  retryAfterSeconds?: number | null;
}

/** Subscription standing read from the Claude OAuth profile. */
export type ClaudeBillingAccess = 'active' | 'past_due' | 'inactive';

export interface ClaudeBilling {
  access: ClaudeBillingAccess;
  subscriptionStatus: string | null;
  /** Hosted invoice link Anthropic returns while a payment is overdue. */
  invoiceUrl: string | null;
}

export interface ClaudeQuotaWindow {
  id: string;
  label: string;
  labelKey?: string;
  usedPercent: number | null;
  resetLabel: string;
  /**
   * Reset instant in epoch ms, kept alongside the display label so callers that
   * need to compute (ordering, the timeline) aren't stuck comparing formatted
   * strings. Null when the payload carried no parseable timestamp.
   */
  resetAtMs?: number | null;
  /** Window length in hours — 5 for the rolling window, 168 for the weekly ones. */
  periodHours?: number | null;
  /**
   * True when the window is a placeholder pinned at 0% because the account's
   * subscription is past due, so there is no reset to count down to.
   */
  locked?: boolean;
}

export interface ClaudeQuotaState {
  status: 'idle' | 'loading' | 'success' | 'error';
  windows: ClaudeQuotaWindow[];
  extraUsage?: ClaudeExtraUsage | null;
  credits?: ClaudeCredits;
  allowances?: ClaudeDollarBucket[];
  dollarWindows?: ClaudeDollarWindow[];
  observedAt?: string | null;
  stale?: boolean;
  planType?: string | null;
  billing?: ClaudeBilling | null;
  error?: string;
  errorStatus?: number;
  failure?: QuotaFailure;
}

// Quota state types
export interface AntigravityQuotaGroup {
  id: string;
  label: string;
  description?: string;
  buckets: AntigravityQuotaBucket[];
}

export interface AntigravityQuotaSubscription {
  plan: string | null;
  tierName: string | null;
  tierId: string | null;
}

export interface AntigravityQuotaBucket {
  id: string;
  label: string;
  window?: string;
  remainingFraction: number;
  resetTime?: string;
  description?: string;
  /**
   * Reset instant in epoch ms, parsed from `resetTime`. Kept alongside the raw
   * string so the timeline can position a bar without re-parsing.
   *
   * Not corrected by `serverTimeOffsetMs`: that offset is applied to *now* when
   * rendering the card countdown, and every other provider's `resetAtMs` is an
   * uncorrected instant too. Keeping them consistent matters more than the few
   * seconds of clock skew it represents.
   */
  resetAtMs?: number | null;
  /** Window length in hours, from the bucket's `window` field. */
  periodHours?: number | null;
}

export interface AntigravityQuotaState {
  status: 'idle' | 'loading' | 'success' | 'error';
  groups: AntigravityQuotaGroup[];
  subscription?: AntigravityQuotaSubscription | null;
  serverTimeOffsetMs?: number | null;
  error?: string;
  errorStatus?: number;
}

/** A provider-defined numeric/currency value rendered above generic quota windows. */
export interface PluginQuotaMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
  format?: 'number' | 'currency';
  currency?: string;
}

export interface PluginQuotaState extends AntigravityQuotaState {
  summary: PluginQuotaMetric[];
}

export interface CodexQuotaWindow {
  id: string;
  label: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  usedPercent: number | null;
  resetLabel: string;
  /** Reset instant in epoch ms; null when the payload carried no timestamp. */
  resetAtMs?: number | null;
  /** Window length in hours, from the payload's limit_window_seconds. */
  periodHours?: number | null;
}

export interface CodexQuotaState {
  status: 'idle' | 'loading' | 'success' | 'error';
  windows: CodexQuotaWindow[];
  planType?: string | null;
  subscriptionActiveUntil?: string | number | null;
  creditBalance?: string | null;
  creditsUnlimited?: boolean;
  rateLimitResetCreditsAvailableCount?: number | null;
  rateLimitResetCreditsApplicableAvailableCount?: number | null;
  rateLimitResetCredits?: CodexRateLimitResetCredit[];
  rateLimitResetCreditsError?: string;
  error?: string;
  errorStatus?: number;
}

export interface DevinQuotaWindow {
  id: 'daily' | 'weekly';
  label?: string;
  remainingPercent: number | null;
  resetAtMs: number | null;
  periodHours: number;
}

/** Only quota observations, never the credential-bearing refresh response. */
export interface DevinQuotaData {
  windows: DevinQuotaWindow[];
  observedAtMs: number | null;
  plan: string | null;
  planStartMs: number | null;
  planEndMs: number | null;
}

export interface DevinQuotaState extends DevinQuotaData {
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
  errorStatus?: number;
}

/** A whitelisted quota observation from Meta's Muse key endpoint. */
export interface MetaQuotaWindow {
  id: 'window' | 'weekly';
  usedPercent: number | null;
  /** Reset instant as Unix seconds, matching the upstream contract. */
  resetAt?: number;
  durationMinutes?: number;
}

/** Contains quota/display fields only; credential-bearing response fields are discarded. */
export interface MetaQuotaData {
  planName?: string;
  isSubscriptionActive?: boolean;
  windows: MetaQuotaWindow[];
}

export interface MetaQuotaState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: MetaQuotaData;
  error?: string;
  errorStatus?: number;
}

// Kimi API payload types
export interface KimiUsageDetail {
  used?: number | string;
  limit?: number | string;
  remaining?: number | string;
  name?: string;
  title?: string;
  resetAt?: string;
  reset_at?: string;
  resetTime?: string;
  reset_time?: string;
  resetIn?: number | string;
  reset_in?: number | string;
  ttl?: number | string;
}

export interface KimiLimitWindow {
  duration?: number | string;
  timeUnit?: string;
}

export interface KimiLimitItem {
  name?: string;
  title?: string;
  scope?: string;
  detail?: KimiUsageDetail;
  window?: KimiLimitWindow;
  used?: number | string;
  limit?: number | string;
  remaining?: number | string;
  duration?: number | string;
  timeUnit?: string;
  resetAt?: string;
  reset_at?: string;
  resetIn?: number | string;
  reset_in?: number | string;
  ttl?: number | string;
}

export interface KimiUsageRatio {
  used_ratio?: number | string;
  reset_time?: string;
}

export interface KimiUsagePayload {
  usage?: KimiUsageDetail;
  limits?: KimiLimitItem[];
  /** Plans without a weekly limit report their monthly total here as a 0–1 ratio. */
  usages?: {
    limit_month_total?: KimiUsageRatio;
  };
}

export interface KimiQuotaRow {
  id: string;
  label?: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  used: number;
  limit: number;
  resetHint?: string;
  /** Reset instant in epoch ms; null when only a relative hint was available. */
  resetAtMs?: number | null;
  /** Window length in hours, derived from explicit duration metadata or the limit scope. */
  periodHours?: number | null;
}

export interface KimiQuotaState {
  status: 'idle' | 'loading' | 'success' | 'error';
  rows: KimiQuotaRow[];
  error?: string;
  errorStatus?: number;
}

// xAI/Grok API payload types
export interface XaiBillingCent {
  val?: number | string;
}

export interface XaiBillingPeriod {
  type?: string;
  start?: string;
  end?: string;
}

export interface XaiBillingProductUsage {
  product?: string;
  usagePercent?: number | string | null;
  usage_percent?: number | string | null;
}

export interface XaiBillingConfig {
  currentPeriod?: XaiBillingPeriod | null;
  current_period?: XaiBillingPeriod | null;
  creditUsagePercent?: number | string | null;
  credit_usage_percent?: number | string | null;
  productUsage?: XaiBillingProductUsage[] | null;
  product_usage?: XaiBillingProductUsage[] | null;
  monthlyLimit?: XaiBillingCent | number | string | null;
  monthly_limit?: XaiBillingCent | number | string | null;
  used?: XaiBillingCent | number | string | null;
  onDemandCap?: XaiBillingCent | number | string | null;
  on_demand_cap?: XaiBillingCent | number | string | null;
  onDemandUsed?: XaiBillingCent | number | string | null;
  on_demand_used?: XaiBillingCent | number | string | null;
  prepaidBalance?: XaiBillingCent | number | string | null;
  prepaid_balance?: XaiBillingCent | number | string | null;
  billingPeriodStart?: string;
  billing_period_start?: string;
  billingPeriodEnd?: string;
  billing_period_end?: string;
}

export interface XaiBillingPayload {
  config?: XaiBillingConfig | null;
}

export type XaiBillingPeriodType = 'weekly' | 'monthly' | 'unknown';

export interface XaiProductUsageSummary {
  product: string;
  usagePercent: number | null;
}

export interface XaiBillingSummary {
  mode: 'billing' | 'paid-health';
  source?: 'cli-chat-proxy' | 'api.x.ai-fallback';
  planType?: 'paid';
  healthStatus?: 'chat-ok';
  userId?: string;
  teamId?: string;
  periodType: XaiBillingPeriodType;
  usagePercent: number | null;
  periodStart?: string;
  periodEnd?: string;
  productUsage: XaiProductUsageSummary[];
  monthlyLimitCents: number | null;
  usedCents: number | null;
  includedUsedCents: number | null;
  onDemandCapCents: number | null;
  onDemandUsedCents: number | null;
  onDemandUsedPercent: number | null;
  prepaidBalanceCents?: number | null;
  /** Display name from Grok settings, for example "SuperGrok Heavy". */
  planLabel?: string;
  planTier?: 'elite' | 'premium' | 'standard';
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  usedPercent: number | null;
  /**
   * Reset instant of the *active* period (`periodEnd`) in epoch ms.
   *
   * Only meaningful as a quota window when `periodType` is 'weekly' — for a
   * monthly summary this is the billing cycle rollover, which is a spend cap
   * resetting, not rate-limited capacity coming back.
   */
  resetAtMs?: number | null;
  /** Active period length in hours, derived from `periodStart` → `periodEnd`. */
  periodHours?: number | null;
}

export interface XaiQuotaState {
  status: 'idle' | 'loading' | 'success' | 'error';
  billing: XaiBillingSummary | null;
  error?: string;
  errorStatus?: number;
}
