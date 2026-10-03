/**
 * Pure parsing and aggregation for the Routing page.
 *
 * Input is the proxy's application log. Two line shapes matter:
 * - selector.go "session-affinity: <kind> | session=.. auth=.. provider=.. model=.."
 * - gin_logger.go "<status> | <latency> | <ip> | <METHOD> "<path>""
 * They are joined by the `[xxxxxxxx]` request id, in either arrival order.
 */

export type RoutingEventKind = 'hit' | 'bind' | 'rebind';
export type RoutingClientKind = 'claude' | 'codex' | 'direct' | 'other';

export interface GinRecord {
  requestId: string;
  status: number;
  latencyMs: number | null;
  method: string;
  path: string;
}

export interface RoutingEvent {
  requestId: string;
  timestampMs: number;
  kind: RoutingEventKind;
  message: string;
  session: string;
  auth: string;
  provider: string;
  model: string;
  parent?: string;
  fallback?: string;
  status?: number;
  latencyMs?: number | null;
  method?: string;
  path?: string;
}

export interface RoutingLog {
  /** Arrival order, oldest first. */
  events: RoutingEvent[];
  /** Gin lines whose selector line has not arrived yet, keyed by request id. */
  pendingGin: Record<string, GinRecord>;
}

export const ROUTING_EVENT_CAP = 5000;
const PENDING_GIN_CAP = 500;
const NO_REQUEST_ID = '--------';

const LINE_RE =
  /^\[(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})\]\s+\[([^\]]*)\]\s+\[[^\]]*\]\s+\[([^\]]*)\]\s?(.*)$/;
const AFFINITY_PREFIX = 'session-affinity:';
const GIN_RE = /^(\d{3})\s*\|\s*([^|]*?)\s*\|\s*[^|]*?\|\s*([A-Z]+)\s+"([^"]*)"/;

export const emptyRoutingLog = (): RoutingLog => ({ events: [], pendingGin: {} });

const UNIT_MS: Record<string, number> = {
  h: 3_600_000,
  m: 60_000,
  s: 1000,
  ms: 1,
  us: 0.001,
  µs: 0.001,
  μs: 0.001,
  ns: 0.000001,
};

/** Go durations such as "2.619s", "48ms", "1m2s", "1h2m3s", "850µs" to milliseconds. */
export function parseLatencyMs(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  const re = /(\d+(?:\.\d+)?)(ms|us|µs|μs|ns|h|m|s)/g;
  let total = 0;
  let consumed = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match.index !== consumed) return null;
    total += Number(match[1]) * UNIT_MS[match[2]];
    consumed = match.index + match[0].length;
  }
  if (consumed === 0 || consumed !== value.length) return null;
  return Math.round(total * 1000) / 1000;
}

/** Classify the text before " | " of a session-affinity message. */
export function classifyAffinityMessage(message: string): RoutingEventKind | null {
  const text = message.trim().toLowerCase();
  if (!text) return null;
  if (text.includes('reselected') || text.includes('bound to new auth')) return 'rebind';
  if (text.includes('cache miss') || text.includes('new binding')) return 'bind';
  if (text.includes('cache hit')) return 'hit';
  return null;
}

/** Parse "key=value key2=value2"; values contain no spaces. */
export function parseKeyValues(tail: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const token of tail.trim().split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq <= 0) continue;
    result[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return result;
}

/** Log timestamps are the proxy host's local wall clock. */
const parseTimestamp = (text: string): number => {
  const [date, time] = text.replace('T', ' ').split(' ');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi, s] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, s).getTime();
};

export type ParsedRoutingLine =
  { type: 'selector'; event: RoutingEvent } | { type: 'gin'; record: GinRecord } | null;

