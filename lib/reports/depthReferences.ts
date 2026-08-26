import type { FloodDepthCode } from '@/types/report';

export type FloodReference = 'adult' | 'motorcycle' | 'sedan' | 'suv' | 'jeepney' | 'bus';

/**
 * Vertical span of the illustration scene, in centimeters. Every reference and
 * the depth scale share this mapping so a centimeter lands on the same spot
 * whether it is read from the waterline or the strip. `MAX_DEPTH_CM` of
 * selectable headroom sits inside the scene, plus a small visual margin.
 */
export const SCENE_CM = 260;
export const MAX_DEPTH_CM = 250;

export interface FloodReferenceMeta {
  id: FloodReference;
  label: string;
  description: string;
}

export const FLOOD_REFERENCE_META: FloodReferenceMeta[] = [
  {
    id: 'adult',
    label: 'Adult person',
    description: 'Use a standing adult as the reference.',
  },
  {
    id: 'motorcycle',
    label: 'Motorcycle',
    description: 'Compare the flood against a typical motorcycle.',
  },
  {
    id: 'sedan',
    label: 'Sedan',
    description: 'Compare the flood against a typical sedan.',
  },
  {
    id: 'suv',
    label: 'SUV',
    description: 'Compare the flood against a typical SUV.',
  },
  {
    id: 'jeepney',
    label: 'Jeepney',
    description: 'Compare the flood against a typical jeepney.',
  },
  {
    id: 'bus',
    label: 'Minibus',
    description: 'Compare the flood against an e-minibus.',
  },
];

/**
 * Average real-world heights (Philippines) used to scale each silhouette:
 * adult 159 cm (matches the seeded head-level category), motorcycle from
 * Honda BeAT/TMX specs (~1070 mm), sedan from Toyota Vios (1475 mm), SUV from
 * Fortuner/Montero/Innova (~1800 mm), jeepney ~1950 mm roofline, minibus from
 * GET COMET e-bus (2350 mm).
 */
export const FLOOD_REFERENCE_HEIGHTS_CM: Record<FloodReference, number> = {
  adult: 159,
  motorcycle: 110,
  sedan: 148,
  suv: 180,
  jeepney: 195,
  bus: 235,
};

/**
 * Visible ink bounds measured per asset (viewBox units; canvas is uniformly
 * 555.75 units tall with the ground at the bottom edge). Used to anchor each
 * silhouette's feet exactly on the ground line.
 */
export const ASSET_INK_BOUNDS: Record<
  FloodReference,
  { viewBoxWidth: number; viewBoxHeight: number; inkTop: number; inkBottom: number }
> = {
  adult: { viewBoxWidth: 234, viewBoxHeight: 555.75, inkTop: 1.1, inkBottom: 554.2 },
  motorcycle: { viewBoxWidth: 910.5, viewBoxHeight: 555.75, inkTop: 0, inkBottom: 554.5 },
  sedan: { viewBoxWidth: 1709.25, viewBoxHeight: 555.75, inkTop: 1.7, inkBottom: 553.8 },
  suv: { viewBoxWidth: 1221, viewBoxHeight: 555.75, inkTop: 1.2, inkBottom: 553.1 },
  jeepney: { viewBoxWidth: 1110.75, viewBoxHeight: 555.75, inkTop: 0, inkBottom: 554.3 },
  bus: { viewBoxWidth: 974.88, viewBoxHeight: 555.75, inkTop: 0, inkBottom: 554.7 },
};

/** Public URL for each reference silhouette. */
const ASSET_FILENAMES: Record<FloodReference, string> = {
  adult: 'person.png',
  motorcycle: 'motorcycle.svg',
  sedan: 'sedan.svg',
  suv: 'suv.svg',
  jeepney: 'jeepney.svg',
  bus: 'minibus.svg',
};

export function referenceAssetSrc(reference: FloodReference): string {
  return `/assets/${ASSET_FILENAMES[reference]}`;
}

