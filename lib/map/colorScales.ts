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

// Near real-time rainfall (JAXA GSMaP_NOW) accumulation scale, in mm over the
// selected accumulation window. Color bands are shared across windows; the
// mm thresholds scale so "Heavy" stays meaningful for both a 1-hour rate and
// a 24-hour total.
export const RAINFALL_LEGEND_STOPS: Record<number, Array<{ label: string; color: string }>> = {
  1: [
    { label: 'Light', color: 'rgba(67,160,210,0.9)' },
    { label: 'Moderate', color: 'rgba(171,217,233,0.95)' },
    { label: 'Heavy', color: 'rgba(254,196,79,0.95)' },
    { label: 'Intense', color: 'rgba(254,153,41,1)' },
    { label: 'Torrential', color: 'rgba(252,90,13,1)' },
  ],
  4: [
    { label: 'Light', color: 'rgba(67,160,210,0.9)' },
    { label: 'Moderate', color: 'rgba(171,217,233,0.95)' },
    { label: 'Heavy', color: 'rgba(254,196,79,0.95)' },
    { label: 'Intense', color: 'rgba(254,153,41,1)' },
    { label: 'Torrential', color: 'rgba(252,90,13,1)' },
  ],
  8: [
    { label: 'Light', color: 'rgba(67,160,210,0.9)' },
    { label: 'Moderate', color: 'rgba(171,217,233,0.95)' },
    { label: 'Heavy', color: 'rgba(254,196,79,0.95)' },
    { label: 'Intense', color: 'rgba(254,153,41,1)' },
    { label: 'Torrential', color: 'rgba(252,90,13,1)' },
  ],
  12: [
    { label: 'Light', color: 'rgba(67,160,210,0.9)' },
    { label: 'Moderate', color: 'rgba(171,217,233,0.95)' },
    { label: 'Heavy', color: 'rgba(254,196,79,0.95)' },
    { label: 'Intense', color: 'rgba(254,153,41,1)' },
    { label: 'Torrential', color: 'rgba(252,90,13,1)' },
  ],
  24: [
    { label: 'Light', color: 'rgba(64,67,135,0.9)' },
    { label: 'Moderate', color: 'rgba(41,100,130,0.95)' },
    { label: 'Heavy', color: 'rgba(34,133,98,0.95)' },
    { label: 'Intense', color: 'rgba(94,173,48,1)' },
    { label: 'Torrential', color: 'rgba(253,231,37,1)' },
  ],
};

export const RAINFALL_GRADIENT_CSS: Record<number, string> = {
  1: 'linear-gradient(to right, rgba(33,102,172,0), rgba(33,102,172,0.8), rgba(67,160,210,0.9), rgba(103,169,207,0.9), rgba(171,217,233,0.95), rgba(254,224,144,0.95), rgba(254,196,79,0.95), rgba(254,153,41,1), rgba(252,90,13,1), rgba(203,24,29,1))',
  4: 'linear-gradient(to right, rgba(33,102,172,0), rgba(33,102,172,0.8), rgba(67,160,210,0.9), rgba(103,169,207,0.9), rgba(171,217,233,0.95), rgba(254,224,144,0.95), rgba(254,196,79,0.95), rgba(254,153,41,1), rgba(252,90,13,1), rgba(203,24,29,1))',
  8: 'linear-gradient(to right, rgba(33,102,172,0), rgba(33,102,172,0.8), rgba(67,160,210,0.9), rgba(103,169,207,0.9), rgba(171,217,233,0.95), rgba(254,224,144,0.95), rgba(254,196,79,0.95), rgba(254,153,41,1), rgba(252,90,13,1), rgba(203,24,29,1))',
  12: 'linear-gradient(to right, rgba(33,102,172,0), rgba(33,102,172,0.8), rgba(67,160,210,0.9), rgba(103,169,207,0.9), rgba(171,217,233,0.95), rgba(254,224,144,0.95), rgba(254,196,79,0.95), rgba(254,153,41,1), rgba(252,90,13,1), rgba(203,24,29,1))',
  24: 'linear-gradient(to right, rgba(68,1,84,0), rgba(68,1,84,0.8), rgba(72,35,116,0.9), rgba(64,67,135,0.9), rgba(53,83,136,0.95), rgba(41,100,130,0.95), rgba(32,115,118,0.95), rgba(34,133,98,0.95), rgba(53,151,72,1), rgba(94,173,48,1), rgba(146,196,57,1), rgba(253,231,37,1))',
};

