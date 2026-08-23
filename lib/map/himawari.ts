const PROXY_BASE = '/api/himawari-proxy';

export const HIMAWARI_AREA = 'se2';
export const HIMAWARI_BAND = 'snd';

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

export function himawariFrameTimes(frames = 12): string[] {
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
