import { smoothHazardTile } from './hazardGeometrySmoothing';

const cache = new Map<string, Uint8Array>();
let bytes = 0;
const MAX_BYTES = 8 * 1024 * 1024;
self.onmessage = (event: MessageEvent<{ id: number; key: string; data: Uint8Array }>) => {
  const { id, key, data } = event.data;
  try {
    let result = cache.get(key);
    if (!result) {
      result = smoothHazardTile(data);
      if (result.byteLength <= MAX_BYTES) {
        cache.set(key, result);
        bytes += result.byteLength;
        while (bytes > MAX_BYTES && cache.size > 1) {
          const oldest = cache.keys().next().value!;
          bytes -= cache.get(oldest)!.byteLength;
          cache.delete(oldest);
        }
      }
    }
    const copy = new Uint8Array(result);
    self.postMessage({ id, data: copy }, { transfer: [copy.buffer] });
  } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Hazard smoothing failed' }); }
};
