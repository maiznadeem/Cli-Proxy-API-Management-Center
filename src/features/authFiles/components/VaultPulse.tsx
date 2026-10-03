import { useMemo } from 'react';
import type { AuthFileItem } from '@/types';
import { hasAuthFileStatusWarning } from '@/features/authFiles/constants';
import type { AuthFileStatusBarData } from '@/features/authFiles/hooks/useAuthFilesStatusBarCache';
import styles from './VaultPulse.module.scss';

/** Most credentials drawn in the strip; the rest are summarised as "+N". */
const MAX_BARS = 160;

type PulseState = 'live' | 'idle' | 'warning' | 'problem';

type PulseBar = {
  key: string;
  state: PulseState;
  disabled: boolean;
};

export type VaultPulseProps = {
  files: AuthFileItem[];
  statusBarCache: Map<string, AuthFileStatusBarData>;
};

const STATE_CLASS: Record<PulseState, string> = {
  live: styles.barLive,
  idle: styles.barIdle,
  warning: styles.barWarning,
  problem: styles.barProblem,
};

/**
 * Health strip: one bar per credential, coloured and sized by state (colour-blind safe):
 * recent traffic = plenty, enabled without data = track, warning = watch, unavailable =
 * depleted; disabled bars are faded and short. Decorative (aria-hidden); the header summary
 * carries the text equivalent.
 */
export function VaultPulse({ files, statusBarCache }: VaultPulseProps) {
  const bars = useMemo<PulseBar[]>(
    () =>
      files.slice(0, MAX_BARS).map((file) => {
        const disabled = file.disabled === true;
        let state: PulseState;
        if (file.unavailable === true) {
          state = 'problem';
        } else if (hasAuthFileStatusWarning(file)) {
          state = 'warning';
        } else {
          const authIndexKey = typeof file.authIndex === 'string' ? file.authIndex : null;
          const statusData = authIndexKey ? statusBarCache.get(authIndexKey) : undefined;
          const hasTraffic =
            Boolean(statusData) &&
            (statusData?.totalSuccess ?? 0) + (statusData?.totalFailure ?? 0) > 0;
          state = hasTraffic ? 'live' : 'idle';
        }
        return { key: file.name, state, disabled };
      }),
    [files, statusBarCache]
  );

  const overflow = files.length - bars.length;

  if (bars.length === 0) {
    return (
      <div className={styles.pulse} aria-hidden="true">
        <span className={styles.idleLine} />
      </div>
    );
  }

  return (
    <div className={styles.pulse} aria-hidden="true">
      <div className={styles.bars}>
        {bars.map((bar) => (
          <span
            key={bar.key}
            className={`${styles.bar} ${STATE_CLASS[bar.state]} ${bar.disabled ? styles.barDisabled : ''}`}
          />
        ))}
      </div>
      {overflow > 0 && <span className={styles.overflow}>+{overflow}</span>}
    </div>
  );
}
