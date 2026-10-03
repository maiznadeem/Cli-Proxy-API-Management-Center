import { TONE_COLORS, toneForSuccessRate, type MeterTone } from '../utils';
import styles from './Meter.module.scss';

interface MeterProps {
  /** 0–100；null 表示窗口内无请求 */
  value: number | null;
  tone?: MeterTone;
  ariaLabel: string;
  className?: string;
}

/**
 * 细条计量器：填充色取容量色板，轨道是中性 cap-track。
 * 挂载时（即数据到达时）走一次填充动画，之后不再随滚动或刷新重播。
 */
export function Meter({ value, tone, ariaLabel, className }: MeterProps) {
  const resolvedTone = tone ?? toneForSuccessRate(value);
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));

  return (
    <div
      className={[styles.track, className].filter(Boolean).join(' ')}
      style={{ '--meter-fill': TONE_COLORS[resolvedTone] } as React.CSSProperties}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(clamped)}
      aria-label={ariaLabel}
    >
      <div className={styles.fill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
