import { describe, expect, it, vi } from 'vitest';
import { LiveRasterController } from '@/lib/map/liveRasterController';

const coordinates = [[124, 8], [125, 8], [125, 9], [124, 9]];

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
