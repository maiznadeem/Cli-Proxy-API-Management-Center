import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { resolveClaudeBreakdown } from '@/features/quota/providers/claude/data';

const t = ((key: string) => key) as TFunction;

describe('Claude week-by-surface breakdown', () => {
  test('orders surfaces by share, drops empty rows, and translates known keys', () => {
    const breakdown = resolveClaudeBreakdown(
      {
        seven_day: { utilization: 12, resets_at: null },
        seven_day_breakdown: {
          as_of: '2026-11-01T07:29:23.515212+00:00',
          window_started_at: '2026-10-27T02:00:00.465269+00:00',
          rows: [
            { key: 'claude_code', display_name: 'Claude Code', percent: 61 },
            { key: 'chat', display_name: 'Chats', percent: 3 },
            { key: 'cowork', display_name: 'Cowork', percent: 36 },
            { key: 'other', display_name: 'Other', percent: 0 },
          ],
        },
      },
      t
    );
    expect(breakdown).toEqual({
      asOfMs: Date.parse('2026-11-01T07:29:23.515212+00:00'),
      usedPercent: 12,
      rows: [
        { key: 'claude_code', label: 'claude_quota.surface_claude_code', percent: 61 },
        { key: 'cowork', label: 'claude_quota.surface_cowork', percent: 36 },
        { key: 'chat', label: 'claude_quota.surface_chat', percent: 3 },
      ],
    });
  });

  test('keeps the upstream display name for a surface it has never seen', () => {
    const breakdown = resolveClaudeBreakdown(
      {
        seven_day_breakdown: {
          rows: [{ key: 'desktop_agent', display_name: 'Desktop', percent: 12 }],
        },
      },
      t
    );
    expect(breakdown?.rows).toEqual([{ key: 'desktop_agent', label: 'Desktop', percent: 12 }]);
    expect(breakdown?.asOfMs).toBeNull();
    expect(breakdown?.usedPercent).toBeNull();
  });

  test('returns null when the payload has no breakdown or only empty rows', () => {
    expect(resolveClaudeBreakdown({}, t)).toBeNull();
    expect(resolveClaudeBreakdown({ seven_day_breakdown: null }, t)).toBeNull();
    expect(
      resolveClaudeBreakdown({ seven_day_breakdown: { rows: [{ key: 'chat', percent: 0 }] } }, t)
    ).toBeNull();
  });
});
