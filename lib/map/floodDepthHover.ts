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
  location?: string;
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

const PROBE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"><circle cx="14" cy="14" r="5"/><path d="M14 2v4m0 16v4M2 14h4m16 0h4"/></g><g fill="none" stroke="#7b1113" stroke-width="1.75" stroke-linecap="round"><circle cx="14" cy="14" r="5"/><path d="M14 2v4m0 16v4M2 14h4m16 0h4"/></g></svg>';
const DEPTH_PROBE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(PROBE_SVG)}") 14 14, crosshair`;

/** A single DOM tooltip, throttled to animation frames; no React render on mousemove. */
export function attachFloodDepthHover(map: any, layerId: string, sample: FloodDepthSampler): () => void {
  const container: HTMLElement = map.getContainer();
  const canvas: HTMLElement = map.getCanvas();
  const tooltip = document.createElement('div');
  tooltip.className = 'pointer-events-none absolute z-30 rounded-xl bg-white px-3 py-2.5 text-slate-800 shadow-[0_6px_20px_rgba(15,23,42,0.16)]';
  tooltip.style.display = 'none';
  tooltip.setAttribute('role', 'tooltip');
  const caption = document.createElement('div');
  caption.className = 'text-xs font-medium leading-4 text-slate-600';
  caption.textContent = 'Estimated depth';
  const value = document.createElement('div');
  value.className = 'mt-0.5 text-lg font-semibold leading-6 tabular-nums text-gakit-maroon';
  const context = document.createElement('div');
  context.className = 'mt-1 text-xs font-semibold leading-4 text-slate-800 [overflow-wrap:anywhere]';
  const time = document.createElement('div');
  time.className = 'mt-1 text-xs leading-4 text-slate-600';
  tooltip.append(caption, value, context, time);
  container.append(tooltip);
  let pending = 0;
  let previousCursor = canvas.style.cursor || '';
  let last: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } } | null = null;
  const hide = () => {
    if (pending) cancelAnimationFrame(pending);
    pending = 0; last = null; tooltip.style.display = 'none';
    if (canvas.style.cursor === DEPTH_PROBE_CURSOR) canvas.style.cursor = previousCursor;
  };
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
      value.textContent = reading.value;
      value.className = reading.depthM !== undefined ? 'mt-0.5 text-lg font-semibold leading-6 tabular-nums text-gakit-maroon' : 'mt-0.5 text-sm font-semibold leading-5 text-slate-700';
      context.textContent = reading.location ?? (/^(simulated|estimated) (water )?depth$/i.test(reading.detail) ? '' : reading.detail);
      context.style.display = context.textContent ? 'block' : 'none';
      time.textContent = reading.time ?? '';
      time.style.display = reading.time ? 'block' : 'none';
      if (canvas.style.cursor !== DEPTH_PROBE_CURSOR) previousCursor = canvas.style.cursor || '';
      canvas.style.cursor = DEPTH_PROBE_CURSOR;
      tooltip.style.maxWidth = `${Math.min(256, Math.max(0, container.clientWidth - 16))}px`;
      tooltip.style.display = 'block';
      const left = last.point.x + 18 + tooltip.offsetWidth <= container.clientWidth - 8 ? last.point.x + 18 : last.point.x - tooltip.offsetWidth - 18;
      const top = last.point.y + 18 + tooltip.offsetHeight <= container.clientHeight - 8 ? last.point.y + 18 : last.point.y - tooltip.offsetHeight - 18;
      tooltip.style.left = `${Math.max(8, Math.min(left, container.clientWidth - tooltip.offsetWidth - 8))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(top, container.clientHeight - tooltip.offsetHeight - 8))}px`;
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
