import { useMemo } from 'react';
import { buildSmoothLinePath } from './curve';
import styles from './Sparkline.module.scss';

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 24;
/** 顶部留白，避免峰值贴边被裁切 */
const TOP_PADDING = 3;

interface SparklineProps {
  points: number[];
  /** 折线色，默认 ink-muted：趋势是辅助信息，不抢主色 */
  color?: string;
  ariaLabel: string;
  className?: string;
}

/**
 * 极简迷你折线：单条 1.5px 线，无面积填充。
 * 单序列，因此不需要图例；数值由所在行的文本承载。
 */
export function Sparkline({ points, color, ariaLabel, className }: SparklineProps) {
  const geometry = useMemo(() => {
    const values = points.filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      return null;
    }

    const max = Math.max(...values);
    const usableHeight = VIEW_HEIGHT - TOP_PADDING;
    const stepX = values.length > 1 ? VIEW_WIDTH / (values.length - 1) : 0;

    const coordinates = values.map((value, index) => {
      const x = values.length > 1 ? index * stepX : VIEW_WIDTH / 2;
      const ratio = max > 0 ? value / max : 0;
      const y = VIEW_HEIGHT - ratio * usableHeight;
      return { x, y };
    });

    const line = buildSmoothLinePath(coordinates, TOP_PADDING, VIEW_HEIGHT);

    return { line, isFlat: max <= 0 };
  }, [points]);

  if (!geometry) {
    return (
      <div className={[styles.empty, className].filter(Boolean).join(' ')} aria-hidden="true" />
    );
  }

  const strokeColor = geometry.isFlat ? 'var(--ink-ghost)' : (color ?? 'var(--ink-muted)');

  return (
    <svg
      className={[styles.sparkline, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <path
        d={geometry.line}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
