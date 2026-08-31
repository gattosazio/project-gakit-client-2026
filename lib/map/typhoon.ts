import type {
  TyphoonApiResponse,
  TyphoonCategory,
  TyphoonProperties,
} from '@/types/typhoon';

/**
 * Standard PAGASA PAR (Philippine Area of Responsibility) boundary coordinates.
 * Point order: NW -> NE -> SE -> S -> WNW -> NW (Closed polygon)
 */
export const PAR_BOUNDARY_GEOJSON: any = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Philippine Area of Responsibility (PAR)',
        agency: 'DOST-PAGASA',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [120.0, 25.0],
            [135.0, 25.0],
            [135.0, 5.0],
            [115.0, 5.0],
            [115.0, 15.0],
            [120.0, 21.0],
            [120.0, 25.0],
          ],
        ],
      },
    },
  ],
};

/**
 * Official DOST-PAGASA & Project NOAH 6 Tropical Cyclone Classifications
 */
export const TYPHOON_CATEGORY_CONFIG: Record<
  string,
  {
    label: string;
    name: string;
    color: string;
    windRange: string;
    description?: string;
  }
> = {
  STY: {
    label: 'STY',
    name: 'Super Typhoon',
    color: '#a855f7', // Purple
    windRange: '≥ 185 km/h',
    description: 'Catastrophic sustained winds capable of widespread severe structural destruction and storm surges.',
  },
  TY: {
    label: 'TY',
    name: 'Typhoon',
    color: '#ef4444', // Red
    windRange: '118–184 km/h',
    description: 'Destructive to very destructive winds causing substantial roof, tree, and infrastructure damage.',
  },
  STS: {
    label: 'STS',
    name: 'Severe Tropical Storm',
    color: '#f97316', // Orange
    windRange: '89–117 km/h',
    description: 'Damaging gale to storm-force winds with hazardous sea conditions and rough coastal waters.',
  },
  TS: {
    label: 'TS',
    name: 'Tropical Storm',
    color: '#eab308', // Yellow
    windRange: '62–88 km/h',
    description: 'Strong to gale-force winds capable of light to moderate structural strain and marine hazards.',
  },
  TD: {
    label: 'TD',
    name: 'Tropical Depression',
    color: '#22c55e', // Green
    windRange: '≤ 61 km/h',
    description: 'Strong breeze to near-gale winds producing dense cloud clusters and moderate to heavy rainfall.',
  },
  LPA: {
    label: 'LPA',
    name: 'Low Pressure Area',
    color: '#0284c7', // Blue
    windRange: 'Developing Low',
    description: 'Developing low pressure system or tropical disturbance with unorganized atmospheric circulation.',
  },
};

/** Official 6 DOST-PAGASA cyclone categories */
export const PRIMARY_TYPHOON_CATEGORIES = ['STY', 'TY', 'STS', 'TS', 'TD', 'LPA'] as const;

export const DEFAULT_TYPHOON_COLOR = '#ef4444';

/**
 * Normalizes raw agency acronyms or upstream typos (e.g. 'AA', 'LOW', 'TC')
 * into the official 6 DOST-PAGASA classifications.
 */
export function normalizeTyphoonCategory(category?: string): string {
  if (!category) return 'LPA';
  const upper = category.toUpperCase().trim();
  if (upper in TYPHOON_CATEGORY_CONFIG) return upper;
  if (upper === 'LOW' || upper === 'AA' || upper === 'PTC' || upper === 'DB' || upper === 'WV' || upper === 'EX') {
    return 'LPA';
  }
  if (upper === 'SUPER TYPHOON' || upper === 'SUPERTYPHOON') return 'STY';
  if (upper === 'SEVERE TROPICAL STORM') return 'STS';
  if (upper === 'TROPICAL STORM') return 'TS';
  if (upper === 'TROPICAL DEPRESSION') return 'TD';
  return 'TY';
}

export function getTyphoonCategoryColor(category?: string): string {
  const code = normalizeTyphoonCategory(category);
  return TYPHOON_CATEGORY_CONFIG[code]?.color ?? DEFAULT_TYPHOON_COLOR;
}

