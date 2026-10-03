/**
 * Agent Tracker product mark.
 *
 * A tracking reticle: an open ring, a fixed centre point, and the tracked point breaking
 * out through the ring's gap. One white glyph on a solid accent tile so it stays legible
 * at favicon size and in both themes. Decorative only; callers provide the accessible
 * name where one is needed.
 */

export interface BrandMarkProps {
  size?: number;
  className?: string;
  /** Draw the accent tile behind the glyph. Off for inline use next to text. */
  tile?: boolean;
}

// Ring of radius 11 around (20, 20) with a 70° gap centred on the top-right diagonal.
const RING_ARC = 'M 27.4 12.6 A 11 11 0 1 0 29.3 15.7';

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
      <path d={RING_ARC} fill="none" stroke={glyph} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="20" cy="20" r="3.25" fill={glyph} />
      <circle cx="31" cy="9" r="3.25" fill={glyph} />
    </svg>
  );
}

/** Same glyph as a favicon-safe data URI (fixed colours; CSS variables do not apply there). */
export const BRAND_MARK_DATA_URI =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
      '<rect width="40" height="40" rx="10" fill="#2f6fe4"/>' +
      `<path d="${RING_ARC}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>` +
      '<circle cx="20" cy="20" r="3.25" fill="#fff"/>' +
      '<circle cx="31" cy="9" r="3.25" fill="#fff"/>' +
      '</svg>'
  );
