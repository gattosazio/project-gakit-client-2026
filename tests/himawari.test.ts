import { afterEach, describe, expect, it, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
import { isFrameFresh, HIMAWARI_PLACEHOLDER_DATA_URL, fetchHimawariFrame, loadHimawariFrames } from '@/lib/map/himawari';

describe('HIMAWARI_PLACEHOLDER_DATA_URL', () => {
  it('is a valid, decodable 1x1 transparent PNG data URL', () => {
    expect(HIMAWARI_PLACEHOLDER_DATA_URL).toMatch(/^data:image\/png;base64,/);
    const bytes = Uint8Array.from(
      Buffer.from(HIMAWARI_PLACEHOLDER_DATA_URL.split(',')[1], 'base64')
    );
    // PNG signature
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    // IHDR width (bytes 16-19) and height (bytes 20-23)
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    expect(width).toBe(1);
    expect(height).toBe(1);

    // Walk chunks and inflate IDAT; a corrupt image fails to inflate, which is
    // exactly the browser "could not be decoded" failure we must guard against.
    let offset = 8;
    const idat: number[] = [];
    while (offset < bytes.length) {
      const len =
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3];
      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
      const data = bytes.slice(offset + 8, offset + 8 + len);
      if (type === 'IDAT') idat.push(...data);
      if (type === 'IEND') break;
      offset += 12 + len;
    }
    const inflated = inflateSync(Buffer.from(idat));
    // 1x1 RGBA: one filter byte (0) followed by 4 zero channels (transparent).
    expect([...inflated]).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('isFrameFresh', () => {
  const now = new Date('2026-08-25T11:23:00Z');

  it('accepts a frame published within the normal ~13 minute lag', () => {
    // Real header observed for slot 1030 on a healthy day.
    expect(isFrameFresh('Tue, 25 Aug 2026 10:43:30 GMT', '1030', now)).toBe(true);
  });

  it('rejects yesterday carry-over files served during a publish gap', () => {
    // Real header observed while slot 1110 was pending on 2026-08-25.
    expect(isFrameFresh('Mon, 24 Aug 2026 11:23:12 GMT', '1110', now)).toBe(false);
  });

  it('accepts frames published a few minutes before their slot', () => {
    expect(isFrameFresh('Tue, 25 Aug 2026 10:52:00 GMT', '1100', now)).toBe(true);
  });

  it('rejects long-delayed publications beyond the freshness window', () => {
    expect(isFrameFresh('Tue, 25 Aug 2026 11:40:00 GMT', '1100', now)).toBe(false);
  });

  it('handles the UTC midnight boundary', () => {
    const justAfterMidnight = new Date('2026-08-26T00:05:00Z');
    expect(
      isFrameFresh('Tue, 25 Aug 2026 23:59:00 GMT', '2350', justAfterMidnight)
    ).toBe(true);
    expect(
      isFrameFresh('Mon, 24 Aug 2026 23:55:00 GMT', '2350', justAfterMidnight)
    ).toBe(false);
  });

  it('resolves slots in the future of the server clock to the previous day', () => {
    const justBeforeMidnight = new Date('2026-08-25T23:58:00Z');
    expect(
      isFrameFresh('Tue, 25 Aug 2026 00:12:00 GMT', '0000', justBeforeMidnight)
    ).toBe(true);
  });

  it('rejects missing or unparseable Last-Modified headers', () => {
    expect(isFrameFresh(null, '1100', now)).toBe(false);
    expect(isFrameFresh('not-a-date', '1100', now)).toBe(false);
  });
});


describe('Himawari failure handling', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  function images(fail: (time: string) => boolean) {
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        if (!value) return;
        const time = new URL(value, 'https://gakit.test').searchParams.get('time')!;
        queueMicrotask(() => { if (fail(time)) this.onerror?.(); else this.onload?.(); });
      }
    });
  }

  it('keeps available frames in timeline order when individual scans fail', async () => {
    images(time => time === '1010');
    const progress = vi.fn();
    const frames = await loadHimawariFrames(['1000', '1010', '1020'], progress);
    expect([...frames.keys()]).toEqual(['1000', '1020']);
    expect(progress).toHaveBeenLastCalledWith(2);
  });

  it('returns an empty batch on a full upstream outage', async () => {
    images(() => true);
    expect((await loadHimawariFrames(['1000', '1010'])).size).toBe(0);
  });

  it('times out stalled images instead of leaving the loading overlay stuck', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', class { onload = null; onerror = null; src = ''; });
    const result = expect(fetchHimawariFrame('1000')).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
