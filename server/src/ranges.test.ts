import { describe, expect, it } from 'vitest';
import { parseByteRange } from './ranges';

describe('parseByteRange', () => {
  it('parses bounded, open-ended, and suffix ranges', () => {
    expect(parseByteRange('bytes=0-99', 1000)).toEqual({ ok: true, start: 0, end: 99, chunkSize: 100 });
    expect(parseByteRange('bytes=900-', 1000)).toEqual({ ok: true, start: 900, end: 999, chunkSize: 100 });
    expect(parseByteRange('bytes=-50', 1000)).toEqual({ ok: true, start: 950, end: 999, chunkSize: 50 });
  });

  it('rejects malformed or unsatisfiable ranges', () => {
    expect(parseByteRange('items=0-1', 1000).ok).toBe(false);
    expect(parseByteRange('bytes=abc-1', 1000).ok).toBe(false);
    expect(parseByteRange('bytes=100-50', 1000).ok).toBe(false);
    expect(parseByteRange('bytes=1000-', 1000).ok).toBe(false);
    expect(parseByteRange('bytes=-0', 1000).ok).toBe(false);
  });
});
