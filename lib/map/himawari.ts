const PROXY_BASE = '/api/himawari-proxy';

// 1x1 transparent PNG used to seed the MapLibre image source so it never fires
// an AJAX at a slot that may 404 (publish gaps / stale frames). Real frames
// are swapped in via updateImage once preloaded by useHimawariLayer.
export const HIMAWARI_PLACEHOLDER_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';

export const HIMAWARI_COORDINATES: [number, number][] = [
  [105, 29.25],
  [150, 29.25],
  [150, -0.25],
  [105, -0.25],
];

// South-west / north-east corners of the satellite crop, derived from the
// placement coordinates.
export const HIMAWARI_IMAGE_BOUNDS: [[number, number], [number, number]] = [
  [HIMAWARI_COORDINATES[0][0], HIMAWARI_COORDINATES[3][1]],
  [HIMAWARI_COORDINATES[1][0], HIMAWARI_COORDINATES[0][1]],
];

export function himawariFrameURL(time: string): string {
  // The proxy renders CIRA SLIDER band-13 IR (2 km full disk, regridded)
  // into exactly these bounds, keyed by the manifest's full UTC timestamp.
  return `${PROXY_BASE}?time=${time}`;
}

/** Ask the server for published scans rather than guessing slots from local time. */
export async function fetchHimawariFrameTimes(): Promise<string[]> {
  const response = await fetch(`${PROXY_BASE}?manifest=1`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Satellite frame list is temporarily unavailable');
  const body = await response.json() as { frames?: unknown };
  if (!Array.isArray(body.frames)) throw new Error('Invalid satellite frame list');
  const frames = [...new Set(body.frames.filter((time): time is string => typeof time === 'string' && /^\d{14}$/.test(time)))];
  if (!frames.length) throw new Error('No published satellite frames available');
  return frames.sort().slice(-8);
}

// Rapid off/on switches share downloads already being rendered by the proxy.
// Decoded frames stay in the hook's bounded cache, not this in-flight map.
const pendingFrames = new Map<string, Promise<HTMLImageElement>>();
export function fetchHimawariFrame(time: string): Promise<HTMLImageElement> {
  const existing = pendingFrames.get(time);
  if (existing) return existing;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const finish = (error?: Error) => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      if (error) {
        img.src = '';
        reject(error);
      } else resolve(img);
    };
    // The server may take 45 seconds to render a cold frame. Leave time for
    // response transfer too, so the browser does not abandon successful work.
    const timer = setTimeout(() => finish(new Error('Satellite imagery request timed out')), 55_000);
    img.crossOrigin = 'anonymous';
    img.onload = () => finish();
    img.onerror = () => finish(new Error(`Failed to load Himawari frame ${time}`));
    img.src = himawariFrameURL(time);
  }).finally(() => { pendingFrames.delete(time); });
  pendingFrames.set(time, pending);
  return pending;
}

type FrameLoadOptions = {
  maxFrames?: number;
  cachedFrames?: ReadonlyMap<string, HTMLImageElement>;
  onFrame?: (time: string, image: HTMLImageElement) => void;
  shouldContinue?: () => boolean;
};

/** Load newest scans first, using older candidates only to replace missing scans. */
export async function loadHimawariFrames(
  times: string[],
  onProgress?: (loaded: number) => void,
  options: FrameLoadOptions = {},
): Promise<Map<string, HTMLImageElement>> {
  const frames = new Map<string, HTMLImageElement>();
  const limit = options.maxFrames ?? times.length;
  const newestFirst = [...new Set(times)].sort().reverse();
  const shouldContinue = () => options.shouldContinue?.() ?? true;
  const accept = (time: string, image: HTMLImageElement) => {
    frames.set(time, image);
    options.onFrame?.(time, image);
    onProgress?.(frames.size);
  };
  // Publish reusable scans in the target window before any network work.
  // Older cached scans remain fallbacks so they cannot displace newer imagery.
  for (const time of newestFirst.slice(0, limit)) {
    const image = options.cachedFrames?.get(time);
    if (!shouldContinue()) break;
    if (image) accept(time, image);
  }
  const candidates = newestFirst.filter(time => !frames.has(time));
  let inFlight = 0;
  const worker = async () => {
    // Reserve remaining places before fetching. A slow scan must neither block
    // the other worker nor cause speculative downloads beyond the frame limit.
    while (candidates.length && frames.size + inFlight < limit && shouldContinue()) {
      const time = candidates.shift()!;
      inFlight++;
      let image: HTMLImageElement | undefined;
      try {
        image = options.cachedFrames?.get(time) ?? await fetchHimawariFrame(time);
      } catch {
        // Try an older published scan if this one could not be loaded.
      } finally {
        inFlight--;
      }
      if (image && shouldContinue()) accept(time, image);
    }
  };
  await Promise.all([worker(), worker()]);
  return new Map([...frames].sort(([a], [b]) => a.localeCompare(b)));
}
