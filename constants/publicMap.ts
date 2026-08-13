import { ILIGAN_BOUNDS } from '@/lib/geoUtils';
import type { ReportStatus } from '@/types/report';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export const HAS_MAPTILER = Boolean(MAPTILER_KEY);

// Default 2D basemap — OpenFreeMap needs no API key.
export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// Optional 3D-capable basemap (MapTiler). Only usable when a key is present.
export const MAPTILER_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : OPENFREEMAP_STYLE;

// Raster elevation source used to enable 3D terrain in the MapTiler view.
export const MAPTILER_TERRAIN_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
  : '';

export const ILIGAN_REPORT_BOUNDS = {
  west: ILIGAN_BOUNDS[0][0],
  south: ILIGAN_BOUNDS[0][1],
  east: ILIGAN_BOUNDS[1][0],
  north: ILIGAN_BOUNDS[1][1],
  limit: 500,
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  UNVERIFIED: 'Pending validation',
  VERIFIED: 'Verified',
  ANOMALY: 'Flagged for review',
  REJECTED: 'Rejected',
};

export const REPORT_MARKER_COLORS: Record<ReportStatus, string> = {
  UNVERIFIED: '#F59E0B',
  VERIFIED: '#2563EB',
  ANOMALY: '#DC2626',
  REJECTED: '#64748B',
};

export const REPORT_MARKER_IMAGE_IDS: Record<ReportStatus, string> = {
  UNVERIFIED: 'report-marker-pending',
  VERIFIED: 'report-marker-verified',
  ANOMALY: 'report-marker-flagged',
  REJECTED: 'report-marker-rejected',
};

export const REPORT_STATUS_LEGEND: Array<{
  status: ReportStatus;
  label: string;
}> = [
  { status: 'UNVERIFIED', label: 'Pending' },
  { status: 'VERIFIED', label: 'Verified' },
  { status: 'ANOMALY', label: 'Flagged' },
  { status: 'REJECTED', label: 'Rejected' },
];
