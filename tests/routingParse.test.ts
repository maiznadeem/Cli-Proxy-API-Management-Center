import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { formatLatency, formatRelative, statusTone } from '../src/features/routing/model/format';
import {
  accountLabel,
  accountProvider,
  applyRoutingLines,
  buildAccounts,
  buildThreads,
  classifyAffinityMessage,
  clientForSession,
  emptyRoutingLog,
  filterThreads,
  parseLatencyMs,
  parseRoutingLine,
} from '../src/features/routing/model/parseRoutingLines';

const AUTH_A = 'claude-1776d4ba-tripp.forrest@ezspectrum.org.json';
const AUTH_B = 'codex-0a1b2c3d-ops@example.com.json';

const selector = (
  time: string,
  id: string,
  message: string,
  tail: string,
  source = 'selector.go:1063'
) => `[2026-10-03 ${time}] [${id}] [info ] [${source}] session-affinity: ${message} | ${tail}`;

const gin = (
  time: string,
  id: string,
  status: number,
  latency: string,
  method: string,
  path: string
) =>
  `[2026-10-03 ${time}] [${id}] [info ] [gin_logger.go:108] ${status} | ${latency.padStart(13)} |             ::1 | ${method.padEnd(7)} "${path}"`;

describe('parseLatencyMs', () => {
  test('parses Go durations', () => {
    expect(parseLatencyMs('2.619s')).toBe(2619);
    expect(parseLatencyMs('48ms')).toBe(48);
    expect(parseLatencyMs('1m2s')).toBe(62000);
    expect(parseLatencyMs('1h2m3s')).toBe(3723000);
    expect(parseLatencyMs('1m2.5s')).toBe(62500);
    expect(parseLatencyMs('850µs')).toBe(0.85);
    expect(parseLatencyMs('  7.84s ')).toBe(7840);
  });

  test('rejects junk', () => {
    expect(parseLatencyMs('')).toBeNull();
    expect(parseLatencyMs('fast')).toBeNull();
    expect(parseLatencyMs('12')).toBeNull();
    expect(parseLatencyMs('2s extra')).toBeNull();
  });
});

describe('classifyAffinityMessage', () => {
  test.each([
    ['cache hit', 'hit'],
    ['fork cache hit', 'hit'],
    ['fallback cache hit', 'hit'],
    ['cache miss, new binding', 'bind'],
    ['LCP cache miss, new binding', 'bind'],
    ['cache hit but auth unavailable, reselected', 'rebind'],
    ['fork bound to new auth', 'rebind'],
  ])('%s is %s', (message, kind) => {
    expect(classifyAffinityMessage(message)).toBe(kind as 'hit' | 'bind' | 'rebind');
  });

  test('unknown messages are ignored', () => {
    expect(classifyAffinityMessage('evicted stale entries')).toBeNull();
    expect(classifyAffinityMessage('')).toBeNull();
  });
});

describe('parseRoutingLine', () => {
  test('parses an LCP selector line', () => {
    const line = selector(
      '21:41:35',
      '7b88417e',
      'LCP cache miss, new binding',
      `session=lcp:v1:5... auth=${AUTH_A} provider=mixed model=claude-sonnet-5`,
      'selector.go:1228'
    );
    expect(parseRoutingLine(line)).toEqual({
      type: 'selector',
      event: {
        requestId: '7b88417e',
        timestampMs: new Date(2026, 9, 3, 21, 41, 35).getTime(),
        kind: 'bind',
        message: 'LCP cache miss, new binding',
        session: 'lcp:v1:5...',
        auth: AUTH_A,
        provider: 'mixed',
        model: 'claude-sonnet-5',
      },
    });
  });

  test('keeps parent and fallback fields', () => {
    const fork = parseRoutingLine(
      selector(
        '21:42:00',
        'aaaa0001',
        'fork cache hit',
        `session=claude:x parent=claude:p auth=${AUTH_A} provider=mixed model=m`
      )
    );
    expect(fork?.type === 'selector' && fork.event.parent).toBe('claude:p');
    const fallback = parseRoutingLine(
      selector(
        '21:42:00',
        'aaaa0002',
        'fallback cache hit',
        `session=claude:x fallback=lcp:y auth=${AUTH_A} provider=mixed model=m`
      )
    );
    expect(fallback?.type === 'selector' && fallback.event.fallback).toBe('lcp:y');
  });

  test('parses gin lines and ignores management traffic', () => {
    expect(
      parseRoutingLine(gin('21:41:38', '7b88417e', 200, '2.619s', 'POST', '/v1/messages'))
    ).toEqual({
      type: 'gin',
      record: {
        requestId: '7b88417e',
        status: 200,
        latencyMs: 2619,
        method: 'POST',
        path: '/v1/messages',
      },
    });
    expect(
      parseRoutingLine(
        gin('21:41:38', 'abcd1234', 200, '47ms', 'GET', '/v8/management/observability/logs')
      )
    ).toBeNull();
    expect(
      parseRoutingLine(gin('21:41:38', '--------', 200, '47ms', 'POST', '/v1/messages'))
    ).toBeNull();
  });

  test('ignores unrelated and malformed lines', () => {
    expect(
      parseRoutingLine(
        '[2026-10-03 21:41:31] [--------] [info ] [clients.go:152] full client load complete'
      )
    ).toBeNull();
    expect(parseRoutingLine('not a log line')).toBeNull();
    expect(
      parseRoutingLine(selector('21:00:00', 'abcd1234', 'cache hit', 'session=claude:x'))
    ).toBeNull();
  });
});

