import { describe, expect, test } from 'bun:test';
import {
  nextMonthlyAnniversary,
  resolveQuotaRenewal,
  resolveRenewalInfo,
} from '../src/features/quota/renewal';
import { buildTimelineLane, projectRenewal } from '../src/features/quota/quotaTimelineModel';

const utc = (iso: string) => new Date(iso).getTime();

describe('subscription renewal dates', () => {
  test('a monthly plan renews on the same day and time each month', () => {
    const start = utc('2026-07-14T15:26:28Z');
    expect(nextMonthlyAnniversary(start, utc('2026-11-21T12:00:00Z'))).toBe(
      utc('2026-12-14T15:26:28Z')
    );
    expect(nextMonthlyAnniversary(start, utc('2026-11-10T00:00:00Z'))).toBe(
      utc('2026-11-14T15:26:28Z')
    );
  });

  test('a start on the 31st renews on the last day of shorter months', () => {
    const start = utc('2026-01-31T10:00:00Z');
    expect(nextMonthlyAnniversary(start, utc('2026-02-01T00:00:00Z'))).toBe(
      utc('2026-02-28T10:00:00Z')
    );
    expect(nextMonthlyAnniversary(start, utc('2026-12-31T11:00:00Z'))).toBe(
      utc('2027-01-31T10:00:00Z')
    );
  });

  test('never returns the start itself or a date before it', () => {
    const start = utc('2026-11-20T09:00:00Z');
    expect(nextMonthlyAnniversary(start, utc('2026-11-01T00:00:00Z'))).toBe(
      utc('2026-12-20T09:00:00Z')
    );
  });

  test('Claude derives an estimate from the start date; a cancelled one ends', () => {
    const now = utc('2026-11-21T12:00:00Z');
    const quota = {
      subscriptionCreatedAt: '2026-07-14T15:26:28Z',
      billing: { access: 'ending' },
    };
    expect(resolveQuotaRenewal('claude', quota, now)).toEqual({
      atMs: utc('2026-12-14T15:26:28Z'),
      estimated: true,
      ending: true,
    });
    expect(
      resolveQuotaRenewal('claude', { subscriptionCreatedAt: '2026-07-14T15:26:28Z' }, now)?.ending
    ).toBe(false);
  });

  test('Codex uses the exact active-until instant, in seconds or ISO', () => {
    const now = utc('2026-11-21T12:00:00Z');
    expect(
      resolveQuotaRenewal('codex', { subscriptionActiveUntil: '2026-12-19T08:58:07Z' }, now)
    ).toEqual({ atMs: utc('2026-12-19T08:58:07Z'), estimated: false, ending: false });
    expect(resolveQuotaRenewal('codex', { subscriptionActiveUntil: 1797670687 }, now)?.atMs).toBe(
      1797670687000
    );
  });

  test('providers that report nothing get no renewal', () => {
    expect(resolveRenewalInfo('antigravity', { groups: [] })).toBeNull();
    expect(resolveRenewalInfo('claude', { windows: [] })).toBeNull();
    expect(resolveRenewalInfo('codex', null)).toBeNull();
  });
});

describe('renewal on the quota windows timeline', () => {
  const now = utc('2026-12-08T12:00:00Z');
  const lane = buildTimelineLane({
    name: 'a.json',
    displayName: 'a',
    provider: 'claude',
    maxPeriodHours: 24 * 14,
    quota: {
      status: 'success',
      windows: [
        {
          id: 'seven-day',
          label: 'Weekly',
          usedPercent: 20,
          resetAtMs: utc('2026-12-13T08:00:00Z'),
          periodHours: 168,
        },
      ],
      subscriptionCreatedAt: '2026-07-14T15:26:28Z',
    } as never,
  });

  test('is marked when it falls inside the visible span', () => {
    const mark = projectRenewal(
      lane,
      utc('2026-12-07T00:00:00Z'),
      utc('2026-12-21T00:00:00Z'),
      now
    );
    expect(mark?.atMs).toBe(utc('2026-12-14T15:26:28Z'));
    expect(mark?.leftPercent).toBeGreaterThan(0);
    expect(mark?.leftPercent).toBeLessThan(100);
  });

  test('is absent when the span does not reach it', () => {
    expect(
      projectRenewal(lane, utc('2026-12-15T00:00:00Z'), utc('2026-12-29T00:00:00Z'), now)
    ).toBeNull();
  });

  test('an ending subscription is marked only on the day access stops', () => {
    const ending = { ...lane, renewal: { ...lane.renewal!, ending: true } };
    expect(
      projectRenewal(ending, utc('2027-01-07T00:00:00Z'), utc('2027-01-21T00:00:00Z'), now)
    ).toBeNull();
    expect(
      projectRenewal(ending, utc('2026-12-07T00:00:00Z'), utc('2026-12-21T00:00:00Z'), now)?.atMs
    ).toBe(utc('2026-12-14T15:26:28Z'));
  });

  test('every locale has the renewal wording', async () => {
    const keys = [
      'renewal_renews',
      'renewal_ends',
      'renewal_label',
      'renewal_ends_label',
      'renewal_estimated_hint',
      'windows_legend_renewal',
      'windows_renewal',
      'windows_renewal_ending',
    ];
    for (const locale of ['en', 'ko', 'ru', 'vi', 'zh-CN', 'zh-TW', 'tr']) {
      const data = await Bun.file(`src/i18n/locales/${locale}.json`).json();
      for (const key of keys) expect(data.quota_management[key]).toBeTruthy();
    }
  });
});
