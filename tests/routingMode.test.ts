import { describe, expect, test } from 'bun:test';
import {
  applyRoutingSteps,
  planRoutingModeChange,
  routingModePatchValue,
  summarizeRouting,
} from '../src/features/authFiles/routingMode';
import { normalizeAuthFilesResponse } from '../src/services/api/authFiles';
import type { AuthFileItem, AuthFilesResponse, RoutingMode } from '../src/types';

const file = (name: string, type: string, routingMode?: RoutingMode): AuthFileItem => ({
  name,
  type,
  ...(routingMode ? { routingMode } : {}),
});

describe('planRoutingModeChange', () => {
  test('returns an empty plan when the mode is unchanged', () => {
    const files = [file('a.json', 'claude'), file('b.json', 'claude', 'preserve')];
    expect(planRoutingModeChange(files, files[0]!, 'normal')).toEqual([]);
    expect(planRoutingModeChange(files, files[1]!, 'preserve')).toEqual([]);
  });

  test('preserve and normal never touch other credentials', () => {
    const files = [file('a.json', 'claude'), file('b.json', 'claude', 'focus')];
    const plan = planRoutingModeChange(files, files[0]!, 'preserve');
    expect(plan.map((step) => [step.name, step.mode])).toEqual([['a.json', 'preserve']]);
    const release = planRoutingModeChange(files, files[1]!, 'normal');
    expect(release.map((step) => [step.name, step.mode])).toEqual([['b.json', 'normal']]);
  });

  test('focus patches the target first, then releases other focused credentials of the provider', () => {
    const files = [
      file('a.json', 'claude'),
      file('b.json', 'claude', 'focus'),
      file('c.json', 'claude', 'focus'),
      file('d.json', 'claude', 'preserve'),
      file('x.json', 'codex', 'focus'),
    ];
    const plan = planRoutingModeChange(files, files[0]!, 'focus');
    expect(plan.map((step) => [step.name, step.mode, step.releasesFocus])).toEqual([
      ['a.json', 'focus', false],
      ['b.json', 'normal', true],
      ['c.json', 'normal', true],
    ]);
    expect(plan.map((step) => step.previousMode)).toEqual(['normal', 'focus', 'focus']);
  });

  test('matches providers through normalized type or provider keys', () => {
    const files: AuthFileItem[] = [
      { name: 'a.json', provider: 'claude' },
      { name: 'b.json', type: 'Claude', routingMode: 'focus' },
    ];
    const plan = planRoutingModeChange(files, files[0]!, 'focus');
    expect(plan.map((step) => step.name)).toEqual(['a.json', 'b.json']);
  });
});

describe('applyRoutingSteps', () => {
  test('applies and rolls back a plan without mutating the input', () => {
    const files = [file('a.json', 'claude'), file('b.json', 'claude', 'focus')];
    const plan = planRoutingModeChange(files, files[0]!, 'focus');
    const applied = applyRoutingSteps(files, plan);
    expect(applied.map((f) => f.routingMode)).toEqual(['focus', undefined]);
    expect(files.map((f) => f.routingMode)).toEqual([undefined, 'focus']);
    const rolledBack = applyRoutingSteps(applied, plan, true);
    expect(rolledBack.map((f) => f.routingMode)).toEqual([undefined, 'focus']);
  });
});

describe('routing helpers', () => {
  test('normal clears the override on the wire', () => {
    expect(routingModePatchValue('normal')).toBeNull();
    expect(routingModePatchValue('focus')).toBe('focus');
    expect(routingModePatchValue('preserve')).toBe('preserve');
  });

  test('summarizeRouting groups focus names and preserved counts per provider', () => {
    const entries = [
      { type: 'claude', file: file('a.json', 'claude', 'focus') },
      { type: 'claude', file: file('b.json', 'claude', 'preserve') },
      { type: 'claude', file: file('c.json', 'claude', 'preserve') },
      { type: 'codex', file: file('d.json', 'codex') },
    ];
    const summary = summarizeRouting(entries, (f) => f.name);
    expect(summary.size).toBe(1);
    expect(summary.get('claude')).toEqual({
      provider: 'claude',
      focused: ['a.json'],
      preservedCount: 2,
    });
  });
});

describe('routing_mode parsing', () => {
  const parse = (files: Array<Record<string, unknown>>) =>
    normalizeAuthFilesResponse({ files } as unknown as AuthFilesResponse).files;

  test('reads valid values and ignores absent or unknown ones', () => {
    const result = parse([
      { name: 'focus.json', routing_mode: 'focus' },
      { name: 'preserve.json', routing_mode: ' Preserve ' },
      { name: 'normal.json', routing_mode: 'normal' },
      { name: 'absent.json' },
      { name: 'bogus.json', routing_mode: 'turbo' },
      { name: 'wrongtype.json', routing_mode: 3 },
    ]);
    const byName = Object.fromEntries(result.map((f) => [f.name, f.routingMode]));
    expect(byName).toEqual({
      'focus.json': 'focus',
      'preserve.json': 'preserve',
      'normal.json': 'normal',
      'absent.json': undefined,
      'bogus.json': undefined,
      'wrongtype.json': undefined,
    });
  });
});
