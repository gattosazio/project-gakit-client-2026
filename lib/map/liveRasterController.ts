import { decodePngDepth, readRasterDepthBands, registerRasterDepth, withNumericDepthPatches, type FloodDepthPatch, type FloodDepthSampler } from './floodDepthHover';

/** Atomically replace a raster with an already-decoded image. The installed
 * MapLibre ImageSource supports updateImage({ image, coordinates }). */
export class FloodRasterError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

async function decodeRaster(url: string, signal: AbortSignal): Promise<ImageBitmap> {
  const response = await fetch(url, { signal, mode: 'cors' });
  if (!response.ok) throw new FloodRasterError('Flood image unavailable', response.status);
  const blob = await response.blob();
  const [image, depth] = await Promise.all([createImageBitmap(blob), blob.arrayBuffer().then(decodePngDepth)]);
  registerRasterDepth(image, depth);
  return image;
}

/** Blend neighboring raster cells once per frame, rather than on every map render. */
async function blendRaster(image: ImageBitmap): Promise<ImageBitmap> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Flood smoothing unavailable');
  const radius = Math.max(0.6, Math.min(1.5, Math.max(image.width, image.height) / 1400));
  context.filter = `blur(${radius}px)`;
  context.drawImage(image, 0, 0);
  return createImageBitmap(canvas);
}

export class LiveRasterController {
  private generation = 0;
  private request: AbortController | undefined;
  private image: ImageBitmap | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private depthSampler: FloodDepthSampler | null = null;
  private depthListeners = new Set<() => void>();
  constructor(private decode = decodeRaster, private blend = blendRaster, private readDepth = readRasterDepthBands) {}

  sampleDepth(longitude: number, latitude: number, includeShallow = false) {
    const reading = this.depthSampler?.(longitude, latitude) ?? null;
    return reading && (includeShallow || reading.depthM == null || reading.depthM >= .2) ? reading : null;
  }

  hasDepthData() { return this.depthSampler !== null; }
  subscribeDepth(listener: () => void) {
    this.depthListeners.add(listener);
    return () => { this.depthListeners.delete(listener); };
  }
  private notifyDepth() { this.depthListeners.forEach(listener => listener()); }

  cancel() {
    this.generation++;
    this.request?.abort();
    clearTimeout(this.timeout);
  }

  dispose() { this.cancel(); this.image?.close(); this.image = undefined; this.depthSampler = null; this.notifyDepth(); this.depthListeners.clear(); }

  show(map: any, sourceId: string, layerId: string, url: string | null,
    coordinates: number[][], complete: (error?: Error) => void, preservePrevious = false, smooth = false,
    hover?: { time?: string; patches?: FloodDepthPatch[]; depthUrl?: string }) {
    this.cancel();
    const generation = this.generation;
    const hide = () => { this.depthSampler = null; if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none'); this.notifyDepth(); };
    if (!preservePrevious || !url) hide();
    const source = map.getSource(sourceId);
    if (!url || !source) { complete(url ? new Error('Map is preparing') : undefined); return; }
    const request = new AbortController();
    this.request = request;
    this.timeout = setTimeout(() => {
      request.abort();
      if (generation === this.generation) { hide(); complete(new Error('Flood image timed out')); }
    }, 20000);
    void this.decode(url, request.signal).then(async image => {
      if (generation !== this.generation || request.signal.aborted) { image.close(); return; }
      if (hover?.depthUrl && hover.depthUrl !== url) {
        try {
          const response = await fetch(hover.depthUrl, { signal: request.signal, mode: 'cors' });
          if (response.ok) registerRasterDepth(image, await decodePngDepth(await response.arrayBuffer()));
        } catch {
          // Local numeric correction patches remain usable if the baseline read fails.
        }
        if (generation !== this.generation || request.signal.aborted) { image.close(); return; }
      }
      // Index original palette pixels before visual smoothing changes their colors.
      const depthSampler = withNumericDepthPatches(this.readDepth(image, coordinates, hover?.time, 0), hover?.patches ?? [], hover?.time, 0);
      if (smooth) {
        try {
          const blended = await this.blend(image);
          image.close();
          image = blended;
        } catch (error) { image.close(); throw error; }
      }
      if (generation !== this.generation || request.signal.aborted) { image.close(); return; }
      clearTimeout(this.timeout);
      try {
        source.updateImage({ image, coordinates });
        this.image?.close();
        this.image = image;
        this.depthSampler = depthSampler;
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'visible');
        complete();
        this.notifyDepth();
      } catch (error) {
        image.close();
        hide();
        complete(error instanceof Error ? error : new Error('Flood image unavailable'));
      }
    }).catch(error => {
      if (generation !== this.generation) return;
      clearTimeout(this.timeout);
      if (!request.signal.aborted) { hide(); complete(error); }
    });
  }
}
