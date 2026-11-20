import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores';
import { useRoutingStore } from '@/stores/useRoutingStore';
import { logsApi } from '@/services/api/logs';
import { getErrorMessage } from '@/utils/helpers';

export const ROUTING_POLL_MS = 5000;
const PAGE_LIMIT = 10000;
const MAX_PAGES_PER_READ = 3;

const getErrorPayloadText = (err: unknown): string => {
  if (typeof err !== 'object' || err === null) return '';
  return [(err as { data?: unknown }).data, (err as { details?: unknown }).details]
    .filter((payload) => payload !== undefined)
    .map((payload) => {
      if (typeof payload === 'string') return payload;
      try {
        return JSON.stringify(payload);
      } catch {
        return '';
      }
    })
    .join(' ');
};

export const isLoggingToFileDisabledError = (err: unknown): boolean =>
  `${getErrorMessage(err)} ${getErrorPayloadText(err)}`
    .toLowerCase()
    .includes('logging to file disabled');

/**
 * Polls the application log every 5 s while mounted and live. One read in flight at a time;
 * reads started before a connection change or store reset never commit.
 */
export function useRoutingPoll() {
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const generation = useRoutingStore((state) => state.generation);
  const live = useRoutingStore((state) => state.live);
  const [loading, setLoading] = useState(() => !useRoutingStore.getState().loaded);
  const [error, setError] = useState('');
  const [fileLoggingDisabled, setFileLoggingDisabled] = useState(false);
  const tokenRef = useRef(0);
  const inFlightRef = useRef(false);

  async function read() {
    if (useAuthStore.getState().connectionStatus !== 'connected' || inFlightRef.current) return;
    const token = tokenRef.current;
    const startGeneration = useRoutingStore.getState().generation;
    const isCurrent = () =>
      token === tokenRef.current && startGeneration === useRoutingStore.getState().generation;
    inFlightRef.current = true;
    if (!useRoutingStore.getState().loaded) setLoading(true);
    try {
      for (let page = 0; page < MAX_PAGES_PER_READ; page++) {
        const { cursor, loaded } = useRoutingStore.getState();
        const data = await logsApi.fetchLogs(
          cursor ? { limit: PAGE_LIMIT, cursor } : { limit: PAGE_LIMIT }
        );
        if (!isCurrent()) return;
        useRoutingStore
          .getState()
          .applyPage(data.lines, data.nextCursor, !loaded || !cursor || Boolean(data.cursorReset));
        setError('');
        setFileLoggingDisabled(false);
        const more =
          Boolean(cursor) &&
          Boolean(data.nextCursor) &&
          data.nextCursor !== cursor &&
          !data.cursorReset &&
          data.lines.length >= PAGE_LIMIT;
        if (!more) break;
      }
    } catch (err: unknown) {
      if (!isCurrent()) return;
      if (isLoggingToFileDisabledError(err)) {
        setFileLoggingDisabled(true);
        setError('');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      if (token === tokenRef.current) inFlightRef.current = false;
      if (isCurrent()) setLoading(false);
    }
  }

  // Read immediately on mount, on (re)connect and after a store reset.
  useEffect(() => {
    tokenRef.current += 1;
    inFlightRef.current = false;
    if (connectionStatus !== 'connected') {
      setLoading(false);
      return;
    }
    setFileLoggingDisabled(false);
    setError('');
    void read();
    return () => {
      tokenRef.current += 1;
      inFlightRef.current = false;
    };
  }, [connectionStatus, generation]);

  useEffect(() => {
    if (!live || connectionStatus !== 'connected' || fileLoggingDisabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void read();
    }, ROUTING_POLL_MS);
    return () => window.clearInterval(id);
  }, [live, connectionStatus, fileLoggingDisabled]);

  return { loading, error, fileLoggingDisabled, connected: connectionStatus === 'connected' };
}