export function getTyphoonCategoryLabel(category?: string): string {
  const code = normalizeTyphoonCategory(category);
  return TYPHOON_CATEGORY_CONFIG[code]?.name ?? 'Cyclone';
}

/**
 * Formats a typhoon point for popup display
 */
export function buildTyphoonPopupHtml(props: TyphoonProperties): string {
  const cleanLocal = (props.local_name || props.typhoon_name || '')
    .replace(/[{}]/g, '')
    .trim();
  const cleanIntl = (props.international_name || '')
    .replace(/[{}]/g, '')
    .trim();

  let name = 'Tropical Cyclone';
  if (cleanLocal && cleanIntl && cleanLocal !== cleanIntl) {
    name = `Bagyong ${cleanLocal} (${cleanIntl})`;
  } else if (cleanLocal) {
    name = `Bagyong ${cleanLocal}`;
  } else if (cleanIntl) {
    name = cleanIntl;
  }

  const typeCode = normalizeTyphoonCategory(props.typhoon_type);
  const typeConfig = TYPHOON_CATEGORY_CONFIG[typeCode] || TYPHOON_CATEGORY_CONFIG.TY;

  const isForecast = (props.radius ?? 0) > 0;

  const dateStr = props.datetime
    ? new Date(props.datetime).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : `${props.date || ''} ${props.time || ''}`.trim() || 'Active';

  return `
    <div class="gakit-tooltip typhoon-popup min-w-[260px] sm:min-w-[280px] text-slate-800" style="font-family: var(--font-inter), system-ui, sans-serif;">
      <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 pr-6">
        <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-2xs shrink-0" style="background-color: ${typeConfig.color}">
          ${typeCode}
        </span>
        <div class="font-bold text-xs text-slate-900 truncate leading-tight">${name}</div>
      </div>
      <div class="space-y-1.5 text-[11px] leading-relaxed">
        <div class="flex items-center justify-between gap-4">
          <span class="text-slate-500 shrink-0">Classification:</span>
          <span class="font-semibold text-slate-900 text-right">${typeConfig.name}</span>
        </div>
        ${
          props.windspeed
            ? `<div class="flex items-center justify-between gap-4">
                <span class="text-slate-500 shrink-0">Max Sustained Winds:</span>
                <span class="font-semibold text-slate-900 text-right tabular-nums">${props.windspeed} km/h</span>
              </div>`
            : ''
        }
        ${
          props.pressure
            ? `<div class="flex items-center justify-between gap-4">
                <span class="text-slate-500 shrink-0">Central Pressure:</span>
                <span class="font-semibold text-slate-900 text-right tabular-nums">${props.pressure} hPa</span>
              </div>`
            : ''
        }
        ${
          isForecast && props.radius
            ? `<div class="flex items-center justify-between gap-4">
                <span class="text-slate-500 shrink-0">Forecast Radius:</span>
                <span class="font-semibold text-slate-900 text-right tabular-nums">± ${Math.round(props.radius)} km</span>
              </div>`
            : ''
        }
        <div class="flex items-center justify-between gap-4">
          <span class="text-slate-500 shrink-0">Position:</span>
          <span class="font-mono text-[10.5px] font-semibold text-slate-900 text-right">
            ${
              typeof props.latitude === 'number' && typeof props.longitude === 'number'
                ? `${props.latitude.toFixed(1)}°N, ${props.longitude.toFixed(1)}°E`
                : 'Active Coordinates'
            }
          </span>
        </div>
        <div class="flex items-center justify-between gap-4 pt-1.5 border-t border-slate-100 text-[10px] text-slate-400">
          <span class="shrink-0">Date/Time:</span>
          <span class="font-medium text-slate-600 text-right">${dateStr}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Fetches typhoon track data from the client proxy API
 */
export async function fetchTyphoonTrack(): Promise<TyphoonApiResponse> {
  const res = await fetch('/api/typhoon-track', {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch typhoon data: ${res.statusText}`);
  }

  return res.json();
}
