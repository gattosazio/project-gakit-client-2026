import { decisionStatus } from '@/lib/reports/decisionReasons';
import { REPORT_STATUS_LABELS } from '@/constants/publicMap';
import { DEPTH_BAR_COLOR, DEPTH_LABELS, formatDateTime, getReportAssessmentBasis, STATUS_META, timeAgo } from '@/lib/reports/reportFormatting';
import type { DepthCategory, MapReportFeature, ReportStatus } from '@/types/report';

export const createReportMarkerImage = (color: string): ImageData | null => {
  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 5.5;

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
  context.lineWidth = 9;
  context.strokeStyle = '#ffffff';
  context.stroke();

  return context.getImageData(0, 0, size, size);
};

/** Static callout with a fixed stem and a depth-colored accent. */
export function createReportBubbleImage(depthColor = '#64748b'): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = 240; canvas.height = 76;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // The stem is part of the label image so it shares label collision behavior.
  ctx.beginPath(); ctx.roundRect(1, 1, 238, 46, 12);
  // Fill one connected silhouette; the stem enters the rounded corner.
  // 19 image pixels = 9.5 CSS pixels, matching the pin's outer diameter.
  ctx.rect(1, 36, 19, 40);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'; ctx.fill();
  ctx.beginPath(); ctx.roundRect(5, 8, 4, 32, 2);
  ctx.fillStyle = depthColor; ctx.fill();
  return ctx.getImageData(0, 0, 240, 76);
}

export function reportMapLabels(props: MapReportFeature['properties'], now = Date.now()) {
  const quality = props.validationSummary?.depthQuality;
  const method = props.validationSummary?.observation?.depthMethod;
  const cm = props.depthCm;
  const hasNumber = quality !== 'category' && method !== 'category' && typeof cm === 'number' && Number.isFinite(cm) && cm >= 0;
  const measured = method === 'measured' || quality === 'measured' || quality === 'exact';
  const category = DEPTH_LABELS[props.depth.code] ?? props.depth.label;
  const bubbleDepth = hasNumber ? `${measured ? '' : '≈'}${cm}${props.depth.code === 'overhead' ? '+' : ''} cm` : category;
  const observed = typeof props.observedAt === 'string' && Number.isFinite(Date.parse(props.observedAt));
  const submitted = typeof props.createdAt === 'string' && Number.isFinite(Date.parse(props.createdAt));
  const timestamp = observed ? props.observedAt : submitted ? props.createdAt : null;
  return {
    depthLabel: hasNumber ? `${category} (${bubbleDepth})` : category,
    bubbleDepth,
    depthColor: DEPTH_BAR_COLOR[props.depth.code] ?? '#475569',
    depthBadge: hasNumber ? `${cm}${props.depth.code === 'overhead' ? '+' : ''} cm` : category.replace(/ Deep$/, ''),
    depthBadgeImage: `report-depth-badge-${props.depth.code}`,
    bubbleAge: timestamp ? `${observed ? '' : 'sent '}${timeAgo(timestamp, now)}` : '',
    labelPriority: timestamp ? Math.max(0, (now - Date.parse(timestamp)) / 60_000) : 1e8,
  };
}

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
    const scoreDisplay = getReportAssessmentBasis(props);
    const labels = reportMapLabels(props);
    pushReport(props.id, decisionStatus(props.status), {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        id: props.id,
        kind: 'report',
        status: decisionStatus(props.status),
        address: props.address,
        ...labels,
        statusLabel: REPORT_STATUS_LABELS[props.status] || props.status,
        validationScore: scoreDisplay.score,
        validationScoreLabel: scoreDisplay.label,
        decisionSource: props.decisionSource,
        verificationScope: props.validationSummary?.verificationScope,
        demoAutoValidated: props.validationSummary?.demoAutoValidated,
        createdAt: props.createdAt,
        observedAt: props.observedAt,
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
    ${display.age ? `<p class="report-pin-time" title="${escapeHtml(display.fullTime)}">${display.timeLabel} ${escapeHtml(display.age)}</p>` : ''}
    ${display.observed && display.submittedTime ? `<p class="report-pin-submitted" style="margin-top:4px;font-size:10px;color:#64748b">Submitted ${escapeHtml(display.submittedTime)}</p>` : ''}
  </article>`;
};

function reportPopupDisplay(props: Record<string, any>) {
  const statusCode = Object.prototype.hasOwnProperty.call(STATUS_META, props.status) ? props.status as ReportStatus : undefined;
  const hasDate = typeof props.createdAt === 'string' && Number.isFinite(Date.parse(props.createdAt));
  const observed = typeof props.observedAt === 'string' && Number.isFinite(Date.parse(props.observedAt));
  const timestamp = observed ? props.observedAt : props.createdAt;
  return {
    statusCode: statusCode ?? 'UNVERIFIED',
    status: statusCode ? STATUS_META[statusCode].label : String(props.statusLabel ?? ''),
    age: observed || hasDate ? timeAgo(timestamp) : String(props.createdAt ?? ''),
    fullTime: observed || hasDate ? formatDateTime(timestamp) : String(props.createdAt ?? ''),
    timeLabel: observed ? 'Observed' : 'Submitted',
    observed,
    submittedTime: hasDate ? formatDateTime(props.createdAt) : '',
  };
}

/** Desktop hover shows only the essentials; location details stay in the click card. */
export const buildReportHoverHtml = (feature: Record<string, any>): string => {
  const props = feature.properties ?? {};
  const display = reportPopupDisplay(props);
  return `<div class="report-pin-preview" role="tooltip">
    <p class="report-pin-preview-depth">${escapeHtml(String(props.depthLabel ?? 'Flood report'))}</p>
    <p class="report-pin-preview-meta">${display.status ? `<span class="report-pin-status" data-status="${display.statusCode}">${escapeHtml(display.status)}</span>` : ''}
      ${display.age ? `<span title="${display.timeLabel} ${escapeHtml(display.fullTime)}">${display.timeLabel} ${escapeHtml(display.age)}</span>` : ''}</p>
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
