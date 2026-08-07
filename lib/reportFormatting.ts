import type { FloodDepthCode, ReportStatus } from '@/types/report';

export const DEPTH_LABELS: Record<FloodDepthCode, string> = {
  ankle: 'Ankle Deep',
  knee: 'Knee Deep',
  waist: 'Waist Deep',
  head: 'Head Deep',
  overhead: 'Overhead',
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
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    color: '#64748B',
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
