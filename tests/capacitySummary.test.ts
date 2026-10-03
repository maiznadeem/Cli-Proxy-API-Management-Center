import { describe, expect, test } from 'bun:test';
import { summarizeCapacity } from '@/features/quota/capacitySummaryModel';
import type { QuotaFileEntry } from '@/features/quota/logic';
import type { QuotaCardState } from '@/features/quota/providers';
import type { AuthFileItem } from '@/types';

const file = (name: string, type: string): AuthFileItem =>
  ({ name, type, size: 0, modtime: '', disabled: false }) as unknown as AuthFileItem;

const entry = (name: string, type: QuotaFileEntry['type']): QuotaFileEntry =>
  ({ type, file: file(name, type) }) as QuotaFileEntry;

const claudeQuota = (fableUsed: number, sevenDayUsed: number, resetAtMs: number) =>
  ({
    status: 'success',
    windows: [
      {
        id: 'five_hour',
        label: '5-hour limit',
        usedPercent: 10,
        resetAtMs: resetAtMs - 3_600_000,
        periodHours: 5,
      },
      {
        id: 'seven_day',
        label: '7-day limit',
        usedPercent: sevenDayUsed,
        resetAtMs,
        periodHours: 168,
      },
      {
        id: 'seven_day_fable',
        label: '7-day Fable 5',
        usedPercent: fableUsed,
        resetAtMs,
        periodHours: 168,
      },
    ],
  }) as unknown as QuotaCardState;

describe('summarizeCapacity', () => {
  test('sums the Fable window across loaded Claude credentials and keeps unloaded ones', () => {
    const entries = [
      entry('claude-a.json', 'claude'),
      entry('claude-b.json', 'claude'),
      entry('claude-c.json', 'claude'),
    ];
    const quotas: Record<string, QuotaCardState | undefined> = {
      'claude-a.json': claudeQuota(10, 50, 2_000_000),
      'claude-b.json': claudeQuota(60, 20, 1_000_000),
      'claude-c.json': undefined,
    };
    const [claude] = summarizeCapacity(entries, (e) => quotas[e.file.name]);

    expect(claude.provider).toBe('claude');
    expect(claude.total).toBe(3);
    expect(claude.loaded).toBe(2);
    // 90 remaining + 40 remaining
    expect(claude.remainingSum).toBe(130);
    expect(claude.segments).toEqual([90, 40, null]);
    expect(claude.nextResetMs).toBe(1_000_000);
    expect(claude.headlineLabel).toBe('7-day Fable 5');
  });

  test('orders providers by the tab order and omits providers without credentials', () => {
    const entries = [entry('x.json', 'xai'), entry('c.json', 'claude')];
    const result = summarizeCapacity(entries, () => undefined);
    expect(result.map((item) => item.provider)).toEqual(['claude', 'xai']);
    expect(result[1].loaded).toBe(0);
    expect(result[1].nextResetMs).toBeNull();
  });
});