describe('applyRoutingLines', () => {
  const lines = [
    selector(
      '21:42:09',
      'e63d7215',
      'cache miss, new binding',
      `session=claude:5... auth=${AUTH_A} provider=mixed model=claude-fable-5-1`,
      'selector.go:1109'
    ),
    gin('21:42:20', 'e63d7215', 200, '11.2s', 'POST', '/v1/messages?beta=true'),
    selector(
      '21:42:27',
      'e5801724',
      'cache hit',
      `session=claude:5... auth=${AUTH_A} provider=mixed model=claude-fable-5-1`
    ),
  ];

  test('joins selector and gin lines by request id', () => {
    const log = applyRoutingLines(emptyRoutingLog(), lines);
    expect(log.events).toHaveLength(2);
    expect(log.events[0]).toMatchObject({
      status: 200,
      latencyMs: 11200,
      method: 'POST',
      path: '/v1/messages?beta=true',
    });
    expect(log.events[1].status).toBeUndefined();
  });

  test('joins across pages and when gin arrives first', () => {
    let log = applyRoutingLines(emptyRoutingLog(), lines);
    log = applyRoutingLines(log, [
      gin('21:42:30', 'e5801724', 429, '48ms', 'POST', '/v1/messages'),
    ]);
    expect(log.events[1]).toMatchObject({ status: 429, latencyMs: 48 });

    let early = applyRoutingLines(emptyRoutingLog(), [
      gin('21:42:30', 'ffff0000', 500, '1m2s', 'POST', '/v1/responses'),
    ]);
    expect(early.events).toHaveLength(0);
    early = applyRoutingLines(early, [
      selector(
        '21:42:29',
        'ffff0000',
        'cache hit',
        `session=codex:abc auth=${AUTH_B} provider=codex model=gpt-5`
      ),
    ]);
    expect(early.events[0]).toMatchObject({ status: 500, latencyMs: 62000 });
  });

  test('returns the same object when nothing relevant arrived', () => {
    const log = applyRoutingLines(emptyRoutingLog(), lines);
    expect(applyRoutingLines(log, ['noise'])).toBe(log);
    expect(applyRoutingLines(log, [])).toBe(log);
  });

  test('caps the ring, dropping oldest', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      selector(
        `21:00:${String(i).padStart(2, '0')}`,
        `0000000${i.toString(16)}`,
        'cache hit',
        `session=claude:${i} auth=${AUTH_A} provider=mixed model=m`
      )
    );
    const log = applyRoutingLines(emptyRoutingLog(), many, 10);
    expect(log.events).toHaveLength(10);
    expect(log.events[0].session).toBe('claude:2');
  });
});

describe('clients and accounts', () => {
  test('derives the client', () => {
    expect(clientForSession('claude:5...').kind).toBe('claude');
    expect(clientForSession('lcp:v1:5...').kind).toBe('direct');
    expect(clientForSession('codex:abc').kind).toBe('codex');
    expect(clientForSession('xyz:1', '/v1/responses').kind).toBe('codex');
    expect(clientForSession('gemini:1')).toEqual({ kind: 'other', prefix: 'gemini' });
  });

  test('labels accounts', () => {
    expect(accountLabel(AUTH_A)).toBe('tripp.forrest@ezspectrum.org');
    expect(accountLabel('plain.json')).toBe('plain');
    expect(accountLabel('')).toBe('');
    expect(accountProvider(AUTH_B)).toBe('codex');
    expect(accountProvider('custom', 'mixed')).toBe('mixed');
  });
});

