/**
 * Capacity meter.
 *
 * The fill is coloured along a continuous capacity scale (plenty → watch → depleted) driven by
 * `--meter-value` (0–100, remaining percent). The three class names are kept because the quota
 * class contract requires them; the stylesheet uses them to pick which two scale stops to mix.
 * `percent === null` renders an empty track: unknown is not coloured.
 */

import type { CSSProperties } from 'react';
import type { QuotaClassMap } from '../types';

export const QUOTA_PROGRESS_HIGH_THRESHOLD = 70;
export const QUOTA_PROGRESS_MEDIUM_THRESHOLD = 30;

export interface QuotaMeterProps {
  percent: number | null;
  classes: QuotaClassMap;
  index?: number;
}

type MeterStyle = CSSProperties & { '--meter-index'?: number; '--meter-value'?: number };

export function QuotaMeter({ percent, classes, index }: QuotaMeterProps) {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const normalized = percent === null ? null : clamp(percent, 0, 100);
  const fillClass =
    normalized === null
      ? classes.quotaBarFillMedium
      : normalized >= QUOTA_PROGRESS_HIGH_THRESHOLD
        ? classes.quotaBarFillHigh
        : normalized >= QUOTA_PROGRESS_MEDIUM_THRESHOLD
          ? classes.quotaBarFillMedium
          : classes.quotaBarFillLow;
  const widthPercent = Math.round((normalized ?? 0) * 100) / 100;
  const style: MeterStyle = { width: `${widthPercent}%`, '--meter-value': widthPercent };
  if (index !== undefined) {
    style['--meter-index'] = index;
  }

  return (
    <div className={classes.quotaBar}>
      <div className={`${classes.quotaBarFill} ${fillClass}`} style={style} />
    </div>
  );
}
