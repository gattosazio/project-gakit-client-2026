const PROXY_BASE = '/api/himawari-proxy';

export const HIMAWARI_AREA = 'se2';
export const HIMAWARI_BAND = 'snd';

// 1x1 transparent PNG used to seed the MapLibre image source so it never fires
// an AJAX at a JMA slot that may 404 (publish gaps / stale frames). Real frames
// are swapped in via updateImage once preloaded by useHimawariLayer.
export const HIMAWARI_PLACEHOLDER_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';

export const HIMAWARI_COORDINATES: [number, number][] = [
  [105, 29.25],
  [140, 29.25],
  [140, -0.25],
  [105, -0.25],
];

// South-west / north-east corners of the se2 image swath, derived from the
// placement coordinates.
export const HIMAWARI_IMAGE_BOUNDS: [[number, number], [number, number]] = [
  [HIMAWARI_COORDINATES[0][0], HIMAWARI_COORDINATES[3][1]],
  [HIMAWARI_COORDINATES[1][0], HIMAWARI_COORDINATES[0][1]],
];

export function himawariFrameURL(time: string): string {
  return `${PROXY_BASE}?area=${HIMAWARI_AREA}&band=${HIMAWARI_BAND}&time=${time}`;
}

export function himawariFrameTimes(frames = 6): string[] {
  const now = new Date();
  now.setUTCMinutes(Math.floor(now.getUTCMinutes() / 10) * 10, 0, 0);
  const times: string[] = [];
  // Oldest frame first so the loop plays forward in time.
  const oldest = new Date(now.getTime() - (frames - 1) * 10 * 60 * 1000);
  for (let i = 0; i < frames; i++) {
    const t = new Date(oldest.getTime() + i * 10 * 60 * 1000);
    times.push(
      `${String(t.getUTCHours()).padStart(2, '0')}${String(t.getUTCMinutes()).padStart(2, '0')}`
    );
  }
  return times;
}

export async function fetchHimawariFrame(time: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load Himawari frame ${time}`));
    img.src = himawariFrameURL(time);
  });
}

// JMA overwrites each dateless slot URL in place and leaves yesterday's file
// served (HTTP 200) until a delayed scan publishes, so a 200 alone does not
// mean the bytes match the requested slot. A frame counts as fresh only when
// its Last-Modified sits within ±20 minutes of the slot's most recent
// occurrence — normal publish lag is ~13 minutes, while a stale carry-over
// from the previous day lands ~24 hours off.
const HIMAWARI_FRESH_WINDOW_MS = 20 * 60 * 1000;

export function isFrameFresh(lastModified: string | null, slotHHMM: string, now = new Date()): boolean {
  if (!lastModified) return false;
  const modified = new Date(lastModified).getTime();
  if (Number.isNaN(modified)) return false;

  const hh = Number(slotHHMM.slice(0, 2));
  const mm = Number(slotHHMM.slice(2));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return false;

  // Most recent occurrence of HHMM relative to `now`, so slots requested just
  // after a UTC midnight rollover compare against yesterday's publication.
  let slot = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm);
  if (slot > now.getTime()) slot -= 24 * 60 * 60 * 1000;

  return Math.abs(modified - slot) <= HIMAWARI_FRESH_WINDOW_MS;
}
