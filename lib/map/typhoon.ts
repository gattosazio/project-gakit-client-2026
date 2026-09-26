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
 * Formats typhoon local & international names, ensuring the "Bagyong" prefix
 * is removed while keeping the international name in parentheses (e.g., "KRISTINE (TRAMI)").
 */
export function formatTyphoonDisplayName(local?: string, intl?: string): string {
  let rawLocal = (local || '').trim();
  let rawIntl = (intl || '').trim();

  // If local has braces like "KRISTINE{TRAMI}" or "PILANDOK{}"
  const braceMatch = rawLocal.match(/^([^{}]+?)(?:\s*\{\s*([^{}]*)\s*\})?$/);
  if (braceMatch) {
    rawLocal = braceMatch[1] || '';
    if (!rawIntl && braceMatch[2]) {
      rawIntl = braceMatch[2];
    }
  }

  // Remove "bagyong " prefix
  let cleanLocal = rawLocal.replace(/^bagyong\s+/i, '').trim();
  let cleanIntl = rawIntl.replace(/^bagyong\s+/i, '').replace(/[{}]/g, '').trim();

  // If cleanLocal has (INTL)
  const parenMatch = cleanLocal.match(/^([^(]+?)(?:\s*\(\s*([^)]*)\s*\))?$/);
  if (parenMatch) {
    cleanLocal = parenMatch[1].trim();
    if (!cleanIntl && parenMatch[2]) {
      cleanIntl = parenMatch[2].replace(/^bagyong\s+/i, '').trim();
    }
  }

  cleanLocal = cleanLocal.replace(/[{}]/g, '').trim();

  if (cleanLocal && cleanIntl && cleanLocal.toUpperCase() !== cleanIntl.toUpperCase()) {
    return `${cleanLocal} (${cleanIntl})`;
  }
  if (cleanLocal) return cleanLocal;
  if (cleanIntl) return cleanIntl;
  return 'Tropical Cyclone';
}

/**
 * Formats a track point timestamp into a human-readable date label (e.g. "Aug 30, 8:00 AM").
 */