describe('threads, accounts, filters', () => {
  const lines = [
    selector(
      '21:00:00',
      'a0000001',
      'cache miss, new binding',
      `session=claude:5a3423e4-68db-44df-bbd1-... auth=${AUTH_A} provider=mixed model=claude-opus-5-5`
    ),
    selector(
      '21:05:00',
      'a0000002',
      'cache hit but auth unavailable, reselected',
      `session=claude:5a3423e4-68db-44df-bbd1-... auth=${AUTH_B} provider=mixed model=claude-fable-5-1`
    ),
    selector(
      '21:10:00',
      'a0000003',
      'LCP cache miss, new binding',
      `session=lcp:v1:5... auth=${AUTH_A} provider=mixed model=claude-sonnet-5`
    ),
    selector(
      '19:00:00',
      'a0000004',
      'cache hit',
      `session=codex:old auth=${AUTH_B} provider=codex model=gpt-5`
    ),
  ];
  const log = applyRoutingLines(emptyRoutingLog(), lines);
  const threads = buildThreads(log.events);

  test('groups by exact session and sorts by last seen', () => {
    expect(threads.map((thread) => thread.session)).toEqual([
      'lcp:v1:5...',
      'claude:5a3423e4-68db-44df-bbd1-...',
      'codex:old',
    ]);
    const claude = threads[1];
    expect(claude.switched).toBe(true);
    expect(claude.lastAuth).toBe(AUTH_B);
    expect(claude.events[0].kind).toBe('rebind');
    expect(claude.models).toEqual(['claude-fable-5-1', 'claude-opus-5-5']);
    expect(threads[0].switched).toBe(false);
  });

  test('summarizes accounts with active threads in the last hour', () => {
    const now = new Date(2026, 9, 3, 21, 30, 0).getTime();
    const accounts = buildAccounts(log.events, threads, now);
    expect(accounts).toHaveLength(2);
    const a = accounts.find((entry) => entry.auth === AUTH_A)!;
    const b = accounts.find((entry) => entry.auth === AUTH_B)!;
    expect(a).toMatchObject({ requests: 2, activeThreads: 1, provider: 'claude', share: 0.5 });
    expect(b).toMatchObject({ requests: 2, activeThreads: 1, provider: 'codex' });
  });

  test('filters by query and account', () => {
    expect(filterThreads(threads, 'SONNET').map((t) => t.session)).toEqual(['lcp:v1:5...']);
    expect(filterThreads(threads, 'ezspectrum')).toHaveLength(2);
    expect(filterThreads(threads, '5a3423e4')).toHaveLength(1);
    expect(filterThreads(threads, '', AUTH_B)).toHaveLength(2);
    expect(filterThreads(threads, 'gpt', AUTH_A)).toHaveLength(0);
    expect(filterThreads(threads, '  ')).toHaveLength(3);
  });
});

describe('format helpers', () => {
  const t = ((key: string, options?: { count?: number }) =>
    options?.count === undefined ? key : `${key}:${options.count}`) as unknown as TFunction;

  test('formats latency', () => {
    expect(formatLatency(undefined)).toBe('');
    expect(formatLatency(null)).toBe('');
    expect(formatLatency(48)).toBe('48 ms');
    expect(formatLatency(2619)).toBe('2.62 s');
    expect(formatLatency(62000)).toBe('1m 2s');
    expect(formatLatency(119_600)).toBe('2m 0s');
  });

  test('formats relative time', () => {
    const now = 10 * 86_400_000;
    expect(formatRelative(t, now, now - 30_000)).toBe('routing.relative_now');
    expect(formatRelative(t, now, now - 5 * 60_000)).toBe('routing.relative_minutes:5');
    expect(formatRelative(t, now, now - 3 * 3_600_000)).toBe('routing.relative_hours:3');
    expect(formatRelative(t, now, now - 3 * 86_400_000)).toBe('routing.relative_days:3');
  });

  test('maps status to tone', () => {
    expect(statusTone(undefined)).toBe('pending');
    expect(statusTone(200)).toBe('ok');
    expect(statusTone(429)).toBe('warn');
    expect(statusTone(502)).toBe('error');
  });
});