/**
 * Category anchors measured on an average Filipino adult (159 cm stature):
 * ankle bone ~10 cm, mid-patella ~45 cm, navel ~95 cm, acromion (shoulder)
 * ~131 cm, crown 159 cm, and clearly-above-head ~190 cm for overhead.
 * depthCodeFromCm assigns each reading to the nearest anchor, so the
 * midpoints between anchors act as the category boundaries.
 */
const CATEGORY_ANCHORS_CM: Array<{ code: FloodDepthCode; cm: number }> = [
  { code: 'ankle', cm: 10 },
  { code: 'knee', cm: 45 },
  { code: 'waist', cm: 95 },
  { code: 'shoulder', cm: 131 },
  { code: 'head', cm: 159 },
  { code: 'overhead', cm: 190 },
];

const FALLBACK_CATEGORY_LABELS: Record<FloodDepthCode, string> = {
  ankle: 'Ankle-deep',
  knee: 'Knee-deep',
  waist: 'Waist-deep',
  shoulder: 'Shoulder-deep',
  head: 'Head-deep',
  overhead: 'Overhead',
};

/**
 * Maps a continuous centimeter reading onto the closest existing depth
 * category so reports keep satisfying the current API contract while the
 * database still stores categories only.
 */
export function depthCodeFromCm(cm: number): FloodDepthCode {
  let best = CATEGORY_ANCHORS_CM[0];
  for (const anchor of CATEGORY_ANCHORS_CM) {
    if (Math.abs(anchor.cm - cm) < Math.abs(best.cm - cm)) best = anchor;
  }
  return best.code;
}

export function fallbackCategoryLabel(code: FloodDepthCode): string {
  return FALLBACK_CATEGORY_LABELS[code];
}

/**
 * Quick-pick depth presets shown under the illustration (ankle through head;
 * deeper readings go through the exact-centimeter input). Each preset selects
 * its category's anchor depth.
 */
export const DEPTH_PRESETS: Array<{ code: FloodDepthCode; cm: number; shortLabel: string }> = [
  { code: 'ankle', cm: 10, shortLabel: 'Ankle' },
  { code: 'knee', cm: 45, shortLabel: 'Knee' },
  { code: 'waist', cm: 95, shortLabel: 'Waist' },
  { code: 'shoulder', cm: 131, shortLabel: 'Shoulder' },
  { code: 'head', cm: 159, shortLabel: 'Head' },
];

export type DepthCriticality = 'low' | 'medium' | 'critical';

/**
 * Criticality bands for the depth scale, sharing the depthCodeFromCm
 * breakpoints so a strip's color always agrees with the category a reading
 * submits: low = ankle range, medium = knee/waist/shoulder, critical = head
 * and above (the server's "critical reports" definition counts only
 * head/overhead). Each band ramps from a light tint to its saturated hazard
 * color at the band's upper edge.
 */
const CRITICALITY_BANDS: Array<{
  upToCm: number;
  label: DepthCriticality;
  from: [number, number, number];
  to: [number, number, number];
}> = [
  { upToCm: 27.5, label: 'low', from: [209, 250, 229], to: [16, 185, 129] },
  { upToCm: 145, label: 'medium', from: [254, 243, 199], to: [245, 158, 11] },
  { upToCm: MAX_DEPTH_CM, label: 'critical', from: [254, 202, 202], to: [239, 68, 68] },
];

export function depthCriticality(cm: number): DepthCriticality {
  for (const band of CRITICALITY_BANDS) {
    if (cm <= band.upToCm) return band.label;
  }
  return 'critical';
}

/** RGB for a depth-scale strip whose top edge sits at `cm`. */
export function criticalityStripRgb(cm: number): [number, number, number] {
  let bandStartCm = 0;
  for (const band of CRITICALITY_BANDS) {
    if (cm <= band.upToCm) {
      const t =
        band.upToCm === bandStartCm
          ? 1
          : Math.min(Math.max((cm - bandStartCm) / (band.upToCm - bandStartCm), 0), 1);
      return band.from.map((channel, i) =>
        Math.round(channel + (band.to[i] - channel) * t)
      ) as [number, number, number];
    }
    bandStartCm = band.upToCm;
  }
  return [239, 68, 68];
}
