/** Hover reads the displayed frame locally; a color band never becomes an exact depth. */
export interface FloodDepthGrid {
  width: number;
  height: number;
  encoding: 'float32-le';
  values: string;
}

export interface FloodDepthPatch {
  bounds: { left: number; right: number; top: number; bottom: number };
  grid: FloodDepthGrid;
  label: string;
}

export interface FloodDepthReading {
  value: string;
  detail: string;
  time?: string;
  depthM?: number;
}

export type FloodDepthSampler = (longitude: number, latitude: number) => FloodDepthReading | null;

export interface NumericRasterDepth { width: number; height: number; values: DataView }
const numericImages = new WeakMap<ImageBitmap, NumericRasterDepth>();

export function registerRasterDepth(image: ImageBitmap, depth: NumericRasterDepth | null) {
  if (depth && depth.width === image.width && depth.height === image.height) numericImages.set(image, depth);
}

/** Decode bounded float32 data embedded when the model renders this PNG. */
export async function decodePngDepth(buffer: ArrayBuffer): Promise<NumericRasterDepth | null> {
  try {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return null;
    const view = new DataView(buffer);
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      const end = offset + length + 12;
      if (end > bytes.length) return null;
      if (view.getUint32(offset + 4) === 0x67644550 && length >= 12 && view.getUint32(offset + 8) === 0x47444b31) {
        const width = view.getUint32(offset + 12, true), height = view.getUint32(offset + 16, true);
        if (!width || !height || width * height > 4_194_304) return null;
        const size = width * height * 4;
        const stream = new Blob([buffer.slice(offset + 20, offset + 8 + length)]).stream().pipeThrough(new DecompressionStream('deflate'));
        const reader = stream.getReader();
        const decoded = new Uint8Array(size);
        let written = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (written + value.length > size) { await reader.cancel(); return null; }
            decoded.set(value, written); written += value.length;
          }
        } finally { reader.releaseLock(); }
        return written === size ? { width, height, values: new DataView(decoded.buffer) } : null;
      }
      offset = end;
    }
  } catch { /* Old exports and unsupported decompression keep depth explicitly unavailable. */ }
  return null;
}

export function numericDepthSampler(depth: NumericRasterDepth, bounds: FloodDepthPatch['bounds'], detail: string, time?: string, minimumDepthM = .2): FloodDepthSampler {
  return (longitude, latitude) => {
    const index = gridIndex(longitude, latitude, bounds, depth.width, depth.height);
    if (index === null) return null;
    const meters = depth.values.getFloat32(index * 4, true);
    return Number.isFinite(meters) && meters >= minimumDepthM ? { value: `~${Math.round(meters * 100 + .0001)} cm`, detail, time, depthM: meters } : null;
  };
}
const PALETTE = [
  [234, 179, 8, 1], [249, 115, 22, 2], [220, 38, 38, 3],
  [6, 182, 212, 1], [59, 130, 246, 2], [30, 58, 138, 3],
];

export function floodDepthBand(r: number, g: number, b: number, alpha: number): number {
  if (alpha < 100) return 0;
  // Canvas unpremultiplication may shift a channel by a few levels.
  for (const [red, green, blue, band] of PALETTE) {
    if (Math.abs(red - r) <= 5 && Math.abs(green - g) <= 5 && Math.abs(blue - b) <= 5) return band;
  }
  return 0;
}

export function gridIndex(longitude: number, latitude: number, bounds: FloodDepthPatch['bounds'], width: number, height: number): number | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) ||
      ![bounds.left, bounds.right, bounds.top, bounds.bottom].every(Number.isFinite) ||
      bounds.right <= bounds.left || bounds.top <= bounds.bottom || width < 1 || height < 1 ||
      longitude < bounds.left || longitude >= bounds.right || latitude <= bounds.bottom || latitude > bounds.top) return null;
  const col = Math.floor((longitude - bounds.left) / (bounds.right - bounds.left) * width);
  const row = Math.floor((bounds.top - latitude) / (bounds.top - bounds.bottom) * height);
  return row * width + col;
}

export function depthBandSampler(bands: Uint8Array, width: number, height: number, bounds: FloodDepthPatch['bounds'], time?: string): FloodDepthSampler {
  return (longitude, latitude) => {
    const index = gridIndex(longitude, latitude, bounds, width, height);
    return index !== null && bands[index] ? { value: 'Not available', detail: 'Numeric depth not stored', time } : null;
  };
}