/** Parse one log line into a selector event, a gin record, or null. */
export function parseRoutingLine(line: string): ParsedRoutingLine {
  const match = LINE_RE.exec(line);
  if (!match) return null;
  const [, stamp, requestId, source, body] = match;

  if (body.startsWith(AFFINITY_PREFIX)) {
    const rest = body.slice(AFFINITY_PREFIX.length).trim();
    const sep = rest.indexOf(' | ');
    if (sep < 0) return null;
    const message = rest.slice(0, sep).trim();
    const kind = classifyAffinityMessage(message);
    if (!kind) return null;
    const fields = parseKeyValues(rest.slice(sep + 3));
    if (!fields.session || !fields.auth) return null;
    const event: RoutingEvent = {
      requestId,
      timestampMs: parseTimestamp(stamp),
      kind,
      message,
      session: fields.session,
      auth: fields.auth,
      provider: fields.provider ?? '',
      model: fields.model ?? '',
    };
    if (fields.parent) event.parent = fields.parent;
    if (fields.fallback) event.fallback = fields.fallback;
    return { type: 'selector', event };
  }

  if (source.split(':')[0] === 'gin_logger.go') {
    const gin = GIN_RE.exec(body);
    if (!gin) return null;
    const path = gin[4];
    if (path.startsWith('/v8/management')) return null;
    if (!requestId || requestId === NO_REQUEST_ID) return null;
    return {
      type: 'gin',
      record: {
        requestId,
        status: Number(gin[1]),
        latencyMs: parseLatencyMs(gin[2]),
        method: gin[3],
        path,
      },
    };
  }
  return null;
}

const mergeGin = (event: RoutingEvent, gin: GinRecord): RoutingEvent => ({
  ...event,
  status: gin.status,
  latencyMs: gin.latencyMs,
  method: gin.method,
  path: gin.path,
});

/**
 * Fold new log lines into the log. Oldest events are dropped past `cap`.
 * Returns `current` unchanged when nothing routing-related arrived.
 */
export function applyRoutingLines(
  current: RoutingLog,
  lines: readonly string[],
  cap = ROUTING_EVENT_CAP
): RoutingLog {
  const parsed = lines.map(parseRoutingLine).filter((item) => item !== null);
  if (parsed.length === 0) return current;

  const events = [...current.events];
  const pendingGin = { ...current.pendingGin };
  const waitingByRequest = new Map<string, number[]>();
  const wait = (requestId: string, index: number) => {
    if (requestId === NO_REQUEST_ID) return;
    const list = waitingByRequest.get(requestId);
    if (list) list.push(index);
    else waitingByRequest.set(requestId, [index]);
  };
  events.forEach((event, index) => {
    if (event.status === undefined) wait(event.requestId, index);
  });

  for (const item of parsed) {
    if (item.type === 'selector') {
      const pending = pendingGin[item.event.requestId];
      if (pending) {
        events.push(mergeGin(item.event, pending));
      } else {
        wait(item.event.requestId, events.length);
        events.push(item.event);
      }
      continue;
    }
    const waiting = waitingByRequest.get(item.record.requestId);
    if (waiting) {
      for (const index of waiting) events[index] = mergeGin(events[index], item.record);
      waitingByRequest.delete(item.record.requestId);
    }
    // Keep it: a later selector line for the same request (rebind) still needs it.
    pendingGin[item.record.requestId] = item.record;
  }

  const pendingIds = Object.keys(pendingGin);
  for (const id of pendingIds.slice(0, Math.max(0, pendingIds.length - PENDING_GIN_CAP))) {
    delete pendingGin[id];
  }
  return {
    events: events.length > cap ? events.slice(events.length - cap) : events,
    pendingGin,
  };
}

/** Client from the session prefix, falling back to the request path for Codex. */
export function clientForSession(
  session: string,
  path?: string
): { kind: RoutingClientKind; prefix: string } {
  const colon = session.indexOf(':');
  const prefix = colon > 0 ? session.slice(0, colon) : session;
  if (prefix === 'claude') return { kind: 'claude', prefix };
  if (prefix === 'lcp') return { kind: 'direct', prefix };
  if (prefix === 'codex' || (path ?? '').startsWith('/v1/responses')) {
    return { kind: 'codex', prefix };
  }
  return { kind: 'other', prefix };
}

