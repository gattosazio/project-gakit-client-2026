import type { FloodDepthCode, MapReportFeature } from '@/types/report';
import { DEPTH_BAR_COLOR } from '@/lib/reports/reportFormatting';
import { findBarangayEntry, type GeoJsonCollection } from '@/lib/map/geoUtils';

export const DEPTH_RANK: Record<FloodDepthCode, number> = {
  ankle: 0,
  knee: 1,
  waist: 2,
  shoulder: 3,
  head: 4,
  overhead: 5,
};

const CRITICAL_DEPTHS: ReadonlySet<FloodDepthCode> = new Set(['head', 'overhead']);

/** Per-barangay flood posture within the currently visible report set. */
export interface BarangayStats {
  psgc: string;
  name: string;
  total: number;
  verified: number;
  unverified: number;
  flagged: number;
  depthCounts: Partial<Record<FloodDepthCode, number>>;
  worstDepth: FloodDepthCode | null;
  newestAt: string | null;
}

export type BarangayBannerKind = 'none' | 'pending' | 'flooded' | 'critical';

export const BARANGAY_BANNER_COPY: Record<BarangayBannerKind, string> = {
  none: 'No flooding reports',
  pending: 'Pending reports need review',
  flooded: 'Flooding reported',
  critical: 'Head-deep or worse',
};

/**
 * Client-side spatial join of every visible report coordinate into its
 * barangay polygon. REJECTED reports are excluded entirely — a rejected
 * submission should not tint a barangay or mark flooding.
 */
export function aggregateBarangayStats(
  reports: MapReportFeature[],
  geojson: GeoJsonCollection | null
): Map<string, BarangayStats> {
  const stats = new Map<string, BarangayStats>();
  if (!geojson?.features) return stats;

  const upsert = (psgc: string, name: string): BarangayStats => {
    let entry = stats.get(psgc);
    if (!entry) {
      entry = {
        psgc,
        name,
        total: 0,
        verified: 0,
        unverified: 0,
        flagged: 0,
        depthCounts: {},
        worstDepth: null,
        newestAt: null,
      };
      stats.set(psgc, entry);
    }
    return entry;
  };

  for (const feature of reports) {
    if (!feature?.properties || feature.properties.status === 'REJECTED') continue;
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;

    const entry = findBarangayEntry(coords[0], coords[1], geojson);
    if (!entry) continue;

    const s = upsert(String(entry.id), entry.name);
    const status = feature.properties.status;
    s.total += 1;
    if (status === 'VERIFIED') s.verified += 1;
    else if (status === 'ANOMALY') s.flagged += 1;
    else if (status === 'UNVERIFIED') s.unverified += 1;

    const code = feature.properties.depth?.code;
    if (code) {
      s.depthCounts[code] = (s.depthCounts[code] ?? 0) + 1;
      if (!s.worstDepth || DEPTH_RANK[code] > DEPTH_RANK[s.worstDepth]) {
        s.worstDepth = code;
      }
    }

    const createdAt = feature.properties.createdAt;
    if (
      createdAt &&
      (!s.newestAt || new Date(createdAt).getTime() > new Date(s.newestAt).getTime())
    ) {
      s.newestAt = createdAt;
    }
  }

  return stats;
}

/** Decision-first banner for a hovered barangay card. */
export function barangayBanner(stats: BarangayStats | null | undefined): BarangayBannerKind {
  if (!stats || stats.total === 0) return 'none';
  if (stats.worstDepth && CRITICAL_DEPTHS.has(stats.worstDepth)) return 'critical';
  if (stats.unverified > 0) return 'pending';
  return 'flooded';
}

const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Choropleth color for a barangay polygon. Flooded barangays tint with the
 * shared depth color scale (kept translucent so the basemap stays readable);
 * barangays with no reports in the window get a neutral slate so the whole
 * boundary overlay still reads as areas, not just lines.
 */
export function severityFill(stats: BarangayStats | null | undefined): string {
  if (!stats || stats.total === 0 || !stats.worstDepth) {
    return 'rgba(100, 116, 139, 0.10)';
  }
  return hexToRgba(DEPTH_BAR_COLOR[stats.worstDepth], 0.16);
}

/** Rebuilds the choropleth source payload from the base polygons + stats. */
export function buildBarangaySeverityGeoJson(
  geojson: GeoJsonCollection,
  statsByPsgc: Map<string, BarangayStats>
): GeoJsonCollection {
  const features: GeoJsonCollection['features'] = geojson.features
    .filter((feature) => feature.properties?.adm4_psgc != null)
    .map((feature) => ({
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        ...(feature.properties ?? {}),
        fill: severityFill(statsByPsgc.get(String(feature.properties?.adm4_psgc))),
      },
    }));
  return { type: 'FeatureCollection', features };
}