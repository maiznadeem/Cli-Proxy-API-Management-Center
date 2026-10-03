import type { TFunction } from 'i18next';

/** "just now", "12 min ago", "5 h ago", "3 d ago". */
export const formatRelative = (t: TFunction, now: number, ms: number): string => {
  const minutes = Math.floor(Math.max(0, now - ms) / 60_000);
  if (minutes < 1) return t('routing.relative_now');
  if (minutes < 60) return t('routing.relative_minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t('routing.relative_hours', { count: hours });
  return t('routing.relative_days', { count: Math.floor(hours / 24) });
};

/** "48 ms", "2.62 s", "1m 2s"; empty when unknown. */
export const formatLatency = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export type StatusTone = 'pending' | 'ok' | 'warn' | 'error';

export const statusTone = (status?: number): StatusTone => {
  if (status === undefined) return 'pending';
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'ok';
};