// Per-window color ramps matching JAXA GSMaP official contour legends exactly.
// Values from official JAXA contour legend images (mm).
export const RAINFALL_PAINT_STOPS: Record<
  number,
  Array<{ mm: number; color: string }>
> = {
  // 1-Hour Accumulation (rainfall-contour-legend-1hr.png)
  // Cyan (Light): 0 to 2.5
  // Blue (Moderate): 2.5 to 7.5
  // Dark Blue (Heavy): 7.5 to 15
  // Orange (Intense): 15 to <30
  // Red (Torrential): >30
  1: [
    { mm: 0, color: 'rgba(33,102,172,0)' },
    { mm: 0.1, color: 'rgba(33,102,172,0.8)' },   // Trace - Cyan start
    { mm: 1, color: 'rgba(67,160,210,0.9)' },      // Light - Cyan
    { mm: 2.5, color: 'rgba(103,169,207,0.9)' },   // Light-Moderate boundary - Cyan to Blue
    { mm: 5, color: 'rgba(171,217,233,0.95)' },    // Moderate - Blue
    { mm: 7.5, color: 'rgba(254,224,144,0.95)' },  // Heavy boundary - Blue to Dark Blue
    { mm: 10, color: 'rgba(254,196,79,0.95)' },    // Heavy - Dark Blue
    { mm: 15, color: 'rgba(254,153,41,1)' },       // Intense boundary - Dark Blue to Orange
    { mm: 20, color: 'rgba(254,196,79,0.95)' },    // Intense - Orange
    { mm: 30, color: 'rgba(254,153,41,1)' },       // Torrential boundary - Orange to Red
    { mm: 40, color: 'rgba(252,90,13,1)' },        // Torrential - Red
    { mm: 60, color: 'rgba(203,24,29,1)' },        // Extreme Red
  ],
  // 4-Hour Accumulation (rainfall-contour-legend-4hr.png)
  // Cyan: 0 to 20
  // Blue: 20 to 40
  // Dark Blue: 40 to 60
  // Orange: 60 to <70
  // Red: >70
  4: [
    { mm: 0, color: 'rgba(33,102,172,0)' },
    { mm: 0.1, color: 'rgba(33,102,172,0.8)' },    // Trace - Cyan start
    { mm: 5, color: 'rgba(67,160,210,0.9)' },      // Light - Cyan
    { mm: 15, color: 'rgba(103,169,207,0.9)' },    // Light-Moderate - Cyan to Blue
    { mm: 20, color: 'rgba(171,217,233,0.95)' },   // Cyan/Blue boundary
    { mm: 30, color: 'rgba(254,224,144,0.95)' },   // Moderate - Blue
    { mm: 40, color: 'rgba(254,196,79,0.95)' },    // Blue/Dark Blue boundary
    { mm: 50, color: 'rgba(254,153,41,1)' },       // Heavy - Dark Blue
    { mm: 60, color: 'rgba(254,196,79,0.95)' },    // Dark Blue/Orange boundary
    { mm: 70, color: 'rgba(254,153,41,1)' },       // Orange/Red boundary
    { mm: 85, color: 'rgba(252,90,13,1)' },        // Torrential - Red
    { mm: 100, color: 'rgba(203,24,29,1)' },       // Extreme Red
  ],
  // 8-Hour Accumulation (rainfall-contour-legend-8hr.png)
  // Cyan: 0 to 40
  // Blue: 40 to 80
  // Dark Blue: 80 to 120
  // Orange: 120 to <160
  // Red: >160
  8: [
    { mm: 0, color: 'rgba(33,102,172,0)' },
    { mm: 0.1, color: 'rgba(33,102,172,0.8)' },    // Trace - Cyan start
    { mm: 10, color: 'rgba(67,160,210,0.9)' },     // Light - Cyan
    { mm: 25, color: 'rgba(103,169,207,0.9)' },    // Light-Moderate - Cyan to Blue
    { mm: 40, color: 'rgba(171,217,233,0.95)' },   // Cyan/Blue boundary
    { mm: 60, color: 'rgba(254,224,144,0.95)' },   // Moderate - Blue
    { mm: 80, color: 'rgba(254,196,79,0.95)' },    // Blue/Dark Blue boundary
    { mm: 100, color: 'rgba(254,153,41,1)' },      // Heavy - Dark Blue
    { mm: 120, color: 'rgba(254,153,41,1)' },      // Dark Blue/Orange boundary
    { mm: 140, color: 'rgba(254,196,79,0.95)' },   // Intense - Orange
    { mm: 160, color: 'rgba(254,153,41,1)' },      // Orange/Red boundary
    { mm: 180, color: 'rgba(252,90,13,1)' },       // Torrential - Red
    { mm: 200, color: 'rgba(203,24,29,1)' },       // Extreme Red
  ],
  // 12-Hour Accumulation (rainfall-contour-legend-12hr.png)
  // Cyan: 0 to 60
  // Blue: 60 to 120
  // Dark Blue: 120 to 180
  // Orange: 180 to <240
  // Red: >240
  12: [
    { mm: 0, color: 'rgba(33,102,172,0)' },
    { mm: 0.1, color: 'rgba(33,102,172,0.8)' },    // Trace - Cyan start
    { mm: 15, color: 'rgba(67,160,210,0.9)' },     // Light - Cyan
    { mm: 35, color: 'rgba(103,169,207,0.9)' },    // Light-Moderate - Cyan to Blue
    { mm: 60, color: 'rgba(171,217,233,0.95)' },   // Cyan/Blue boundary
    { mm: 90, color: 'rgba(254,224,144,0.95)' },   // Moderate - Blue
    { mm: 120, color: 'rgba(254,196,79,0.95)' },   // Blue/Dark Blue boundary
    { mm: 150, color: 'rgba(254,153,41,1)' },      // Heavy - Dark Blue
    { mm: 180, color: 'rgba(254,153,41,1)' },      // Dark Blue/Orange boundary
    { mm: 200, color: 'rgba(254,196,79,0.95)' },   // Intense - Orange
    { mm: 240, color: 'rgba(254,153,41,1)' },      // Orange/Red boundary
    { mm: 280, color: 'rgba(252,90,13,1)' },       // Torrential - Red
    { mm: 350, color: 'rgba(203,24,29,1)' },       // Extreme Red
  ],
  // 24-Hour Accumulation (rainfall-contour-legend-24hr.png)
  // Cyan: 0 to 100
  // Blue: 100 to 200
  // Dark Blue: 200 to 300
  // Orange: 300 to <400
  // Red: >400
  24: [
    { mm: 0, color: 'rgba(68,1,84,0)' },           // Transparent viridis start
    { mm: 0.1, color: 'rgba(68,1,84,0.8)' },       // Deep purple
    { mm: 25, color: 'rgba(72,35,116,0.9)' },      // Dark purple
    { mm: 50, color: 'rgba(64,67,135,0.9)' },      // Purple-blue
    { mm: 75, color: 'rgba(53,83,136,0.95)' },     // Blue
    { mm: 100, color: 'rgba(41,100,130,0.95)' },   // Cyan/Blue boundary
    { mm: 150, color: 'rgba(32,115,118,0.95)' },   // Blue
    { mm: 200, color: 'rgba(34,133,98,0.95)' },    // Blue/Dark Blue boundary
    { mm: 250, color: 'rgba(53,151,72,1)' },       // Dark Blue
    { mm: 300, color: 'rgba(94,173,48,1)' },       // Dark Blue/Orange boundary
    { mm: 350, color: 'rgba(146,196,57,1)' },      // Orange
    { mm: 400, color: 'rgba(253,231,37,1)' },      // Orange/Red boundary
    { mm: 500, color: 'rgba(253,231,37,1)' },      // Red
    { mm: 600, color: 'rgba(203,24,29,1)' },       // Extreme Red
  ],
};

// MapLibre interpolate expression for the rainfall-grid fill color ramp.
export const buildRainfallPaintExpression = (hours: number) => {
  const stops = RAINFALL_PAINT_STOPS[hours] ?? RAINFALL_PAINT_STOPS[1];
  return [
    'interpolate',
    ['linear'],
    ['get', 'precip_mm'],
    ...stops.flatMap(({ mm, color }) => [mm, color]),
  ];
};

// Lower-bound thresholds for each legend band (the transparent 0 floor is
// dropped), used to render the per-window numeric scale under the gradient.
export const rainfallBandValues = (hours: number): number[] => {
  const stops = RAINFALL_PAINT_STOPS[hours] ?? RAINFALL_PAINT_STOPS[1];
  return stops.slice(1).map(({ mm }) => mm);
};
