import {
  ASSET_INK_BOUNDS,
  FLOOD_REFERENCE_HEIGHTS_CM,
  SCENE_CM,
  depthCriticality,
  referenceAssetSrc,
  type FloodReference,
} from '@/lib/reports/depthReferences';

/** Tints the black silhouettes toward the slate tone used across the app. */
const SILHOUETTE_FILTER =
  'invert(58%) sepia(9%) saturate(759%) hue-rotate(175deg) brightness(96%) contrast(86%)';

/**
 * Flood-depth illustration rendered from the public silhouette assets. Each
 * asset is scaled so its measured ink height equals the reference's average
 * real-world height (Philippines) on a shared centimeter scale, anchored to a
 * common ground line. The water overlay rises by `depthCm` on that same
 * scale; the depth strips beside it act as the sole input surface.
 */
export function FloodReferenceIllustration({
  reference,
  depthCm,
  label,
  className = '',
}: {
  reference: FloodReference;
  depthCm: number;
  label: string;
  className?: string;
}) {
  const bounds = ASSET_INK_BOUNDS[reference];
  const heightCm = FLOOD_REFERENCE_HEIGHTS_CM[reference];
  const imageHeightPct = (heightCm / SCENE_CM) * 100;
  const groundGapPct = ((bounds.viewBoxHeight - bounds.inkBottom) / bounds.viewBoxHeight) * imageHeightPct;
  const waterPct = Math.min(Math.max(depthCm / SCENE_CM, 0), 1) * 100;
  /** Water turns red only once the reading enters head-deep territory. */
  const isCritical = depthCriticality(depthCm) === 'critical';

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-sky-50/60 ${className}`}
      role="img"
      aria-label={`${label} flood-depth reference${depthCm > 0 ? ` at about ${Math.round(depthCm)} centimeters` : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- needs percent-height anchoring and CSS filter tinting that next/image cannot express for local SVGs */}
      <img
        src={referenceAssetSrc(reference)}
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute left-1/2 max-w-full -translate-x-1/2 select-none"
        style={{
          height: `${imageHeightPct}%`,
          bottom: `${groundGapPct}%`,
          filter: SILHOUETTE_FILTER,
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 will-change-[height]"
        style={{ height: `${waterPct}%` }}
      >
        {/* Solid waterline edge for precise depth reading */}
        <div
          className={`absolute inset-x-0 top-0 h-[2px] ${isCritical ? 'bg-rose-500' : 'bg-sky-500'}`}
        />

        {/* Translucent water fill */}
        <div
          className={`absolute inset-0 ${isCritical ? 'bg-rose-500/30' : 'bg-sky-400/35'}`}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-sky-200" />
    </div>
  );
}
