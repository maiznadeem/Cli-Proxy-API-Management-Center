/**
 * Auth-file types.
 */

import type { RecentRequestBucket } from '@/utils/recentRequests';

export type AuthFileType =
  | 'qwen'
  | 'kimi'
  | 'gemini'
  | 'aistudio'
  | 'claude'
  | 'codex'
  | 'devin'
  | 'meta'
  | 'antigravity'
  | 'xai'
  | 'iflow'
  | 'vertex'
  | 'empty'
  | 'unknown';

export interface AuthFileCooldown {
  scope: 'model' | 'credential';
  modelKey?: string;
  reason: string;
  retryAt: string;
  remainingSeconds: number;
  backoffLevel?: number;
  httpStatus?: number;
}

export interface AuthFileCooldownSnapshot {
  /** Server observation time, not the start of the cooldown. */
  observedAt?: string;
  /** Local receipt time anchors relative timers without relying on synchronized clocks. */
  receivedAtMs: number;
  /** null = runtime state unknown; [] = known, with no active timers. */
  records: AuthFileCooldown[] | null;
}

/** Per-credential Claude usage-credits (extra usage) state from the credentials endpoint. */
export interface AuthFileUsageCredits {
  enabled?: boolean;
  known?: boolean;
  reason?: string;
  used_cents?: number;
  limit_cents?: number;
  ever_enabled?: boolean;
}

export interface AuthFileWindows {
  five_hour_pct?: number;
  seven_day_pct?: number;
}

/** Manual per-credential routing override. Absent on the wire means normal. */
export type RoutingMode = 'normal' | 'preserve' | 'focus';

export interface AuthFileItem {
  name: string;
  siwcBindSupported?: boolean;
  useSiwc?: boolean;
  siwcBound?: boolean;
  siwcExpiresAt?: string;
  type?: AuthFileType | string;
  provider?: string;
  /**
   * Account email supplied by the file scanner or credential registry.
   * Never display or search account/account_type: API-key credentials may expose
   * the API key itself through those fields.
   */
  email?: string;
  /** GCP / Vertex project ID, used when account email is absent. */
  projectId?: string;
  size?: number;
  authIndex?: string | number | null;
  /** Generic plugin quota capability advertised by CPA's auth-files API. */
  supportsQuota?: boolean;
  quotaProvider?: string;
  /** Backend-selected quota plugin; authoritative when supplied by v8 credentials. */
  quotaPluginId?: string;
  runtimeOnly?: boolean | string;
  disabled?: boolean;
  unavailable?: boolean;
  status?: string;
  statusMessage?: string;
  lastRefresh?: string | number;
  modified?: number;
  priority?: number;
  weight?: number;
  /** Normalized from `routing_mode`; undefined when the server omits it (older servers). */
  routingMode?: RoutingMode;
  note?: string;
  success?: unknown;
  failed?: unknown;
  /** Cumulative success/failure counts normalized by the API boundary. */
  successCount?: number;
  failureCount?: number;
  recent_requests?: RecentRequestBucket[];
  recentRequests?: RecentRequestBucket[];
  /** Server quota observation; carries exhausted / usage_credits / windows on fork.3+. */
  quota?: AuthFileQuotaObservation;
  /** Absent on older servers. Never interpreted as credential health. */
  cooldownSnapshot?: AuthFileCooldownSnapshot;
  [key: string]: unknown;
}

export interface AuthFileQuotaObservation {
  reset_at?: string;
  /** All limit windows are used up. Absent on older servers. */
  exhausted?: boolean;
  usage_credits?: AuthFileUsageCredits;
  windows?: AuthFileWindows;
  [key: string]: unknown;
}

export interface AuthFilesResponse {
  files: AuthFileItem[];
  total?: number;
  observed_at?: unknown;
  observedAt?: string;
}
