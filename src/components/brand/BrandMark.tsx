/**
 * Manifold product mark.
 *
 * One inlet splitting into three outlets: the proxy takes one stream of requests and
 * distributes it across accounts. The three outlets carry the capacity scale so the
 * mark shares its palette with the meters rather than introducing a brand colour.
 * Decorative only; callers provide the accessible name where one is needed.
 */

export interface BrandMarkProps {
  size?: number;
  className?: string;
  /** Draw the raised tile behind the glyph. Off for inline use next to text. */
  tile?: boolean;
}

export function BrandMark({ size = 24, className, tile = true }: BrandMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      {tile && <rect width="40" height="40" rx="10" fill="var(--panel-raised)" />}
      <g fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 20h7c4 0 4-8 8-8h9" stroke="var(--accent)" />
        <path d="M8 20h24" stroke="var(--cap-plenty)" />
        <path d="M8 20h7c4 0 4 8 8 8h9" stroke="var(--cap-watch)" />
      </g>
    </svg>
  );
}

/** Same glyph as a favicon-safe data URI (fixed colours; CSS variables do not apply there). */
export const BRAND_MARK_DATA_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
      '<rect width="40" height="40" rx="10" fill="#121a24"/>' +
      '<g fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M8 20h7c4 0 4-8 8-8h9" stroke="#6fa2ff"/>' +
      '<path d="M8 20h24" stroke="#5bd6a5"/>' +
      '<path d="M8 20h7c4 0 4 8 8 8h9" stroke="#f0b94a"/>' +
      '</g></svg>'
  );
