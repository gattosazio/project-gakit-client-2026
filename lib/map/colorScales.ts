// Flood hazard colors — single source of truth for layers + legend
export const FLOOD_HAZARD_COLORS: Record<string, string> = {
  high: '#1D4ED8',
  medium: '#0891B2',
  low: '#BAE6FD',
};

export const FLOOD_HAZARD_LEGEND: Array<{ key: string; label: string; color: string }> = [
  { key: 'high', label: 'High hazard', color: FLOOD_HAZARD_COLORS.high },
  { key: 'medium', label: 'Medium hazard', color: FLOOD_HAZARD_COLORS.medium },
  { key: 'low', label: 'Low hazard', color: FLOOD_HAZARD_COLORS.low },
];

// JAXA GSMaP official contour palette — 10 classes sampled from the Realtime
// Rainfall Watch viewer colorbars (sharaku.eorc.jaxa.jp/GSMaP_NOW/img/
// console_notes_rain*_e.png). Identical ramp across the hourly and
// accumulative legends; only the numeric class bounds differ per product.
export const RAINFALL_BAND_COLORS = [
  'rgba(0,0,150,1)', // 1  dark navy
  'rgba(0,100,255,1)', // 2  blue
  'rgba(0,180,255,1)', // 3  light blue
  'rgba(51,219,128,1)', // 4  green
  'rgba(155,235,74,1)', // 5  yellow-green
  'rgba(255,235,0,1)', // 6  yellow
  'rgba(255,179,0,1)', // 7  amber
  'rgba(255,100,0,1)', // 8  orange
  'rgba(235,30,0,1)', // 9  red-orange
  'rgba(175,0,0,1)', // 10 dark red
] as const;

const TRANSPARENT_FLOOR = 'rgba(0,0,150,0)';

// Lower bound of each class, straight from the official colorbars:
//   hourly (console_notes_rain_e.png):      0.1 / 0.5 / 1 / 2 / 3 / 5 / 10 / 15 / 20 / 25 mm/hr
//   accumulative (rain12/rain24_e.png):     0.1 / 5 / 10 / 20 / 30 / 50 / 100 / 150 / 200 / 250 mm
// JAXA publishes no 4h/8h bars, so those windows share the accumulative
// scale — mirroring how JAXA itself reuses one bar across 12/24/72h.
export const RAINFALL_BAND_EDGES: Record<number, number[]> = {
  1: [0.1, 0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 15.0, 20.0, 25.0],
  4: [0.1, 5, 10, 20, 30, 50, 100, 150, 200, 250],
  8: [0.1, 5, 10, 20, 30, 50, 100, 150, 200, 250],
  12: [0.1, 5, 10, 20, 30, 50, 100, 150, 200, 250],
  24: [0.1, 5, 10, 20, 30, 50, 100, 150, 200, 250],
};

const FALLBACK_HOURS = 1;

// Fraction of each boundary where the step transition starts; keeps the
// interpolate expression effectively discontinuous between classes.
const STEP_FRACTION = 0.02;

const buildSteppedStops = (edges: number[]) => {
  const holdBefore = (mm: number) => Math.round(mm * (1 - STEP_FRACTION) * 100) / 100;
  const stops: Array<{ mm: number; color: string }> = [
    { mm: 0, color: TRANSPARENT_FLOOR },
    { mm: edges[0], color: RAINFALL_BAND_COLORS[0] },
  ];
  for (let i = 1; i < edges.length; i++) {
    stops.push({ mm: holdBefore(edges[i]), color: RAINFALL_BAND_COLORS[i - 1] });
    stops.push({ mm: edges[i], color: RAINFALL_BAND_COLORS[i] });
  }
  return stops;
};

// Per-window MapLibre step ramps built from the official class bounds.
export const RAINFALL_PAINT_STOPS: Record<number, Array<{ mm: number; color: string }>> =
  Object.fromEntries(
    Object.entries(RAINFALL_BAND_EDGES).map(([hours, edges]) => [
      hours,
      buildSteppedStops(edges),
    ])
  );

// Legend classes. Intensity names are deliberately omitted (JAXA's own
// colorbars carry numbers only): the legend shows swatches + numeric bounds.
export const RAINFALL_LEGEND_STOPS: Record<number, Array<{ label: string; color: string }>> =
  Object.fromEntries(
    Object.keys(RAINFALL_BAND_EDGES).map((hours) => [
      hours,
      RAINFALL_BAND_COLORS.map((color) => ({ label: '', color })),
    ])
  );

// Hard-edged gradient strip mirroring the stepped map ramp. Multi-hour
// windows share the accumulative scale, so their strips are identical.
const buildLegendGradient = (edges: number[]) => {
  const leadIn = 8;
  const bandWidth = (100 - leadIn) / edges.length;
  const segments = edges
    .map((_, i) => {
      const start = leadIn + i * bandWidth;
      const end = start + bandWidth;
      const color = RAINFALL_BAND_COLORS[i];
      return `${color} ${start.toFixed(2)}%, ${color} ${end.toFixed(2)}%`;
    })
    .join(', ');
  return `linear-gradient(to right, ${TRANSPARENT_FLOOR} 0%, ${segments})`;
};

export const RAINFALL_GRADIENT_CSS: Record<number, string> = Object.fromEntries(
  Object.entries(RAINFALL_BAND_EDGES).map(([hours, edges]) => [
    hours,
    buildLegendGradient(edges),
  ])
);

// MapLibre interpolate expression for the rainfall-grid fill color ramp.
export const buildRainfallPaintExpression = (hours: number) => {
  const stops = RAINFALL_PAINT_STOPS[hours] ?? RAINFALL_PAINT_STOPS[FALLBACK_HOURS];
  return [
    'interpolate',
    ['linear'],
    ['get', 'precip_mm'],
    ...stops.flatMap(({ mm, color }) => [mm, color]),
  ];
};

// Lower bound of each legend class, aligned index-for-index with
// RAINFALL_LEGEND_STOPS.
export const rainfallBandValues = (hours: number): number[] => {
  const edges = RAINFALL_BAND_EDGES[hours] ?? RAINFALL_BAND_EDGES[FALLBACK_HOURS];
  return [...edges];
};
