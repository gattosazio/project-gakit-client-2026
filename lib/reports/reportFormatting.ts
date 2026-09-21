import type { FloodDepthCode, FloodReference, ReportStatus } from '@/types/report';

export const DEPTH_LABELS: Record<FloodDepthCode, string> = {
  ankle: 'Ankle Deep',
  knee: 'Knee Deep',
  waist: 'Waist Deep',
  shoulder: 'Shoulder Deep',
  head: 'Head Deep',
  overhead: 'Overhead',
};

/**
 * Water-level color scale shared by the dashboard, report cards, and any
 * depth-related surface. Waist-up leans warm; head-plus is red/maroon.
 */
export const DEPTH_BAR_COLOR: Record<FloodDepthCode, string> = {
  ankle: '#10B981',
  knee: '#84CC16',
  waist: '#F5B301',
  shoulder: '#F97316',
  head: '#EF4444',
  overhead: '#7A0019',
};

export const REFERENCE_LABELS: Record<FloodReference, string> = {
  adult: 'Adult',
  motorcycle: 'Motorcycle',
  sedan: 'Sedan',
  suv: 'SUV',
  jeepney: 'Jeepney',
  bus: 'Minibus',
};

export interface StatusMeta {
  label: string;
  badgeClass: string;
  color: string;
}

export const STATUS_META: Record<ReportStatus, StatusMeta> = {
  UNVERIFIED: {
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-hazard-pending border-amber-200',
    color: '#F59E0B',
  },
  VERIFIED: {
    label: 'Verified',
    badgeClass: 'bg-green-50 text-hazard-safe border-green-200',
    color: '#10B981',
  },
  ANOMALY: {
    label: 'Anomaly',
    badgeClass: 'bg-red-50 text-hazard-critical border-red-200',
    color: '#EF4444',
  },
  REJECTED: {
    label: 'Rejected',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    color: '#94A3B8',
  },
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Epoch-agnostic relative age label ("just now", "5m ago", "3h ago", "2d ago").
 * Shared by dashboards, report management, and the map's barangay annotations.
 */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < 60_000) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatReportDepth(
  depth: { code: FloodDepthCode; label?: string; approximateCm?: number } | FloodDepthCode,
  depthCm?: number | null
): string {
  const code = typeof depth === 'string' ? depth : depth.code;
  const label = DEPTH_LABELS[code] || code;
  const approx = typeof depth === 'object' ? depth.approximateCm : undefined;
  const cm = depthCm ?? approx;

  if (cm != null) {
    return code === 'overhead' ? `${label} (${cm}+ cm)` : `${label} (${cm} cm)`;
  }
  return label;
}

