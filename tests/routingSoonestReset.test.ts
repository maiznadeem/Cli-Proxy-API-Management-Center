import { describe, expect, test } from 'bun:test';
import { draftFromBoard, resolveRoute } from '../src/features/routing/logic';
import {
  buildRoutingBoard,
  normalizeRoutingStrategy,
  readRoutingSettings,
} from '../src/services/api/routing';
import type { AuthFileItem } from '../src/types/authFile';
import { ROUTING_STRATEGIES, type RoutingModelCatalog } from '../src/types/routing';

// Fork-only: the backend fork adds a `soonest-reset` strategy. Upstream's routing board treats an
// unknown strategy as round-robin, which would show a false even split and let a save overwrite it.

const RAW = { routing: { strategy: 'soonest-reset', 'session-affinity': true } };

const FILES: AuthFileItem[] = [
  { name: 'a.json', type: 'claude', auth_index: 'a1' },
  { name: 'b.json', type: 'claude', auth_index: 'b1' },
] as AuthFileItem[];

const catalog: RoutingModelCatalog = { channels: {}, credentials: {} };

describe('routing board with the soonest-reset strategy', () => {
  test('is offered as a strategy and survives normalization', () => {
    expect(ROUTING_STRATEGIES).toContain('soonest-reset');
    expect(normalizeRoutingStrategy('soonest-reset')).toBe('soonest-reset');
    expect(normalizeRoutingStrategy('Soonest_Reset')).toBe('soonest-reset');
    expect(normalizeRoutingStrategy('something-else')).toBe('round-robin');
  });

  test('is read from the config as itself, not as round-robin', () => {
    expect(readRoutingSettings(RAW).strategy).toBe('soonest-reset');
  });

  test('has no fixed split', () => {
    const board = buildRoutingBoard(RAW, FILES);
    const draft = draftFromBoard(board);
    expect(draft.settings.strategy).toBe('soonest-reset');
    const preview = resolveRoute(board, draft, catalog, null, 0);
    expect(preview.tiers[0].state).toBe('active');
    for (const member of preview.tiers[0].members) expect(member.share).toBeNull();
  });

  test('every locale names and explains it', async () => {
    for (const locale of ['en', 'ko', 'ru', 'vi', 'zh-CN', 'zh-TW', 'tr']) {
      const data = await Bun.file(`src/i18n/locales/${locale}.json`).json();
      expect(data.routing.strategy_soonest_reset).toBeTruthy();
      expect(data.routing.strategy_soonest_reset_desc).toBeTruthy();
    }
  });
});