export function formatTrackDateLabel(dateStr?: string, timeStr?: string, datetimeStr?: string): string {
  try {
    const raw = datetimeStr || (dateStr && timeStr ? `${dateStr}T${timeStr}:00` : dateStr || '');
    if (!raw) return '';
    const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      const monthDay = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const time = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${monthDay}, ${time}`;
    }
  } catch {}
  return [dateStr, timeStr].filter(Boolean).join(' ');
}

/**
 * Builds colored track line segments partitioned into:
 * - Past track (solid, before/at current position)
 * - Forecast track (dashed, after current position)
 * With each segment colored by the cyclone category at that stage.
 */
export function buildColoredTrackLines(
  points: any[],
  currentIdx: number,
  stormName: string
): any[] {
  if (!Array.isArray(points) || points.length < 2) return [];

  const lines: any[] = [];
  let currentSegment: {
    trackType: 'past' | 'forecast';
    category: string;
    coords: [number, number][];
  } | null = null;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const c1 = p1.geometry?.coordinates;
    const c2 = p2.geometry?.coordinates;
    if (!c1 || !c2) continue;

    const isForecast = i >= currentIdx;
    const trackType = isForecast ? 'forecast' : 'past';
    const rawCat = isForecast
      ? (p2.properties?.typhoon_type || p1.properties?.typhoon_type)
      : (p1.properties?.typhoon_type || p2.properties?.typhoon_type);
    const cat = normalizeTyphoonCategory(rawCat || 'TY');

    if (
      currentSegment &&
      currentSegment.trackType === trackType &&
      currentSegment.category === cat
    ) {
      currentSegment.coords.push(c2);
    } else {
      if (currentSegment && currentSegment.coords.length >= 2) {
        const segColor = TYPHOON_CATEGORY_CONFIG[currentSegment.category]?.color || DEFAULT_TYPHOON_COLOR;
        lines.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: currentSegment.coords,
          },
          properties: {
            type: 'track_line',
            track_type: currentSegment.trackType,
            is_forecast: currentSegment.trackType === 'forecast',
            typhoon_type: currentSegment.category,
            color: segColor,
            typhoon_name: stormName,
          },
        });
      }
      currentSegment = {
        trackType,
        category: cat,
        coords: [c1, c2],
      };
    }
  }

  if (currentSegment && currentSegment.coords.length >= 2) {
    const segColor = TYPHOON_CATEGORY_CONFIG[currentSegment.category]?.color || DEFAULT_TYPHOON_COLOR;
    lines.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: currentSegment.coords,
      },
      properties: {
        type: 'track_line',
        track_type: currentSegment.trackType,
        is_forecast: currentSegment.trackType === 'forecast',
        typhoon_type: currentSegment.category,
        color: segColor,
        typhoon_name: stormName,
      },
    });
  }

  return lines;
}

/**
 * Enriches a Typhoon FeatureCollection with standardized labels,
 * tagging the latest actual observation point with `is_current: true` and `current_label`,
 * generating date labels for all track milestones, cleaning storm titles,
 * and generating category-colored, solid-past and dashed-forecast track lines.
 */
export function enrichTyphoonTrackGeoJson(track: any): any {
  if (!track || !Array.isArray(track.features)) return track;

  const pointFeatures: any[] = [];
  const otherFeatures: any[] = [];
  const fallbackLineFeatures: any[] = [];

  for (const feature of track.features) {
    if (feature?.geometry?.type === 'Point') {
      pointFeatures.push(feature);
    } else if (feature?.geometry?.type === 'LineString') {
      fallbackLineFeatures.push(feature);
    } else {
      const props = { ...(feature?.properties || {}) };
      if (props.typhoon_name) {
        props.typhoon_name = formatTyphoonDisplayName(
          props.local_name || props.typhoon_name,
          props.international_name
        );
      }
      otherFeatures.push({
        ...feature,
        properties: props,
      });
    }
  }

  const stormPointsMap = new Map<string, any[]>();
  for (const pt of pointFeatures) {
    const stormKey = pt.properties?.local_name || pt.properties?.typhoon_name || 'default';
    if (!stormPointsMap.has(stormKey)) {
      stormPointsMap.set(stormKey, []);
    }
    stormPointsMap.get(stormKey)!.push(pt);
  }

  const enrichedPoints: any[] = [];
  const generatedLines: any[] = [];

  for (const [, pts] of stormPointsMap.entries()) {
    let currentIdx = -1;
    for (let i = 0; i < pts.length; i++) {
      const r = Number(pts[i].properties?.radius ?? 0);
      if (r === 0) {
        currentIdx = i;
      }
    }
    if (currentIdx === -1 && pts.length > 0) {
      currentIdx = 0;
    }

    let stormTitle = 'Active Cyclone';

    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const props = { ...(pt.properties || {}) };

      const isCurrent = i === currentIdx;
      const dateLabel = formatTrackDateLabel(props.date, props.time, props.datetime);
      const cleanName = formatTyphoonDisplayName(
        props.local_name || props.typhoon_name,
        props.international_name
      );
      stormTitle = cleanName;
      const cleanLocal = (props.local_name || '')
        .replace(/^bagyong\s+/i, '')
        .replace(/[{}]/g, '')
        .replace(/\s*\([^)]*\)/g, '')
        .trim();

      props.typhoon_name = cleanName;
      if (cleanLocal) props.local_name = cleanLocal;
      if (props.international_name) {
        props.international_name = props.international_name
          .replace(/^bagyong\s+/i, '')
          .replace(/[{}]/g, '')
          .trim();
      }

      props.date_label = dateLabel;
      props.is_current = isCurrent;
      props.current_label = isCurrent
        ? (dateLabel ? `Current: ${dateLabel}` : 'Current Position')
        : '';

      enrichedPoints.push({
        ...pt,
        properties: props,
      });
    }

    // Build colored, solid-past / dashed-forecast lines for this storm
    const coloredLines = buildColoredTrackLines(pts, currentIdx, stormTitle);
    generatedLines.push(...coloredLines);
  }

  const linesToInclude = generatedLines.length > 0 ? generatedLines : fallbackLineFeatures;

  return {
    ...track,
    features: [...otherFeatures, ...linesToInclude, ...enrichedPoints],
  };
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch
  );

/**
 * Formats a typhoon point for popup display
 */
export function buildTyphoonPopupHtml(props: TyphoonProperties): string {
  const name = formatTyphoonDisplayName(
    props.local_name || props.typhoon_name,
    props.international_name
  );

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
      <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100" style="padding-right: 36px;">
        <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-2xs shrink-0" style="background-color: ${typeConfig.color}">
          ${typeCode}
        </span>
        <div class="font-bold text-xs text-slate-900 truncate min-w-0 flex-1 leading-tight" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
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
