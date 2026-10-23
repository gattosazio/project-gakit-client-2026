import { afterEach, describe, expect, it, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
import { HIMAWARI_PLACEHOLDER_DATA_URL, fetchHimawariFrame, fetchHimawariFrameTimes, loadHimawariFrames } from '@/lib/map/himawari';

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

  it('uses published full timestamps even when the upstream is behind the clock', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ frames: ['20261023023000', '20261023022000', '20261023023000'] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchHimawariFrameTimes()).toEqual(['20261023022000', '20261023023000']);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/himawari-proxy?manifest=1');
  });

  it('does not guess image slots when discovery fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'outage' }, { status: 503 })));
    await expect(fetchHimawariFrameTimes()).rejects.toThrow('temporarily unavailable');
  });

  it('keeps available frames in timeline order when individual scans fail', async () => {
    images(time => time === '1010');
    const progress = vi.fn();
    const frames = await loadHimawariFrames(['1000', '1010', '1020'], progress);
    expect([...frames.keys()]).toEqual(['1000', '1020']);
    expect(progress).toHaveBeenLastCalledWith(2);
  });

  it('requests six newest scans and only uses older candidates for gaps', async () => {
    const requested: string[] = [];
    images(time => { requested.push(time); return time === '1100'; });
    const frames = await loadHimawariFrames(
      ['1000', '1010', '1020', '1030', '1040', '1050', '1100', '1110'],
      undefined,
      { maxFrames: 6 },
    );
    expect(requested).toEqual(['1110', '1100', '1050', '1040', '1030', '1020', '1010']);
    expect([...frames.keys()]).toEqual(['1010', '1020', '1030', '1040', '1050', '1110']);
  });

  it('reuses decoded frames without making image requests', async () => {
    const cached = new Map([['1000', {} as HTMLImageElement], ['1010', {} as HTMLImageElement]]);
    const imageConstructor = vi.fn();
    vi.stubGlobal('Image', imageConstructor);
    const onFrame = vi.fn();
    const frames = await loadHimawariFrames(['1000', '1010'], undefined, { cachedFrames: cached, onFrame });
    expect(imageConstructor).not.toHaveBeenCalled();
    expect(frames).toEqual(cached);
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it('publishes the first frame while another frame is still loading', async () => {
    const pending: Array<{ onload: (() => void) | null }> = [];
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror = null;
      set src(value: string) { if (value) pending.push(this); }
    });
    const onFrame = vi.fn();
    let settled = false;
    const batch = loadHimawariFrames(['1000', '1010'], undefined, { onFrame }).then(result => {
      settled = true;
      return result;
    });
    expect(pending).toHaveLength(2);
    pending[0].onload?.();
    await vi.waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
    expect(onFrame).toHaveBeenCalledWith('1010', pending[0]);
    pending[1].onload?.();
    expect([...(await batch).keys()]).toEqual(['1000', '1010']);
  });

  it('keeps the second worker moving while the newest scan is stalled', async () => {
    const pending = new Map<string, { onload: (() => void) | null }>();
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror = null;
      set src(value: string) {
        if (value) pending.set(new URL(value, 'https://gakit.test').searchParams.get('time')!, this);
      }
    });
    const batch = loadHimawariFrames(['1000', '1010', '1020', '1030'], undefined, { maxFrames: 3 });
    expect([...pending.keys()]).toEqual(['1030', '1020']);
    pending.get('1020')!.onload?.();
    await vi.waitFor(() => expect(pending.has('1010')).toBe(true));
    pending.get('1010')!.onload?.();
    await Promise.resolve();
    expect(pending.has('1000')).toBe(false);
    pending.get('1030')!.onload?.();
    expect([...(await batch).keys()]).toEqual(['1010', '1020', '1030']);
  });

  it('publishes all cached target scans before starting missing image requests', async () => {
    const cached = new Map(['1000', '1010', '1020'].map(time => [time, {} as HTMLImageElement]));
    const onFrame = vi.fn();
    const requested: string[] = [];
    images(time => {
      requested.push(time);
      expect(onFrame).toHaveBeenCalledTimes(2);
      return false;
    });
    const result = await loadHimawariFrames(['1000', '1010', '1020', '1030'], undefined, {
      maxFrames: 3, cachedFrames: cached, onFrame,
    });
    expect(requested).toEqual(['1030']);
    expect([...result.keys()]).toEqual(['1010', '1020', '1030']);
  });

  it('uses an older cached scan only after a newer target fails', async () => {
    const cached = new Map(['1000', '1010', '1020'].map(time => [time, {} as HTMLImageElement]));
    const requested: string[] = [];
    images(time => { requested.push(time); return true; });
    const result = await loadHimawariFrames(['1000', '1010', '1020', '1030'], undefined, {
      maxFrames: 3, cachedFrames: cached,
    });
    expect(requested).toEqual(['1030']);
    expect([...result.keys()]).toEqual(['1000', '1010', '1020']);
  });

  it('stops publishing and requesting frames when a batch is cancelled', async () => {
    let active = true;
    images(() => { active = false; return false; });
    const onFrame = vi.fn();
    const frames = await loadHimawariFrames(['1000', '1010', '1020', '1030'], undefined, {
      onFrame, shouldContinue: () => active,
    });
    expect(frames.size).toBe(0);
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('returns an empty batch on a full upstream outage', async () => {
    images(() => true);
    expect((await loadHimawariFrames(['1000', '1010'])).size).toBe(0);
  });

  it('times out stalled images instead of leaving the loading overlay stuck', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', class { onload = null; onerror = null; src = ''; });
    const result = expect(fetchHimawariFrame('1000')).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(55_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares an in-flight scan across repeated requests and releases it after completion', async () => {
    const pending: Array<{ onload: (() => void) | null }> = [];
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror = null;
      set src(value: string) { if (value) pending.push(this); }
    });
    const first = fetchHimawariFrame('shared-scan');
    const second = fetchHimawariFrame('shared-scan');
    expect(second).toBe(first);
    expect(pending).toHaveLength(1);
    pending[0].onload?.();
    expect(await second).toBe(await first);
    const next = fetchHimawariFrame('shared-scan');
    expect(next).not.toBe(first);
    expect(pending).toHaveLength(2);
    pending[1].onload?.();
    await next;
  });
});
