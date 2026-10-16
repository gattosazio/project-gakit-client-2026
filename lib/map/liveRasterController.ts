/** Atomically replace a raster with an already-decoded image. The installed
 * MapLibre ImageSource supports updateImage({ image, coordinates }). */
export class FloodRasterError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

async function decodeRaster(url: string, signal: AbortSignal): Promise<ImageBitmap> {
  const response = await fetch(url, { signal, mode: 'cors' });
  if (!response.ok) throw new FloodRasterError('Flood image unavailable', response.status);
  return createImageBitmap(await response.blob());
}

export class LiveRasterController {
  private generation = 0;
  private request: AbortController | undefined;
  private image: ImageBitmap | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  constructor(private decode = decodeRaster) {}

  cancel() {
    this.generation++;
    this.request?.abort();
    clearTimeout(this.timeout);
  }

  dispose() { this.cancel(); this.image?.close(); this.image = undefined; }

  show(map: any, sourceId: string, layerId: string, url: string | null,
    coordinates: number[][], complete: (error?: Error) => void) {
    this.cancel();
    const generation = this.generation;
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none');
    const source = map.getSource(sourceId);
    if (!url || !source) { complete(url ? new Error('Map is preparing') : undefined); return; }
    const request = new AbortController();
    this.request = request;
    this.timeout = setTimeout(() => {
      request.abort();
      if (generation === this.generation) complete(new Error('Flood image timed out'));
    }, 20000);
    void this.decode(url, request.signal).then(image => {
      if (generation !== this.generation || request.signal.aborted) { image.close(); return; }
      clearTimeout(this.timeout);
      try {
        source.updateImage({ image, coordinates });
        this.image?.close();
        this.image = image;
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'visible');
        complete();
      } catch (error) {
        image.close();
        complete(error instanceof Error ? error : new Error('Flood image unavailable'));
      }
    }).catch(error => {
      if (generation !== this.generation) return;
      clearTimeout(this.timeout);
      if (!request.signal.aborted) complete(error);
    });
  }
}
