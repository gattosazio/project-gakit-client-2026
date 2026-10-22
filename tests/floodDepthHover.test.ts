import { deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachFloodDepthHover, decodePngDepth, numericDepthSampler, depthBandSampler, floodDepthBand, gridIndex, withNumericDepthPatches, type FloodDepthGrid } from '@/lib/map/floodDepthHover';

const bounds = { left: 124, right: 126, top: 10, bottom: 8 };
const grid = (depths: number[], width = 2): FloodDepthGrid => {
  const bytes = new Uint8Array(depths.length * 4);
  const view = new DataView(bytes.buffer);
  depths.forEach((value, i) => view.setFloat32(i * 4, value, true));
  return { width, height: depths.length / width, encoding: 'float32-le', values: Buffer.from(bytes).toString('base64') };
};

afterEach(() => vi.unstubAllGlobals());

describe('frame-aligned flood depth hover', () => {
  it('decodes the PNG numeric chunk rather than guessing a value from color bands', async () => {
    const header = Buffer.alloc(12);
    header.write('GDK1'); header.writeUInt32LE(2, 4); header.writeUInt32LE(1, 8);
    const floats = Buffer.alloc(8); floats.writeFloatLE(.225, 0); floats.writeFloatLE(1.735, 4);
    const payload = Buffer.concat([header, deflateSync(floats)]);
    const chunk = Buffer.alloc(payload.length + 12);
    chunk.writeUInt32BE(payload.length); chunk.write('gdEP', 4); payload.copy(chunk, 8);
    const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk]);
    const decoded = await decodePngDepth(Uint8Array.from(png).buffer);
    expect(decoded).not.toBeNull();
    const sample = numericDepthSampler(decoded!, bounds, 'Simulated water depth');
    expect(sample(124.5,9)?.value).toBe('~23 cm');
    expect(sample(125.5,9)?.value).toBe('~174 cm');
    expect(await decodePngDepth(new ArrayBuffer(2))).toBeNull();
    header.writeUInt32LE(0xffffffff, 4);
    header.copy(chunk, 8);
    expect(await decodePngDepth(Uint8Array.from(Buffer.concat([png.subarray(0,8),chunk])).buffer)).toBeNull();
  });

  it('recognizes both inundation palettes while keeping unknown/transparent pixels empty', () => {
    expect(floodDepthBand(234, 179, 8, 205)).toBe(1);
    expect(floodDepthBand(249, 115, 22, 225)).toBe(2);
    expect(floodDepthBand(220, 38, 38, 245)).toBe(3);
    expect(floodDepthBand(6, 182, 212, 205)).toBe(1);
    expect(floodDepthBand(59, 130, 246, 225)).toBe(2);
    expect(floodDepthBand(30, 58, 138, 245)).toBe(3);
    expect(floodDepthBand(235, 178, 9, 205)).toBe(1);
    expect(floodDepthBand(234, 179, 8, 0)).toBe(0);
    expect(floodDepthBand(128, 128, 128, 255)).toBe(0);
  });

  it('samples north-to-south rows and excludes outside/east/south edges without clamping', () => {
    expect(gridIndex(124, 10, bounds, 2, 2)).toBe(0);
    expect(gridIndex(125.5, 8.5, bounds, 2, 2)).toBe(3);
    for (const [lon, lat] of [[126, 9], [125, 8], [123, 9], [125, 11], [NaN, 9]]) {
      expect(gridIndex(lon, lat, bounds, 2, 2)).toBeNull();
    }
    expect(gridIndex(125, 9, { ...bounds, left: NaN }, 2, 2)).toBeNull();
    const sample = depthBandSampler(new Uint8Array([1, 2, 3, 0]), 2, 2, bounds, 'Day 1 · 15:00');
    expect(sample(124.5, 9.5)).toEqual({ value: 'Not available', detail: 'Numeric depth not stored', time: 'Day 1 · 15:00' });
    expect(sample(125.5, 9.5)?.value).toBe('Not available');
    expect(sample(124.5, 8.5)?.value).toBe('Not available');
    expect(sample(125.5, 8.5)).toBeNull();
  });

  it('uses numeric correction windows and lets a newly dry cell erase its old wet-band hover', () => {
    const baseline = depthBandSampler(new Uint8Array([2, 2, 2, 2]), 2, 2, bounds);
    const patches = [
      { bounds, grid: grid([.6, .6, .6, .6]), label: 'Baseline simulated depth' },
      { bounds: { left: 125, right: 126, top: 10, bottom: 8 }, grid: grid([.225, .175], 1), label: 'Report-analysis simulated depth' },
    ];
    const sample = withNumericDepthPatches(baseline, patches, 'Day 1 · 15:00');
    expect(sample(125.5, 9.5)).toMatchObject({ value: '~23 cm', detail: 'Report-analysis simulated depth', time: 'Day 1 · 15:00' });
    expect(sample(125.5, 9.5)?.depthM).toBeCloseTo(.225);
    expect(sample(125.5, 8.5)).toBeNull();
    expect(sample(124.5, 9.5)?.value).toBe('~60 cm');
    expect(sample(126, 9)).toBeNull();
  });

  it('falls back for invalid payloads and never displays NaN, negative or dry numeric depths', () => {
    const fallback = vi.fn(() => ({ value: '20–50 cm', detail: 'Estimated depth range' }));
    expect(withNumericDepthPatches(fallback, [{ bounds, grid: { ...grid([.4]), values: 'invalid' }, label: 'Simulation' }])(125, 9)).toEqual(fallback());
    for (const depth of [NaN, Infinity, -1, 0, .1999]) {
      expect(withNumericDepthPatches(fallback, [{ bounds, grid: grid([depth], 1), label: 'Simulation' }])(125, 9)).toBeNull();
    }
  });

  it('throttles mouse movement, hides on pan/leave/hidden frames and removes its listeners', () => {
    class Element {
      className = ''; style: Record<string, string> = {}; textContent = '';
      clientWidth = 500; clientHeight = 400; offsetWidth = 180; offsetHeight = 70;
      children: Element[] = []; listeners = new Map<string, () => void>();
      append(...elements: Element[]) { this.children.push(...elements); }
      setAttribute() {} remove = vi.fn();
      addEventListener(name: string, callback: () => void) { this.listeners.set(name, callback); }
      removeEventListener(name: string) { this.listeners.delete(name); }
    }
    vi.stubGlobal('document', { createElement: () => new Element() });
    const callbacks = new Map<number, () => void>();
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { callbacks.set(1, fn); return 1; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    const container = new Element(), canvas = new Element();
    canvas.style.cursor = 'grab';
    const events = new Map<string, (event?: any) => void>();
    let visible = true;
    const map = { getContainer: () => container, getCanvas: () => canvas, isMoving: () => false,
      getLayer: () => ({ source: 'flood' }), getLayoutProperty: () => visible ? 'visible' : 'none',
      on: (name: string, callback: (event?: any) => void) => events.set(name, callback),
      off: (name: string) => events.delete(name) };
    const sample = vi.fn(() => ({ value: '~45 cm', detail: 'Estimated road depth', location: 'Test Street', time: 'Dec 17, 3:00 AM', depthM: .45 }));
    const detach = attachFloodDepthHover(map, 'flood-layer', sample);
    const move = events.get('mousemove')!;
    const flush = () => { const fn = callbacks.get(1)!; callbacks.clear(); fn(); };
    move({ lngLat: { lng: 125, lat: 9 }, point: { x: 490, y: 390 } });
    move({ lngLat: { lng: 125.5, lat: 9 }, point: { x: 490, y: 390 } });
    expect(sample).not.toHaveBeenCalled(); flush();
    const tooltip = container.children[0];
    expect(sample).toHaveBeenCalledOnce();
    expect(sample).toHaveBeenCalledWith(125.5, 9);
    expect(tooltip.style.left).toBe('292px');
    expect(tooltip.style.top).toBe('302px');
    expect(tooltip.children[1].textContent).toBe('~45 cm');
    expect(tooltip.children[2].textContent).toBe('Test Street');
    expect(tooltip.children[3].textContent).toBe('Dec 17, 3:00 AM');
    expect(canvas.style.cursor).toContain('data:image/svg+xml');
    events.get('sourcedata')!({ sourceId: 'buildings' });
    expect(tooltip.style.display).toBe('block');
    visible = false; events.get('render')!();
    expect(tooltip.style.display).toBe('none');
    expect(canvas.style.cursor).toBe('grab');
    visible = true; move({ lngLat: { lng: 125, lat: 9 }, point: { x: 100, y: 100 } }); flush();
    canvas.listeners.get('mouseleave')!();
    expect(tooltip.style.display).toBe('none');
    detach();
    expect(events.size).toBe(0); expect(canvas.listeners.size).toBe(0);
    expect(tooltip.remove).toHaveBeenCalledOnce();
  });
});
