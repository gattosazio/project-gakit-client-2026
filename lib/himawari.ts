const PROXY_BASE = '/api/himawari-proxy';

export const HIMAWARI_AREA = 'se2';
export const HIMAWARI_BAND = 'snd';

export const HIMAWARI_COORDINATES: [number, number][] = [
  [105, 29.25],
  [140, 29.25],
  [140, -0.25],
  [105, -0.25],
];

export function himawariFrameURL(time: string): string {
  return `${PROXY_BASE}?area=${HIMAWARI_AREA}&band=${HIMAWARI_BAND}&time=${time}`;
}

export function himawariFrameTimes(frames = 12): string[] {
  const now = new Date();
  now.setUTCMinutes(Math.floor(now.getUTCMinutes() / 10) * 10, 0, 0);
  const times: string[] = [];
  for (let i = 0; i < frames; i++) {
    const t = new Date(now.getTime() - i * 10 * 60 * 1000);
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
