export type HighlightSegment = { text: string; match: boolean };

/**
 * Split text into plain and matched segments for a case-insensitive needle.
 * Mirrors searchLogEntries, which matches on `raw.toLowerCase().includes(needle)`.
 */
export function splitHighlight(text: string, query: string): HighlightSegment[] {
  const needle = query.trim().toLowerCase();
  if (!needle || !text) return [{ text, match: false }];
  const haystack = text.toLowerCase();
  // Lower-casing can change string length for a few code points; skip highlighting then.
  if (haystack.length !== text.length) return [{ text, match: false }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let index = haystack.indexOf(needle, cursor);
  while (index !== -1) {
    if (index > cursor) segments.push({ text: text.slice(cursor, index), match: false });
    segments.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
    index = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments.length ? segments : [{ text, match: false }];
}
