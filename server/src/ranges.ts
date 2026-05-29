export interface ParsedByteRange {
  ok: true;
  start: number;
  end: number;
  chunkSize: number;
}

export interface InvalidByteRange {
  ok: false;
  error: string;
}

export function parseByteRange(rangeHeader: string, fileSize: number): ParsedByteRange | InvalidByteRange {
  if (!Number.isInteger(fileSize) || fileSize <= 0) return { ok: false, error: 'Invalid file size' };
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return { ok: false, error: 'Malformed Range header' };

  const [, startPart, endPart] = match;
  if (!startPart && !endPart) return { ok: false, error: 'Empty Range header' };

  let start: number;
  let end: number;

  if (!startPart) {
    const suffixLength = Number(endPart);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return { ok: false, error: 'Invalid suffix range' };
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(startPart);
    end = endPart ? Number(endPart) : fileSize - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= fileSize) {
    return { ok: false, error: 'Unsatisfiable Range header' };
  }

  end = Math.min(end, fileSize - 1);
  return { ok: true, start, end, chunkSize: end - start + 1 };
}
