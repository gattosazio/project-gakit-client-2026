import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CloudRain,
  ShieldAlert,
} from 'lucide-react';
import type { NotificationType, Severity } from '@/lib/notifications';

export const TYPE_META: Record<
  NotificationType,
  { label: string; icon: typeof BellRing; className: string }
> = {
  'new-report': {
    label: 'New report',
    icon: BellRing,
    className: 'bg-blue-50 text-blue-700',
  },
  'needs-review': {
    label: 'Needs review',
    icon: ShieldAlert,
    className: 'bg-amber-50 text-amber-700',
  },
  flagged: {
    label: 'Flagged',
    icon: AlertTriangle,
    className: 'bg-orange-50 text-orange-700',
  },
  rejected: {
    label: 'Rejected',
    icon: CheckCircle2,
    className: 'bg-slate-100 text-slate-600',
  },
  weather: {
    label: 'Weather alert',
    icon: CloudRain,
    className: 'bg-cyan-50 text-cyan-700',
  },
};

export const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-orange-50 text-orange-700 border-orange-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function NotificationTypeBadge({ type }: { type: NotificationType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${SEVERITY_CLASS[severity]}`}
    >
      {severity}
    </span>
  );
}
