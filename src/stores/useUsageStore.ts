import { create } from 'zustand';
import { usageStatsApi, type UsageStatsResponse } from '@/services/api/usageStats';
import { rangeSince, type UsageRange } from '@/features/usage/model';
import {
  loadPricing,
  resetPricing,
  savePricing,
  type PricingTable,
} from '@/features/usage/pricing';
import { getErrorMessage } from '@/utils/helpers';

export type UsageStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

interface UsageState {
  range: UsageRange;
  data: UsageStatsResponse | null;
  status: UsageStatus;
  error: string;
  lastUpdated: number | null;
  pricing: PricingTable;
  setRange: (range: UsageRange) => void;
  refresh: () => Promise<void>;
  clearHistory: () => Promise<void>;
  setPricing: (table: PricingTable) => void;
  resetPricing: () => void;
}

let requestId = 0;

export const useUsageStore = create<UsageState>((set, get) => ({
  range: '7d',
  data: null,
  status: 'idle',
  error: '',
  lastUpdated: null,
  pricing: loadPricing(),

  setRange: (range) => {
    if (range === get().range) return;
    set({ range, data: null, status: 'loading' });
    void get().refresh();
  },

  refresh: async () => {
    const id = ++requestId;
    const { range, data } = get();
    if (!data) set({ status: 'loading' });
    try {
      const next = await usageStatsApi.get({
        since: rangeSince(range),
        until: new Date().toISOString(),
      });
      if (id !== requestId) return;
      set({ data: next, status: 'ready', error: '', lastUpdated: Date.now() });
    } catch (err: unknown) {
      if (id !== requestId) return;
      if ((err as { status?: number })?.status === 404) {
        set({ data: null, status: 'unsupported', error: '' });
      } else {
        set({ status: get().data ? 'ready' : 'error', error: getErrorMessage(err) });
      }
    }
  },

  clearHistory: async () => {
    await usageStatsApi.clear();
    requestId += 1;
    set({ data: null, status: 'loading' });
    await get().refresh();
  },

  setPricing: (table) => {
    savePricing(table);
    set({ pricing: table });
  },

  resetPricing: () => set({ pricing: resetPricing() }),
}));
