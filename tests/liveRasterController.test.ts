import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveRasterController } from '@/lib/map/liveRasterController';

const coordinates = [[124, 8], [125, 8], [125, 9], [124, 9]];
afterEach(() => vi.unstubAllGlobals());

function setup() {
  let resolve!: (image: ImageBitmap) => void;
  let reject!: (error: Error) => void;
  const decode = vi.fn(() => new Promise<ImageBitmap>((yes, no) => { resolve = yes; reject = no; }));
  const source = { updateImage: vi.fn() };
  const map = { getLayer: vi.fn(() => ({})), getSource: vi.fn(() => source), setLayoutProperty: vi.fn() };
  const controller = new LiveRasterController(decode);
  const image = { close: vi.fn() } as unknown as ImageBitmap;
  return { controller, map, source, image, resolve: () => resolve(image), reject: () => reject(new Error('Unavailable')) };
}

describe('hourly flood image transitions', () => {
  it('keeps the original numeric source when the demo canvas replaces its image', async () => {
    const t = setup();
    const fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }));
    vi.stubGlobal('fetch', fetch);
    const readDepth = vi.fn(() => () => ({ value: '~45 cm', detail: 'Original numeric baseline' }));
    const controller = new LiveRasterController(async () => t.image, undefined, readDepth);
    const complete = vi.fn();
    controller.show(t.map, 'source', 'layer', 'data:composited-canvas', coordinates, complete, false, false, { depthUrl: '/original-frame.png' });
    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith('/original-frame.png', expect.objectContaining({ mode: 'cors', signal: expect.any(AbortSignal) }));
    expect(controller.sampleDepth(124.5, 8.5)?.value).toBe('~45 cm');
    controller.dispose();
  });
  it('keeps hover on the displayed frame until its replacement commits, then clears it on failure', async () => {
    const t = setup();
    let completeDecode!: (image: ImageBitmap) => void;
    const decode = vi.fn(async () => t.image).mockImplementationOnce(async () => t.image)
      .mockImplementationOnce(() => new Promise(resolve => { completeDecode = resolve; }));
    const readDepth = vi.fn()
      .mockReturnValueOnce(() => ({ value: '20–50 cm', detail: 'Old frame' }))
      .mockReturnValueOnce(() => ({ value: '50–150 cm', detail: 'New frame' }));
    const controller = new LiveRasterController(decode, undefined, readDepth);
    const complete = vi.fn();
    controller.show(t.map, 'source', 'layer', '/old.png', coordinates, complete);
    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce());
    controller.show(t.map, 'source', 'layer', '/new.png', coordinates, complete, true);
    expect(controller.sampleDepth(124.5, 8.5)?.detail).toBe('Old frame');
    completeDecode(t.image);
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
    expect(controller.sampleDepth(124.5, 8.5)?.detail).toBe('New frame');
    controller.show(t.map, 'source', 'layer', null, coordinates, complete);
    expect(controller.sampleDepth(124.5, 8.5)).toBeNull();
    controller.dispose();
  });
  it('installs the blended raster and releases the original when smoothing is enabled', async () => {
    const t = setup();
    const blended = { close: vi.fn() } as unknown as ImageBitmap;
    const blend = vi.fn(async () => blended);
    const controller = new LiveRasterController(async () => t.image, blend);
    const complete = vi.fn();
    controller.show(t.map, 'source', 'layer', '/next.png', coordinates, complete, true, true);
    await vi.waitFor(() => expect(complete).toHaveBeenCalledWith());
    expect(blend).toHaveBeenCalledWith(t.image);
    expect(t.image.close).toHaveBeenCalledOnce();
    expect(t.source.updateImage).toHaveBeenCalledWith({ image: blended, coordinates });
    controller.dispose();
    expect(blended.close).toHaveBeenCalledOnce();
  });

  it('discards a blended image if the selected frame changes during processing', async () => {
    const t = setup();
    let finish!: (image: ImageBitmap) => void;
    const blend = vi.fn(() => new Promise<ImageBitmap>(resolve => { finish = resolve; }));
    const controller = new LiveRasterController(async () => t.image, blend);
    const complete = vi.fn();
    controller.show(t.map, 'source', 'layer', '/next.png', coordinates, complete, true, true);
    await vi.waitFor(() => expect(blend).toHaveBeenCalledOnce());
    controller.cancel();
    const blended = { close: vi.fn() } as unknown as ImageBitmap;
    finish(blended);
    await vi.waitFor(() => expect(blended.close).toHaveBeenCalledOnce());
    expect(t.source.updateImage).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('keeps the previous frame visible until the next decoded image is installed', async () => {
    const t = setup();
    const complete = vi.fn();
    t.controller.show(t.map, 'source', 'layer', '/next.png', coordinates, complete, true);
    expect(t.map.setLayoutProperty).not.toHaveBeenCalled();
    expect(t.source.updateImage).not.toHaveBeenCalled();
    t.resolve();
    await vi.waitFor(() => expect(complete).toHaveBeenCalledWith());
    expect(t.source.updateImage).toHaveBeenCalledWith({ image: t.image, coordinates });
    expect(t.map.setLayoutProperty).not.toHaveBeenCalledWith('layer', 'visibility', 'none');
    t.controller.dispose();
  });

  it('still hides the previous raster when switching scenarios or loading live estimates', () => {
    const t = setup();
    t.controller.show(t.map, 'source', 'layer', '/next.png', coordinates, vi.fn());
    expect(t.map.setLayoutProperty).toHaveBeenCalledWith('layer', 'visibility', 'none');
    t.controller.dispose();
  });

  it('hides the previous frame on failure rather than presenting it as the selected hour', async () => {
    const t = setup();
    const complete = vi.fn();
    t.controller.show(t.map, 'source', 'layer', '/next.png', coordinates, complete, true);
    t.reject();
    await vi.waitFor(() => expect(complete).toHaveBeenCalledWith(expect.any(Error)));
    expect(t.map.setLayoutProperty).toHaveBeenCalledWith('layer', 'visibility', 'none');
    expect(t.source.updateImage).not.toHaveBeenCalled();
    t.controller.dispose();
  });
});
