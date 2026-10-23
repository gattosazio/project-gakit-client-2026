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
    cache: 'no-store', signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Satellite frame list is temporarily unavailable');
  const body = await response.json() as { frames?: unknown };
  if (!Array.isArray(body.frames)) throw new Error('Invalid satellite frame list');
  const frames = [...new Set(body.frames.filter((time): time is string => typeof time === 'string' && /^\d{14}$/.test(time)))];
  if (!frames.length) throw new Error('No published satellite frames available');
  return frames.sort().slice(-8);
}

export async function fetchHimawariFrame(time: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
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
  });
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
  const candidates = [...new Set(times)].reverse();
  const accept = (time: string, image: HTMLImageElement) => {
    frames.set(time, image);
    options.onFrame?.(time, image);
    onProgress?.(frames.size);
  };
  // Two frames at a time keep each server render's 16 tiles from queuing
  // behind a whole animation's worth of work. Publish each success immediately.
  while (candidates.length && frames.size < limit && (options.shouldContinue?.() ?? true)) {
    const batch = candidates.splice(0, Math.min(2, limit - frames.size));
    await Promise.allSettled(batch.map(async time => {
      const image = options.cachedFrames?.get(time) ?? await fetchHimawariFrame(time);
      if (options.shouldContinue?.() ?? true) accept(time, image);
    }));
  }
  return new Map(times.flatMap(time => frames.has(time) ? [[time, frames.get(time)!] as const] : []));
}
