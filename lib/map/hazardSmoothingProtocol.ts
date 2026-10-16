import type { Protocol } from 'pmtiles';

let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number, { resolve: (data: Uint8Array) => void; reject: (error: Error) => void }>();

function smoothTile(key: string, data: Uint8Array, signal: AbortSignal): Promise<Uint8Array> {
  signal.throwIfAborted();
  if (!worker) {
    worker = new Worker(new URL('./hazardSmoothing.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; data?: Uint8Array; error?: string }>) => {
      const task = pending.get(event.data.id);
      pending.delete(event.data.id);
      if (event.data.error) task?.reject(new Error(event.data.error));
      else if (event.data.data) task?.resolve(event.data.data);
    };
    worker.onerror = () => {
      for (const task of pending.values()) task.reject(new Error('Hazard smoothing worker failed'));
      pending.clear(); worker?.terminate(); worker = undefined;
    };
  }
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const abort = () => { pending.delete(id); reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    pending.set(id, {
      resolve: result => { signal.removeEventListener('abort', abort); resolve(result); },
      reject: error => { signal.removeEventListener('abort', abort); reject(error); },
    });
    const copy = new Uint8Array(data);
    worker!.postMessage({ id, key, data: copy }, [copy.buffer]);
  });
}

export function registerHazardSmoothingProtocol(maplibre: any, protocol: Protocol) {
  maplibre.addProtocol('smoothpmtiles', async (params: Parameters<Protocol['tilev4']>[0], controller: AbortController) => {
    const result = await protocol.tilev4({ ...params, url: params.url.replace(/^smoothpmtiles:/, 'pmtiles:') }, controller);
    if (params.type === 'json') {
      const json = result.data as { tiles: string[] };
      return { ...result, data: { ...json, tiles: json.tiles.map(url => url.replace(/^pmtiles:/, 'smoothpmtiles:')) } };
    }
    if (result.data instanceof Uint8Array && result.data.length) {
      return { ...result, data: await smoothTile(params.url, result.data, controller.signal) };
    }
    return result;
  });
}
