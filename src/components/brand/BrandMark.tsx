/**
 * Agent Tracker product mark.
 *
 * A tracking reticle: a ring, a centre point, and four tick marks at the compass points. One white glyph on a solid accent tile so it stays legible
 * at favicon size and in both themes. Decorative only; callers provide the accessible
 * name where one is needed.
 */

export interface BrandMarkProps {
  size?: number;
  className?: string;
  /** Draw the accent tile behind the glyph. Off for inline use next to text. */
  tile?: boolean;
}

// Four tick marks just outside a radius-10 ring, at the compass points.
const TICKS = 'M20 5v4M20 31v4M5 20h4M31 20h4';

export function BrandMark({ size = 24, className, tile = true }: BrandMarkProps) {
  const glyph = tile ? 'var(--accent-contrast)' : 'var(--accent)';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      {tile && <rect width="40" height="40" rx="10" fill="var(--accent)" />}
      <circle cx="20" cy="20" r="10" fill="none" stroke={glyph} strokeWidth="3.5" />
      <path d={TICKS} fill="none" stroke={glyph} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="20" cy="20" r="3" fill={glyph} />
    </svg>
  );
}

/** Same glyph as a favicon-safe data URI (fixed colours; CSS variables do not apply there). */
export const BRAND_MARK_DATA_URI =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
      '<rect width="40" height="40" rx="10" fill="#2f6fe4"/>' +
      '<circle cx="20" cy="20" r="10" fill="none" stroke="#fff" stroke-width="3.5"/>' +
      `<path d="${TICKS}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>` +
      '<circle cx="20" cy="20" r="3" fill="#fff"/>' +
      '</svg>'
  );
