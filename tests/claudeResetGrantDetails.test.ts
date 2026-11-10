import { beforeAll, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { ClaudeResetGrantDetails } from '@/features/quota/providers/claude/ClaudeResetGrantDetails';
import { bindQuotaClasses, QUOTA_CLASS_KEYS } from '@/features/quota/types';
import type { AnthropicResetGrant } from '@/services/api/claudeResetGrants';
import { formatInstantShort } from '@/utils/quota';
import { resolveTimeZoneLabel } from '@/utils/time/timezone';

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test-host'
);
const expiry = Date.now() + 11 * 86400_000;
const grant = (overrides: Partial<AnthropicResetGrant> = {}): AnthropicResetGrant => ({
  id: 'launch',
  label: 'Launch',
  resetsTotal: 3,
  resetsLeft: 2,
  startsAt: null,
  endsAt: new Date(expiry).toISOString(),
  clears: ['five_hour'],
  paused: false,
  usableNow: true,
  useRequiresLimit: true,
  percentUsed: {},
  ...overrides,
});
const render = (grants: AnthropicResetGrant[]) =>
  renderToStaticMarkup(createElement(ClaudeResetGrantDetails, { grants, classes }));

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('Claude reset grant details', () => {
  test('uses Codex detail classes, timezone, remaining count and live relative date', () => {
    const markup = render([grant()]);
    expect(markup).toContain('class="codexResetCredits"');
    expect(markup).toContain('class="codexResetCreditRow"');
    expect(markup).toContain(resolveTimeZoneLabel());
    expect(markup).toContain('Launch · 5-hour limit · 2 / 3 resets remaining');
    expect(markup).toContain('Free resets · 2 left');
    expect(markup).toContain('Expires in 11 days');
    expect(markup).toContain(formatInstantShort(expiry));
    expect(markup).toContain('class="quotaResetRelative"');
    expect(markup).toContain('in 11 days');
  });

  test('names launch and tenure grants from their ids, not the campaign copy', () => {
    const copy = 'New model launch: one more Fable reset at 12 months&#x27; tenure';
    const markup = render([
      grant({ id: 'launch-2610-fable', label: 'New model launch: one Fable reset for Max', resetsTotal: 1, resetsLeft: 1, clears: ['seven_day_overage_included'] }),
      grant({ id: 'launch-2610-fable-12mo', label: "New model launch: one more Fable reset at 12 months' tenure", resetsTotal: 1, resetsLeft: 1, clears: ['seven_day_overage_included'] }),
      grant({ id: 'launch-2610-fable-6mo', label: 'x', resetsTotal: 1, resetsLeft: 1, clears: ['seven_day', 'seven_day_overage_included'] }),
    ]);
    expect(markup).toContain('Launch bonus · 7-day limit · 1 reset left');
    expect(markup).toContain('12-month loyalty bonus · 7-day limit · 1 reset left');
    expect(markup).toContain('6-month loyalty bonus · 7-day limit · 1 reset left');
    expect(markup).toContain('Free resets · 3 left');
    expect(markup).toContain(`title="${copy}"`);
    expect(markup).not.toContain('>New model launch');
  });

  test('hides empty and spent grants', () => {
    expect(render([])).toBe('');
    expect(render([grant({ resetsLeft: 0 })])).toBe('');
    expect(render([grant(), grant({ id: 'spent', label: 'Spent', resetsLeft: 0 })])).not.toContain(
      'Spent'
    );
  });

  test('sorts by deadline without mutating input and keeps unknown dates last', () => {
    const grants = [
      grant({ id: 'unknown', label: 'Unknown', endsAt: null }),
      grant({ id: 'later', label: 'Later', endsAt: new Date(expiry + 86400_000).toISOString() }),
      grant({ id: 'first', label: 'First' }),
    ];
    const markup = render(grants);
    expect(markup.indexOf('First')).toBeLessThan(markup.indexOf('Later'));
    expect(markup.indexOf('Later')).toBeLessThan(markup.indexOf('Unknown'));
    expect(markup).toContain('Expiry unknown');
    expect(grants.map((item) => item.id)).toEqual(['unknown', 'later', 'first']);
  });

  test('keeps paused and expired unspent grants visible without implying usability', () => {
    const markup = render([
      grant({ paused: true, usableNow: false, endsAt: '2020-01-01T00:00:00Z' }),
    ]);
    expect(markup).toContain(formatInstantShort(Date.parse('2020-01-01T00:00:00Z')));
    expect(markup).not.toContain('<button');
  });

  test.each(['en', 'zh-CN', 'zh-TW', 'ru', 'vi'])(
    'translates fallback labels in %s',
    async (lng) => {
      await i18n.changeLanguage(lng);
      try {
        const markup = render([grant({ label: '', endsAt: null })]);
        expect(markup).toContain(i18n.t('claude_reset.grant_number', { index: 1 }));
        expect(markup).toContain(i18n.t('claude_reset.expiry_unknown'));
        expect(markup).not.toContain('claude_reset.');
      } finally {
        await i18n.changeLanguage('en');
      }
    }
  );
});
