import { REPORT_STATUS_LABELS } from '@/constants/publicMap';
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
  const exact = depthCm != null ? `~${depthCm} cm` : null;
  if (depth.code === 'overhead') {
    return exact ? `${depth.label} (${exact} or deeper)` : `${depth.label} (~${depth.approximateCm} cm or deeper)`;
  }
  return exact ? `${depth.label} (${exact})` : `${depth.label} (~${depth.approximateCm} cm)`;
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
        createdAt: new Date(props.createdAt).toLocaleString(),
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
  const tooltipStyle = 'font-family: var(--font-inter), system-ui, sans-serif;';
  const row = (label: string, value: string) => `
    <div style="display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 1.5;">
      <span style="color: #64748b;">${escapeHtml(label)}</span>
      <span style="color: #0f172a; font-weight: 600;">${escapeHtml(value)}</span>
    </div>`;

  if (props.kind === 'selected') {
    return `
      <div class="gakit-tooltip" style="${tooltipStyle}">
        <div style="font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px;">
          Selected location
        </div>
        ${row('Coordinates', `${lat.toFixed(4)}, ${lng.toFixed(4)}`)}
      </div>`;
  }

  return `
    <div class="gakit-tooltip" style="${tooltipStyle}">
      ${props.address
        ? `<div style="font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px;">
             ${escapeHtml(props.address)}
           </div>`
        : ''}
      ${props.depthLabel ? row('Depth', props.depthLabel) : ''}
      ${props.statusLabel ? row('Status', props.statusLabel) : ''}
      ${props.elevation != null ? row('Elevation', `${Number(props.elevation).toFixed(1)} m`) : ''}
      ${props.createdAt ? row('Reported', props.createdAt) : ''}
    </div>`;
};
