import { apiClient } from './client';

const USAGE_STATS_TIMEOUT_MS = 20 * 1000;
const PATH = '/observability/usage/stats';

export interface UsageBucket {
  key: string;
  requests: number;
  failed: number;
  input: number;
  cache_read: number;
  cache_write: number;
  output: number;
  reasoning: number;
  total: number;
  provider?: string;
  source?: string;
  models?: string[];
  credentials?: string[];
  first?: string;
  last?: string;
}

export interface UsageTotals {
  requests: number;
  failed: number;
  input: number;
  cache_read: number;
  cache_write: number;
  output: number;
  reasoning: number;
  total: number;
}

export interface UsageStatsResponse {
  since?: string;
  until?: string;
  generated_at?: string;
  totals: UsageTotals;
  by_model: UsageBucket[];
  by_credential: UsageBucket[];
  by_api_key: UsageBucket[];
  by_session: UsageBucket[];
  by_day: UsageBucket[];
}

export const usageStatsApi = {
  get: (params: { since?: string; until?: string }) =>
    apiClient.get<UsageStatsResponse>(PATH, { params, timeout: USAGE_STATS_TIMEOUT_MS }),
  clear: () => apiClient.delete(PATH, { timeout: USAGE_STATS_TIMEOUT_MS }),
};
