/**
 * Manual routing mode helpers (pure).
 *
 * Preserve: the proxy sends no traffic to the credential.
 * Focus: the proxy sends all new traffic for the provider to focused credentials only.
 * Focus is exclusive per provider on the client: focusing one credential demotes any other
 * focused credential of the same provider back to normal. Preserve is not exclusive.
 */

import type { AuthFileItem, RoutingMode } from '@/types';
import { normalizeOAuthProviderKey } from '@/utils/providerKeys';
import { getAuthFileRefreshKey } from './manualRefresh';

export const ROUTING_MODES: readonly RoutingMode[] = ['normal', 'preserve', 'focus'];

export type RoutingPatchStep = {
  /** Credential file name sent to PATCH /credentials/fields. */
  name: string;
  /** Stable per-credential key (name + auth index), used for optimistic state. */
  key: string;
  mode: RoutingMode;
  /** Mode before the change, for rollback. */
  previousMode: RoutingMode;
  /** True for steps that release another credential's focus. */
  releasesFocus: boolean;
};

export const getRoutingMode = (file: AuthFileItem): RoutingMode => file.routingMode ?? 'normal';

/** Wire value for the patch: normal clears the override. */
export const routingModePatchValue = (mode: RoutingMode): RoutingMode | null =>
  mode === 'normal' ? null : mode;

export const routingProviderKey = (file: AuthFileItem): string =>
  normalizeOAuthProviderKey(String(file.type ?? file.provider ?? 'unknown'));

/**
 * Patch plan for setting `mode` on `target`. The target is patched first; releases of other
 * focused credentials of the same provider follow, so a failed target patch demotes nothing.
 * Returns an empty plan when the target already has the requested mode.
 */
export const planRoutingModeChange = (
  files: readonly AuthFileItem[],
  target: AuthFileItem,
  mode: RoutingMode
): RoutingPatchStep[] => {
  const targetKey = getAuthFileRefreshKey(target);
  const current = files.find((file) => getAuthFileRefreshKey(file) === targetKey) ?? target;
  const previousMode = getRoutingMode(current);
  if (previousMode === mode) return [];

  const plan: RoutingPatchStep[] = [
    { name: current.name, key: targetKey, mode, previousMode, releasesFocus: false },
  ];
  if (mode !== 'focus') return plan;

  const provider = routingProviderKey(current);
  files.forEach((file) => {
    const key = getAuthFileRefreshKey(file);
    if (key === targetKey) return;
    if (getRoutingMode(file) !== 'focus') return;
    if (routingProviderKey(file) !== provider) return;
    plan.push({ name: file.name, key, mode: 'normal', previousMode: 'focus', releasesFocus: true });
  });
  return plan;
};

/** Apply (or, with `rollback`, revert) plan steps to a file list without mutating it. */
export const applyRoutingSteps = (
  files: AuthFileItem[],
  steps: readonly RoutingPatchStep[],
  rollback = false
): AuthFileItem[] => {
  if (steps.length === 0) return files;
  const modeByKey = new Map(
    steps.map((step) => [step.key, rollback ? step.previousMode : step.mode])
  );
  return files.map((file) => {
    const mode = modeByKey.get(getAuthFileRefreshKey(file));
    if (mode === undefined) return file;
    const next: AuthFileItem = { ...file };
    if (mode === 'normal') delete next.routingMode;
    else next.routingMode = mode;
    return next;
  });
};

export type ProviderRoutingSummary = {
  provider: string;
  /** Display names of focused credentials, in list order. */
  focused: string[];
  preservedCount: number;
};

/** Per-provider focus/preserve summary; providers with neither are omitted. */
export const summarizeRouting = (
  entries: ReadonlyArray<{ type: string; file: AuthFileItem }>,
  displayName: (file: AuthFileItem) => string
): Map<string, ProviderRoutingSummary> => {
  const result = new Map<string, ProviderRoutingSummary>();
  entries.forEach(({ type, file }) => {
    const mode = getRoutingMode(file);
    if (mode === 'normal') return;
    const summary = result.get(type) ?? { provider: type, focused: [], preservedCount: 0 };
    if (mode === 'focus') summary.focused.push(displayName(file));
    else summary.preservedCount += 1;
    result.set(type, summary);
  });
  return result;
};
