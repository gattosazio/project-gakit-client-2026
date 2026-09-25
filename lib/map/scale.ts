export type ScaleReadout = {
  /** Rounded ground distance expressed in `unit`. */
  distance: number;
  unit: 'm' | 'km';
  /** Length of the scale bar, in pixels, that represents `distance`. */
  px: number;
};

function getDecimalRoundNum(value: number): number {
  const multiplier = Math.pow(10, Math.ceil(-Math.log(value) / Math.LN10));
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Snaps a positive number down to the nearest 1/2/3/5 x 10^n so a scale bar
 * shows a round figure. Mirrors MapLibre's internal `getRoundNum` so the
 * readouts match what users see on other maps.
 */
export function roundNice(num: number): number {
  if (!Number.isFinite(num) || num <= 0) return 0;

  const pow10 = Math.pow(10, `${Math.floor(num)}`.length - 1);
  let d = num / pow10;
  d =
    d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : d >= 1 ? 1 : getDecimalRoundNum(d);
  return pow10 * d;
}

/**
 * Turns the ground distance spanned by a `maxPx`-long screen segment into a
 * round distance plus the bar length that represents it. The bar is never longer
 * than `maxPx`, because `roundNice` always rounds down.
 *
 * Returns null for degenerate input so callers can skip a frame rather than
 * render a meaningless bar.
 */
export function computeScale(maxMeters: number, maxPx: number): ScaleReadout | null {
  if (!Number.isFinite(maxMeters) || !Number.isFinite(maxPx)) return null;
  if (maxMeters <= 0 || maxPx <= 0) return null;

  const unit = maxMeters >= 1000 ? 'km' : 'm';
  const maxDistance = unit === 'km' ? maxMeters / 1000 : maxMeters;
  const distance = roundNice(maxDistance);
  if (distance <= 0) return null;

  return {
    distance,
    unit,
    px: Math.min(maxPx, (distance / maxDistance) * maxPx),
  };
}
