import { describe, expect, test } from 'bun:test';
import { splitHighlight } from '../src/features/logs/model/logHighlight';

describe('log search highlighting', () => {
  test('returns the text untouched without a query', () => {
    expect(splitHighlight('GET /v1/models', '')).toEqual([
      { text: 'GET /v1/models', match: false },
    ]);
    expect(splitHighlight('GET /v1/models', '   ')).toEqual([
      { text: 'GET /v1/models', match: false },
    ]);
  });

  test('marks every case-insensitive match and keeps original casing', () => {
    expect(splitHighlight('Error: upstream error', 'ERROR')).toEqual([
      { text: 'Error', match: true },
      { text: ': upstream ', match: false },
      { text: 'error', match: true },
    ]);
  });

  test('trims the query like the search selector does', () => {
    expect(splitHighlight('/v1/chat', ' chat ')).toEqual([
      { text: '/v1/', match: false },
      { text: 'chat', match: true },
    ]);
  });

  test('segments always reassemble into the original text', () => {
    const text = 'aaa bab aa';
    expect(
      splitHighlight(text, 'aa')
        .map((segment) => segment.text)
        .join('')
    ).toBe(text);
  });
});
