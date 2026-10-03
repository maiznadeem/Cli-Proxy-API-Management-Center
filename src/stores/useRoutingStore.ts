/**
 * Routing events parsed from the application log. Survives route switches; cleared
 * when the connection identity changes so one proxy's threads never show under another.
 */

import { create } from 'zustand';
import {
  applyRoutingLines,
  emptyRoutingLog,
  type RoutingLog,
} from '@/features/routing/model/parseRoutingLines';
import { useAuthStore } from './useAuthStore';

interface RoutingStoreState {
  /** Bumped on every reset; in-flight reads compare it before committing. */
  generation: number;
  log: RoutingLog;
  cursor?: string;
  /** True once the first page for this generation has been applied. */
  loaded: boolean;
  lastUpdated?: number;
  live: boolean;
  setLive: (live: boolean) => void;
  /** Apply one log page; `replace` discards existing events (first read or cursor reset). */
  applyPage: (lines: readonly string[], cursor: string | undefined, replace: boolean) => void;
  /** Drop collected events but keep the cursor, so old lines do not come back. */
  clearEvents: () => void;
  reset: () => void;
}

export const useRoutingStore = create<RoutingStoreState>((set) => ({
  generation: 0,
  log: emptyRoutingLog(),
  cursor: undefined,
  loaded: false,
  lastUpdated: undefined,
  live: true,
  setLive: (live) => set({ live }),
  applyPage: (lines, cursor, replace) =>
    set((state) => ({
      log: applyRoutingLines(replace ? emptyRoutingLog() : state.log, lines),
      cursor,
      loaded: true,
      lastUpdated: Date.now(),
    })),
  clearEvents: () => set({ log: emptyRoutingLog() }),
  reset: () =>
    set((state) => ({
      generation: state.generation + 1,
      log: emptyRoutingLog(),
      cursor: undefined,
      loaded: false,
      lastUpdated: undefined,
    })),
}));

// Invalidate at store notification time, not after React commits a new render.
useAuthStore.subscribe((next, previous) => {
  if (
    next.apiBase === previous.apiBase &&
    next.managementKey === previous.managementKey &&
    next.isAuthenticated === previous.isAuthenticated
  )
    return;
  useRoutingStore.getState().reset();
});
