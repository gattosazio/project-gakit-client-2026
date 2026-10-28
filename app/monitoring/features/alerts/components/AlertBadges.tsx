import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CloudRain,
  Flame,
  ShieldAlert,
  Thermometer,
} from 'lucide-react';
import type { Notification, NotificationType, Severity } from '@/lib/notifications';
import type { AlertType } from '@/types/weather';
import { ALERT_TYPE_LABELS } from '@/lib/weather/alertLabels';

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
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${SEVERITY_CLASS[severity]}`}
    >
      {severity}
    </span>
  );
}


export const WEATHER_TYPE_META: Record<
  AlertType,
  { icon: typeof CloudRain; className: string }
> = {
  thunderstorm: { icon: AlertTriangle, className: 'bg-cyan-50 text-cyan-700' },
  heavy_rain: { icon: CloudRain, className: 'bg-cyan-50 text-cyan-700' },
  extreme_heat: { icon: Flame, className: 'bg-orange-50 text-orange-700' },
  daily_digest: { icon: Thermometer, className: 'bg-slate-100 text-slate-600' },
};

export function AlertTypeBadge({ notification }: { notification: Notification }) {
  const alertType = notification.weatherAlert?.alertType;

  if (notification.type === 'weather' && alertType) {
    const meta = WEATHER_TYPE_META[alertType];
    const Icon = meta.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.className}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {ALERT_TYPE_LABELS[alertType]}
      </span>
    );
  }

  return <NotificationTypeBadge type={notification.type} />;
}
