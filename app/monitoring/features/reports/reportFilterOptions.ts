import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { FloodDepthCode, ReportStatus } from '@/types/report';

export const depthOptions: Array<'All' | FloodDepthCode> = ['All', 'ankle', 'knee', 'waist', 'shoulder', 'head', 'overhead'];

export const timeRangeOptions: Array<{ value: string; label: string; hours: number | null }> = [
  { value: '24h', label: 'Last 24 hours', hours: 24 },
  { value: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { value: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { value: 'all', label: 'All time', hours: null },
];

export const STATUS_ICONS: Record<ReportStatus, LucideIcon> = {
  UNVERIFIED: Clock,
  VERIFIED: CheckCircle2,
  ANOMALY: AlertTriangle,
  REJECTED: XCircle,
};
