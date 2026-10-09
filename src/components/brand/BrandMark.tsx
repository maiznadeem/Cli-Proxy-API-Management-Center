/**
 * Agent Tracker product mark: "Relay".
 *
 * A routed signal path that ends in a node, drawn in white on an indigo-to-violet
 * gradient tile. It stays legible at favicon size and in both themes. Decorative
 * only; callers provide the accessible name where one is needed.
 */

import { useId } from 'react';

export interface BrandMarkProps {
  size?: number;
  className?: string;
  /** Draw the gradient tile behind the glyph. Off for inline use next to text. */
  tile?: boolean;
}

const GRADIENT_FROM = '#6366f1';
const GRADIENT_TO = '#a855f7';
// Routed path: three legs ending at the top-right node.
const PATH = 'M9 26 L16 14 L23 26 L31 14';

export function BrandMark({ size = 24, className, tile = true }: BrandMarkProps) {
  const gradientId = useId();
  const glyph = tile ? '#ffffff' : 'var(--accent)';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      {tile && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={GRADIENT_FROM} />
              <stop offset="1" stopColor={GRADIENT_TO} />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={PATH}
        fill="none"
        stroke={glyph}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="14" r="3" fill={glyph} />
    </svg>
  );
}

/** Same glyph as a favicon-safe data URI (fixed colours; CSS variables do not apply there). */
export const BRAND_MARK_DATA_URI =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      `<stop offset="0" stop-color="${GRADIENT_FROM}"/><stop offset="1" stop-color="${GRADIENT_TO}"/>` +
      '</linearGradient></defs>' +
      '<rect width="40" height="40" rx="11" fill="url(#g)"/>' +
      `<path d="${PATH}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      '<circle cx="31" cy="14" r="3" fill="#fff"/>' +
      '</svg>'
  );