const AUTH_PREFIX_RE = /^([a-z0-9_]+)-[0-9a-f]{8}-/i;

/** "claude-1776d4ba-a@b.org.json" becomes "a@b.org". */
export function accountLabel(auth: string): string {
  return auth.replace(AUTH_PREFIX_RE, '').replace(/\.json$/i, '') || auth;
}

/** Provider type for the icon: the auth id's leading segment, else the logged provider. */
export function accountProvider(auth: string, fallback = ''): string {
  const match = AUTH_PREFIX_RE.exec(auth);
  return match ? match[1].toLowerCase() : fallback;
}

export interface RoutingThread {
  session: string;
  client: { kind: RoutingClientKind; prefix: string };
  /** Newest first. */
  events: RoutingEvent[];
  accounts: string[];
  lastAuth: string;
  switched: boolean;
  models: string[];
  lastSeenMs: number;
}

/** Group by exact session string; threads sorted by last seen, newest first. */
export function buildThreads(events: readonly RoutingEvent[]): RoutingThread[] {
  const groups = new Map<string, RoutingEvent[]>();
  for (const event of events) {
    const list = groups.get(event.session);
    if (list) list.push(event);
    else groups.set(event.session, [event]);
  }
  const threads: RoutingThread[] = [];
  for (const [session, list] of groups) {
    // Stable sort keeps later arrivals first within the same second.
    const newest = list
      .map((event, index) => ({ event, index }))
      .sort((a, b) => b.event.timestampMs - a.event.timestampMs || b.index - a.index)
      .map(({ event }) => event);
    const accounts = [...new Set(list.map((event) => event.auth))];
    threads.push({
      session,
      client: clientForSession(session, list.find((event) => event.path)?.path),
      events: newest,
      accounts,
      lastAuth: newest[0].auth,
      switched: accounts.length > 1,
      models: [...new Set(newest.map((event) => event.model).filter(Boolean))],
      lastSeenMs: newest[0].timestampMs,
    });
  }
  return threads.sort((a, b) => b.lastSeenMs - a.lastSeenMs);
}

export interface RoutingAccount {
  auth: string;
  label: string;
  provider: string;
  requests: number;
  activeThreads: number;
  /** Fraction of all requests, 0..1. */
  share: number;
}

export const ACTIVE_THREAD_WINDOW_MS = 3_600_000;

/** One entry per account; a thread counts as active on the account that served its last event. */
export function buildAccounts(
  events: readonly RoutingEvent[],
  threads: readonly RoutingThread[],
  now: number
): RoutingAccount[] {
  const byAuth = new Map<string, RoutingAccount>();
  for (const event of events) {
    const entry = byAuth.get(event.auth);
    if (entry) {
      entry.requests += 1;
      continue;
    }
    byAuth.set(event.auth, {
      auth: event.auth,
      label: accountLabel(event.auth),
      provider: accountProvider(event.auth, event.provider),
      requests: 1,
      activeThreads: 0,
      share: 0,
    });
  }
  for (const thread of threads) {
    if (now - thread.lastSeenMs >= ACTIVE_THREAD_WINDOW_MS) continue;
    const entry = byAuth.get(thread.lastAuth);
    if (entry) entry.activeThreads += 1;
  }
  const total = events.length;
  return [...byAuth.values()]
    .map((entry) => ({ ...entry, share: total > 0 ? entry.requests / total : 0 }))
    .sort((a, b) => b.requests - a.requests || a.label.localeCompare(b.label));
}

/** Case-insensitive match on session key, account id and models; optional exact account. */
export function filterThreads(
  threads: readonly RoutingThread[],
  query: string,
  account = ''
): RoutingThread[] {
  const needle = query.trim().toLowerCase();
  return threads.filter((thread) => {
    if (account && !thread.accounts.includes(account)) return false;
    if (!needle) return true;
    if (thread.session.toLowerCase().includes(needle)) return true;
    if (thread.models.some((model) => model.toLowerCase().includes(needle))) return true;
    return thread.accounts.some((auth) => auth.toLowerCase().includes(needle));
  });
}
