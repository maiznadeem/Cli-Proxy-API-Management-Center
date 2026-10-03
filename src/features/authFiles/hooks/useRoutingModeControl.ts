import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient, authFilesApi } from '@/services/api';
import { useNotificationStore } from '@/stores';
import type { AuthFileItem, RoutingMode } from '@/types';
import { getAuthFileRefreshKey } from '@/features/authFiles/manualRefresh';
import {
  applyRoutingSteps,
  planRoutingModeChange,
  routingModePatchValue,
} from '@/features/authFiles/routingMode';

export type UseRoutingModeControlOptions = {
  files: AuthFileItem[];
  setFiles: Dispatch<SetStateAction<AuthFileItem[]>>;
  /** Called once before the optimistic update, e.g. to drop in-flight list responses. */
  onBeforeMutate?: () => void;
};

export type UseRoutingModeControlResult = {
  /** Keys (getAuthFileRefreshKey) of credentials with a routing patch in flight. */
  routingUpdating: Record<string, boolean>;
  setRoutingMode: (file: AuthFileItem, mode: RoutingMode) => Promise<void>;
};

/**
 * Optimistic routing-mode changes. Focus is exclusive per provider: the target is patched
 * first, then other focused credentials of the provider are released one at a time. A failed
 * step rolls back only that credential; failures surface as a single toast.
 */
export function useRoutingModeControl(
  options: UseRoutingModeControlOptions
): UseRoutingModeControlResult {
  const { files, setFiles, onBeforeMutate } = options;
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [routingUpdating, setRoutingUpdating] = useState<Record<string, boolean>>({});
  const pendingRef = useRef(new Set<string>());

  const setRoutingMode = useCallback(
    async (file: AuthFileItem, mode: RoutingMode) => {
      const plan = planRoutingModeChange(files, file, mode);
      if (plan.length === 0) return;
      if (plan.some((step) => pendingRef.current.has(step.key))) return;

      const revision = apiClient.getConnectionRevision();
      const isCurrent = () => revision === apiClient.getConnectionRevision();
      const keys = plan.map((step) => step.key);
      keys.forEach((key) => pendingRef.current.add(key));
      setRoutingUpdating((prev) => {
        const next = { ...prev };
        keys.forEach((key) => {
          next[key] = true;
        });
        return next;
      });
      onBeforeMutate?.();
      setFiles((prev) => applyRoutingSteps(prev, plan));

      const failures: string[] = [];
      let targetFailed = false;
      try {
        for (const step of plan) {
          if (!isCurrent()) return;
          if (targetFailed) {
            // The target never took focus, so do not release anyone else.
            setFiles((prev) => (isCurrent() ? applyRoutingSteps(prev, [step], true) : prev));
            continue;
          }
          try {
            await authFilesApi.patchFields(step.name, {
              routing_mode: routingModePatchValue(step.mode),
            });
          } catch (err: unknown) {
            if (!isCurrent()) return;
            failures.push(err instanceof Error ? err.message : '');
            if (!step.releasesFocus) targetFailed = true;
            setFiles((prev) => (isCurrent() ? applyRoutingSteps(prev, [step], true) : prev));
          }
        }
        if (failures.length > 0 && isCurrent()) {
          const message = failures.find(Boolean) ?? '';
          showNotification(
            `${t('auth_files.routing_mode.update_failed')}${message ? `: ${message}` : ''}`,
            'error'
          );
        }
      } finally {
        keys.forEach((key) => pendingRef.current.delete(key));
        if (isCurrent()) {
          setRoutingUpdating((prev) => {
            const next = { ...prev };
            keys.forEach((key) => delete next[key]);
            return next;
          });
        }
      }
    },
    [files, onBeforeMutate, setFiles, showNotification, t]
  );

  return { routingUpdating, setRoutingMode };
}

export const isRoutingUpdating = (
  updating: Record<string, boolean> | undefined,
  file: AuthFileItem
): boolean => updating?.[getAuthFileRefreshKey(file)] === true;
