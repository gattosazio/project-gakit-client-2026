import { REPORT_STATUS_LABELS } from '@/constants/publicMap';
import type { DepthCategory, MapReportFeature, ReportStatus } from '@/types/report';

export const createReportMarkerImage = (color: string): ImageData | null => {
  const canvas = document.createElement('canvas');
  canvas.width = 54;
  canvas.height = 66;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const drawPin = () => {
    context.beginPath();
    context.moveTo(27, 61.5);
    context.bezierCurveTo(23.25, 52.5, 7.5, 39, 7.5, 24.75);
    context.bezierCurveTo(7.5, 13.875, 16.125, 5.25, 27, 5.25);
    context.bezierCurveTo(37.875, 5.25, 46.5, 13.875, 46.5, 24.75);
    context.bezierCurveTo(46.5, 39, 30.75, 52.5, 27, 61.5);
    context.closePath();
  };

  context.save();
  context.shadowColor = 'rgba(15, 23, 42, 0.35)';
  context.shadowBlur = 6;
  context.shadowOffsetY = 3.75;
  drawPin();
  context.fillStyle = color;
  context.fill();
  context.restore();

  drawPin();
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 3;
  context.lineJoin = 'round';
  context.stroke();

  context.beginPath();
  context.arc(27, 24, 11.25, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();

  context.strokeStyle = color;
  context.lineWidth = 2.625;
  context.lineCap = 'round';
  [21, 26.25].forEach((y) => {
    context.beginPath();
    context.moveTo(18, y);
    context.bezierCurveTo(21, y - 2.25, 24, y + 2.25, 27, y);
    context.bezierCurveTo(30, y - 2.25, 33, y + 2.25, 36, y);
    context.stroke();
  });

  return context.getImageData(0, 0, canvas.width, canvas.height);
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
        address: props.address || 'Flood report',
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
      <div style="font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px;">
        ${escapeHtml(props.address || 'Flood report')}
      </div>
      ${props.depthLabel ? row('Depth', props.depthLabel) : ''}
      ${props.statusLabel ? row('Status', props.statusLabel) : ''}
      ${props.elevation != null ? row('Elevation', `${Number(props.elevation).toFixed(1)} m`) : ''}
      ${props.createdAt ? row('Reported', props.createdAt) : ''}
    </div>`;
};
