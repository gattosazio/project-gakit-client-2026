'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { REPORT_MARKER_COLORS, satelliteTileUrl } from '@/constants/publicMap';
import type { ReportStatus } from '@/types/report';

interface ReportMiniMapProps {
  latitude: number;
  longitude: number;
  status: ReportStatus;
  onViewOnMap?: () => void;
}

const ZOOM = 15;
const TILE_PX = 256;

// Strip around the report's own tile. Five columns keep the strip wider than
// the box no matter where inside its tile the report falls; three rows always
// cover it vertically (the box is far shorter than a tile).
const COL_OFFSETS = [-2, -1, 0, 1, 2];
const ROW_OFFSETS = [-1, 0, 1];

export interface ThumbnailTile {
  x: number;
  y: number;
  url: string;
  isCenter: boolean;
}

export interface ReportThumbnail {
  rows: ThumbnailTile[][];
  centerUrl: string;
  // translate() that lands the report point exactly on the box center.
  offsetX: number;
  offsetY: number;
}

// The report thumbnail is the live map's own satellite tiles, laid out so the
// report sits at the center: same imagery as reports management, but
// pre-rendered and CDN-cached instead of server-rendered per report.
export const thumbnailTiles = (latitude: number, longitude: number): ReportThumbnail => {
  const n = 2 ** ZOOM;
  const fx = ((longitude + 180) / 360) * n;
  const latRad = (latitude * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  const px = Math.round((fx - tx) * TILE_PX);
  const py = Math.round((fy - ty) * TILE_PX);

  const rows: ThumbnailTile[][] = ROW_OFFSETS.map((dy) => {
    // Latitude never wraps, so clamp rows into range.
    const y = Math.min(Math.max(ty + dy, 0), n - 1);
    return COL_OFFSETS.map((dx) => {
      // Longitude wraps around the antimeridian.
      const x = (((tx + dx) % n) + n) % n;
      return {
        x,
        y,
        url: satelliteTileUrl(ZOOM, x, y),
        isCenter: dx === 0 && dy === 0,
      };
    });
  });

  // The report sits at (2 tiles + px, 1 tile + py) inside the strip.
  return {
    rows,
    centerUrl: satelliteTileUrl(ZOOM, tx, ty),
    offsetX: -(2 * TILE_PX + px),
    offsetY: -(TILE_PX + py),
  };
};

/**
 * Non-interactive satellite thumbnail of a single report location, shown in
 * the report detail modal. Clicking it jumps to the full incident map.
 */
export function ReportMiniMap({ latitude, longitude, status, onViewOnMap }: ReportMiniMapProps) {
  const { rows, centerUrl, offsetX, offsetY } = thumbnailTiles(latitude, longitude);
  // Tracks WHICH tile failed rather than a bare flag, so one outcome can't
  // poison later locations in a reused instance — derived, no effect. Only
  // the center tile (the one under the pin) can fail the whole thumbnail;
  // a missing edge tile just leaves shimmer showing through its gap.
  const [failedTiles, setFailedTiles] = useState<readonly string[]>([]);
  const failed = failedTiles.includes(centerUrl);

  return (
    <button
      type="button"
      onClick={onViewOnMap}
      title="Open on the incident map"
      aria-label="Open this location on the incident map"
      className="absolute inset-0 cursor-pointer overflow-hidden rounded-xl border border-canvas-grey"
    >
      {failed ? (
        <span className="flex h-full w-full items-center justify-center bg-canvas-light text-xs font-medium text-slate-500">
          Map unavailable
        </span>
      ) : (
        <>
          {/* The skeleton sits underneath and tiles pop in over it as the
              CDN answers, so a slow fetch reads as loading, never blank. */}
          <Skeleton className="absolute inset-0" />
          {/* Plain <img>: these are already optimally-encoded CDN tiles, so
              routing them through the Next image optimizer would only add a
              server hop per tile. */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
          >
            {rows.map((row, index) => (
              <div key={index} className="flex">
                {row.map((tile) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${tile.x}-${tile.y}-${index}`}
                    src={tile.url}
                    alt=""
                    draggable={false}
                    decoding="async"
                    onError={
                      tile.isCenter
                        ? () =>
                            setFailedTiles((previous) =>
                              previous.includes(tile.url) ? previous : [...previous, tile.url]
                            )
                        : undefined
                    }
                    className="block h-64 w-64 shrink-0"
                  />
                ))}
              </div>
            ))}
          </div>
          {/* The strip is translated so the report lands dead center. */}
          {/* Status disc matching the incident map's pins (see
              createReportMarkerImage): flat status color, white ring, white
              wave glyph. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 drop-shadow-md"
          >
            <svg viewBox="0 0 40 40" className="h-full w-full">
              <circle cx="20" cy="20" r="16" fill={REPORT_MARKER_COLORS[status]} />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <path
                d="M14 17.5 C17 15 19.1 15 20 17.5 C20.9 20 23 20 26 17.5"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M14 22.5 C17 20 19.1 20 20 22.5 C20.9 25 23 25 26 22.5"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-white/70 px-1 text-[9px] font-medium text-slate-600">
            Imagery © Esri, Maxar, Earthstar
          </span>
        </>
      )}
    </button>
  );
}
