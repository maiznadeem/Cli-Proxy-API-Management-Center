import { useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { useUsageStore } from '@/stores/useUsageStore';

export const USAGE_POLL_MS = 60_000;

/** Reads usage stats on mount and (re)connect, then every 60 s while the tab is visible. */
export function useUsagePoll() {
  const connectionStatus = useAuthStore((state) => state.connectionStatus);

  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    void useUsageStore.getState().refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void useUsageStore.getState().refresh();
    }, USAGE_POLL_MS);
    return () => window.clearInterval(id);
  }, [connectionStatus]);

  return { connected: connectionStatus === 'connected' };
}