export function readRasterDepthBands(image: ImageBitmap, coordinates: number[][], time?: string, minimumDepthM = .2): FloodDepthSampler | null {
  try {
    if (coordinates.length !== 4 || !image.width || !image.height) return null;
    const bounds = { left: coordinates[0][0], right: coordinates[1][0], top: coordinates[0][1], bottom: coordinates[2][1] };
    const numeric = numericImages.get(image);
    if (numeric) return numericDepthSampler(numeric, bounds, 'Simulated water depth', time, minimumDepthM);
    const canvas = document.createElement('canvas');
    // Exported rasters are already reduced; retain their pixels up to a bounded 4 MiB index.
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const bands = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < bands.length; i++) bands[i] = floodDepthBand(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], pixels[i * 4 + 3]);
    return depthBandSampler(bands, canvas.width, canvas.height, bounds, time);
  } catch {
    // A canvas/security limitation must not prevent the flood image from rendering.
    return null;
  }
}

export function withNumericDepthPatches(fallback: FloodDepthSampler | null, patches: FloodDepthPatch[], time?: string, minimumDepthM = .2): FloodDepthSampler {
  const decoded = patches.flatMap(patch => {
    const { width, height, encoding, values } = patch.grid;
    if (encoding !== 'float32-le' || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 4_194_304) return [];
    try {
      if (values.length > Math.ceil(width * height * 4 / 3) * 4) return [];
      const bytes = Uint8Array.from(atob(values), char => char.charCodeAt(0));
      if (bytes.length !== width * height * 4) return [];
      return [{ ...patch, view: new DataView(bytes.buffer) }];
    } catch { return []; }
  });
  return (longitude, latitude) => {
    // Corrected patches replace baseline windows, including cells that became dry.
    for (let i = decoded.length - 1; i >= 0; i--) {
      const patch = decoded[i];
      const index = gridIndex(longitude, latitude, patch.bounds, patch.grid.width, patch.grid.height);
      if (index === null) continue;
      const depth = patch.view.getFloat32(index * 4, true);
      return Number.isFinite(depth) && depth >= minimumDepthM ? {
        value: `~${Math.round(depth * 100 + 0.0001)} cm`, detail: patch.label, time, depthM: depth,
      } : null;
    }
    return fallback?.(longitude, latitude) ?? null;
  };
}

/** A single DOM tooltip, throttled to animation frames; no React render on mousemove. */
export function attachFloodDepthHover(map: any, layerId: string, sample: FloodDepthSampler): () => void {
  const container: HTMLElement = map.getContainer();
  const canvas: HTMLElement = map.getCanvas();
  const tooltip = document.createElement('div');
  tooltip.className = 'pointer-events-none absolute z-30 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-lg';
  tooltip.style.display = 'none';
  tooltip.setAttribute('role', 'tooltip');
  const caption = document.createElement('div');
  caption.className = 'text-[10px] font-medium text-slate-500';
  const value = document.createElement('div');
  value.className = 'text-sm font-bold tabular-nums';
  const time = document.createElement('div');
  time.className = 'text-[10px] text-slate-500';
  tooltip.append(caption, value, time);
  container.append(tooltip);
  let pending = 0;
  let last: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } } | null = null;
  const hide = () => { if (pending) cancelAnimationFrame(pending); pending = 0; last = null; tooltip.style.display = 'none'; };
  const sourceChanged = (event: { sourceId?: string }) => {
    if (event.sourceId === map.getLayer(layerId)?.source) hide();
  };
  const render = () => {
    if (last && (!map.getLayer(layerId) || map.getLayoutProperty(layerId, 'visibility') === 'none')) hide();
  };
  const move = (event: typeof last) => {
    last = event;
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      if (!last || map.isMoving() || !map.getLayer(layerId) || map.getLayoutProperty(layerId, 'visibility') === 'none') { hide(); return; }
      const reading = sample(last.lngLat.lng, last.lngLat.lat);
      if (!reading) { hide(); return; }
      caption.textContent = reading.detail;
      value.textContent = reading.value;
      time.textContent = reading.time ?? '';
      tooltip.style.display = 'block';
      tooltip.style.left = `${Math.max(8, Math.min(last.point.x + 14, container.clientWidth - tooltip.offsetWidth - 8))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(last.point.y + 14, container.clientHeight - tooltip.offsetHeight - 8))}px`;
    });
  };
  map.on('mousemove', move);
  map.on('movestart', hide);
  map.on('style.load', hide);
  map.on('sourcedata', sourceChanged);
  map.on('render', render);
  map.on('remove', hide);
  container.addEventListener('mouseleave', hide);
  canvas.addEventListener('mouseleave', hide);
  return () => {
    hide(); tooltip.remove();
    map.off('mousemove', move); map.off('movestart', hide); map.off('style.load', hide);
    map.off('sourcedata', sourceChanged); map.off('remove', hide); map.off('render', render);
    container.removeEventListener('mouseleave', hide);
    canvas.removeEventListener('mouseleave', hide);
  };
}
