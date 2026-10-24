import { REPORT_STATUS_LABELS } from '@/constants/publicMap';
import { formatDateTime, getReportScoreDisplay, STATUS_META, timeAgo } from '@/lib/reports/reportFormatting';
import type { DepthCategory, MapReportFeature, ReportStatus } from '@/types/report';

// A simple white water-wave glyph — two short strokes read as "flood" at a
// glance and stay legible on a small, flat status disc.
const drawWave = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number) => {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  [-2.5, 2.5].forEach((dy) => {
    const y = cy + dy;
    ctx.beginPath();
    ctx.moveTo(cx - w, y);
    ctx.bezierCurveTo(cx - w * 0.5, y - 2.5, cx - w * 0.15, y - 2.5, cx, y);
    ctx.bezierCurveTo(cx + w * 0.15, y + 2.5, cx + w * 0.5, y + 2.5, cx + w, y);
    ctx.stroke();
  });
};

export const createReportMarkerImage = (color: string): ImageData | null => {
  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Soft drop shadow grounds the marker.
  context.save();
  context.shadowColor = 'rgba(15, 23, 42, 0.35)';
  context.shadowBlur = 5;
  context.shadowOffsetY = 2;
  context.beginPath();
  context.arc(cx, cy, r, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.restore();

  // Flat status disc with a crisp white ring.
  context.beginPath();
  context.arc(cx, cy, r, 0, Math.PI * 2);
  context.lineWidth = 2.5;
  context.strokeStyle = '#ffffff';
  context.stroke();

  // White wave glyph.
  drawWave(context, cx, cy, 6);

  return context.getImageData(0, 0, size, size);
};

export const formatDepth = (depth: DepthCategory, depthCm?: number | null) => {
  const cm = depthCm ?? depth.approximateCm;
  if (depth.code === 'overhead') {
    return cm != null ? `${depth.label} (${cm}+ cm)` : `${depth.label} (200+ cm)`;
  }
  return cm != null ? `${depth.label} (${cm} cm)` : depth.label;
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch
  );

export interface SubmittedReportProps {
  id: string;
  location: { lat: number; lng: number; address: string };
  depth: DepthCategory;
  status: ReportStatus;
  submittedAt: string;
}

export const buildReportsGeoJson = (
  backendReports: MapReportFeature[],
  visibleStatuses: Record<ReportStatus, boolean>
) => {
  const seen = new Set<string>();
  const features: Array<Record<string, any>> = [];

  const pushReport = (
    id: string | undefined,
    status: ReportStatus,
    feature: Record<string, any>
  ) => {
    if (!id || seen.has(id)) return;
    if (!visibleStatuses[status]) return;
    seen.add(id);
    features.push(feature);
  };

  backendReports.forEach((feature) => {
    const props = feature.properties;
    const scoreDisplay = getReportScoreDisplay(props);
    const depthLabel = formatDepth(props.depth, (props as unknown as { depthCm?: number | null }).depthCm);
    pushReport(props.id, props.status, {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        id: props.id,
        kind: 'report',
        status: props.status,
        address: props.address,
        depthLabel,
        statusLabel: REPORT_STATUS_LABELS[props.status] || props.status,
        validationScore: scoreDisplay.score,
        validationScoreLabel: scoreDisplay.label,
        decisionSource: props.decisionSource,
        verificationScope: props.validationSummary?.verificationScope,
        demoAutoValidated: props.validationSummary?.demoAutoValidated,
        createdAt: props.createdAt,
      },
    });
  });

  return {
    type: 'FeatureCollection',
    features,
  };
};

export const buildSelectedGeoJson = (selectedLocation: { lat: number; lng: number } | null) => {
  if (!selectedLocation) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [selectedLocation.lng, selectedLocation.lat],
        },
        properties: { kind: 'selected' },
      },
    ],
  };
};

export const buildReportPopupHtml = (feature: Record<string, any>): string => {
  const props = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates ?? [0, 0];
  const [lng, lat] = coordinates;
  if (props.kind === 'selected') {
    return `<div class="report-pin-card"><p class="report-pin-heading">Selected location</p>
      <p class="report-pin-location">${escapeHtml(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)}</p></div>`;
  }
  const display = reportPopupDisplay(props);
  return `<article class="report-pin-card" aria-label="Flood report">
    <header class="report-pin-header"><span class="report-pin-heading">Flood report</span>
      ${display.status ? `<span class="report-pin-status" data-status="${display.statusCode}">${escapeHtml(display.status)}</span>` : ''}</header>
    ${props.depthLabel ? `<p class="report-pin-label">Reported depth</p><p class="report-pin-depth">${escapeHtml(String(props.depthLabel))}</p>` : ''}
    ${props.address ? `<p class="report-pin-location" title="${escapeHtml(String(props.address))}">${escapeHtml(String(props.address))}</p>` : ''}
    ${display.age ? `<p class="report-pin-time" title="${escapeHtml(display.fullTime)}">Reported ${escapeHtml(display.age)}</p>` : ''}
  </article>`;
};

function reportPopupDisplay(props: Record<string, any>) {
  const statusCode = Object.prototype.hasOwnProperty.call(STATUS_META, props.status) ? props.status as ReportStatus : undefined;
  const hasDate = typeof props.createdAt === 'string' && Number.isFinite(Date.parse(props.createdAt));
  return {
    statusCode: statusCode ?? 'UNVERIFIED',
    status: statusCode ? STATUS_META[statusCode].label : String(props.statusLabel ?? ''),
    age: hasDate ? timeAgo(props.createdAt) : String(props.createdAt ?? ''),
    fullTime: hasDate ? formatDateTime(props.createdAt) : String(props.createdAt ?? ''),
  };
}

/** Desktop hover shows only the essentials; location details stay in the click card. */
export const buildReportHoverHtml = (feature: Record<string, any>): string => {
  const props = feature.properties ?? {};
  const display = reportPopupDisplay(props);
  return `<div class="report-pin-preview" role="tooltip">
    <p class="report-pin-preview-depth">${escapeHtml(String(props.depthLabel ?? 'Flood report'))}</p>
    <p class="report-pin-preview-meta">${display.status ? `<span class="report-pin-status" data-status="${display.statusCode}">${escapeHtml(display.status)}</span>` : ''}
      ${display.age ? `<span>${escapeHtml(display.age)}</span>` : ''}</p>
  </div>`;
};

export const buildReportClusterHoverHtml = (feature: Record<string, any>): string => {
  const value = Number(feature.properties?.point_count);
  const count = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  return `<div class="report-pin-preview" role="tooltip">
    <p class="report-pin-preview-depth">${count.toLocaleString()} ${count === 1 ? 'report' : 'reports'}</p>
    <p class="report-pin-preview-meta">Click to expand</p>
  </div>`;
};
