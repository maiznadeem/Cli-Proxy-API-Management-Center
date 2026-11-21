import { beforeAll, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { AntigravityDetails } from '@/features/quota/providers/antigravity/AntigravityDetails';
import { ClaudeDetails } from '@/features/quota/providers/claude/ClaudeDetails';
import { CodexDetails } from '@/features/quota/providers/codex/CodexDetails';
import { bindQuotaClasses, QUOTA_CLASS_KEYS } from '@/features/quota/types';

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test-host'
);
const file = { name: 'empty.json' } as never;
const count = (markup: string, text: string) => markup.split(text).length - 1;

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

// A fact the provider does not report stays on screen as "Unavailable" instead of vanishing.
describe('details drawers show missing facts as unavailable', () => {
  test('Claude keeps plan, credits, last checked and renewal rows', () => {
    const markup = renderToStaticMarkup(
      createElement(ClaudeDetails, {
        quota: { status: 'success', windows: [] } as never,
        file,
        classes,
        extras: { grants: [], grantMessage: '' },
      })
    );
    for (const label of ['Plan', 'Last checked', 'Renews']) expect(markup).toContain(label);
    expect(count(markup, '>Unavailable<')).toBeGreaterThanOrEqual(4);
    expect(markup).toContain('This provider reports no subscription date.');
  });

  test('Codex keeps plan, renewal, balance, overage and the resets section', () => {
    const markup = renderToStaticMarkup(
      createElement(CodexDetails, {
        quota: { status: 'success', windows: [] } as never,
        file,
        classes,
        extras: { creditOverage: null },
      })
    );
    expect(markup).toContain('Manual resets');
    expect(markup).toContain('Resets unavailable');
    expect(count(markup, '>Unavailable<')).toBe(4);
  });

  test('Codex with no banked resets says so', () => {
    const markup = renderToStaticMarkup(
      createElement(CodexDetails, {
        quota: { status: 'success', rateLimitResetCreditsAvailableCount: 0 } as never,
        file,
        classes,
      })
    );
    expect(markup).toContain('No resets available on this account.');
  });

  test('Antigravity shows plan, renewal and model groups as unavailable', () => {
    const markup = renderToStaticMarkup(
      createElement(AntigravityDetails, {
        quota: { status: 'success', groups: [] } as never,
        file,
        classes,
      })
    );
    expect(markup).toContain('Renews');
    expect(markup).toContain('Model groups');
    expect(count(markup, 'Unavailable')).toBe(3);
  });
});

describe('the card never hides a reset control or renewal badge', () => {
  test('source contract', async () => {
    const card = await Bun.file('src/features/quota/components/QuotaCard.tsx').text();
    expect(card).toContain("t('quota_management.renewal_unavailable')");
    expect(card).toContain("t('quota_management.state_resets_unavailable')");
    expect(card).toContain('disabled={!canReset || !canRefresh || loading || resetting}');
    expect(card).not.toContain('creditOverage.visible && (');
    expect(card).not.toContain("entry.type === 'claude' && !claudeLocked && (");
  });

  test('every locale has the wording', async () => {
    const keys = [
      'unavailable',
      'renewal_unavailable',
      'renewal_unavailable_hint',
      'state_resets_unavailable',
      'state_manual_resets_other',
      'reset_none_hint',
      'reset_locked_hint',
      'reset_overage_unavailable_hint',
    ];
    for (const locale of ['en', 'ko', 'ru', 'vi', 'zh-CN', 'zh-TW', 'tr']) {
      const data = await Bun.file(`src/i18n/locales/${locale}.json`).json();
      for (const key of keys) expect(data.quota_management[key]).toBeTruthy();
    }
  });
});
