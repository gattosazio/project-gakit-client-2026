import { afterEach, expect, it, vi } from 'vitest';
import type { Protocol } from 'pmtiles';
import { registerHazardSmoothingProtocol } from '@/lib/map/hazardSmoothingProtocol';

afterEach(() => vi.unstubAllGlobals());

it('rewrites TileJSON and sends requested display tiles through the worker', async () => {
  const postMessage = vi.fn(function (this: { onmessage: (event: unknown) => void }, message: { id: number; data: Uint8Array }) {
    this.onmessage({ data: { id: message.id, data: new Uint8Array([9, 8, 7]) } });
  });
  vi.stubGlobal('Worker', class {
    onmessage = () => {};
    postMessage = postMessage;
  });
  const original = new Uint8Array([1, 2, 3]);
  const tilev4 = vi.fn(async (params: { url: string; type?: string }) => params.type === 'json'
    ? { data: { tiles: [`${params.url}/{z}/{x}/{y}`], maxzoom: 14 } }
    : { data: original });
  const addProtocol = vi.fn();
  registerHazardSmoothingProtocol({ addProtocol }, { tilev4 } as unknown as Protocol);
  const handler = addProtocol.mock.calls[0][1];
  const url = 'smoothpmtiles:///data/hazards.pmtiles';
  const metadata = await handler({ url, type: 'json' }, new AbortController());
  expect(metadata.data).toEqual({ tiles: [`${url}/{z}/{x}/{y}`], maxzoom: 14 });
  const result = await handler({ url: `${url}/12/1/2`, type: 'arrayBuffer' }, new AbortController());
  expect(tilev4).toHaveBeenLastCalledWith(expect.objectContaining({ url: 'pmtiles:///data/hazards.pmtiles/12/1/2' }), expect.any(AbortController));
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ data: original }), expect.any(Array));
  expect(postMessage.mock.calls[0][0].data).not.toBe(original);
  expect(result.data).toEqual(new Uint8Array([9, 8, 7]));
});
