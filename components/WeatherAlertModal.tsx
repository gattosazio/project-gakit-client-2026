'use client';

import { CloudRain, AlertTriangle, Flame, Thermometer, X } from 'lucide-react';
import type { WeatherAlert, AlertSeverity, AlertType } from '@/types/weather';

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { bg: string; border: string; text: string; badge: string; icon: string }
> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    badge: 'bg-orange-100 text-orange-700',
    icon: 'text-orange-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-700',
    icon: 'text-blue-500',
  },
};

const ALERT_ICONS: Record<AlertType, typeof CloudRain> = {
  thunderstorm: AlertTriangle,
  heavy_rain: CloudRain,
  extreme_heat: Flame,
  daily_digest: Thermometer,
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  thunderstorm: 'Thunderstorm',
  heavy_rain: 'Heavy Rain',
  extreme_heat: 'Heat Advisory',
  daily_digest: 'Daily Forecast',
};

interface WeatherAlertModalProps {
  alert: WeatherAlert;
  onClose: () => void;
  onDismiss: () => void;
}

export function WeatherAlertModal({ alert, onClose, onDismiss }: WeatherAlertModalProps) {
  const config = SEVERITY_CONFIG[alert.severity];
  const Icon = ALERT_ICONS[alert.alertType] ?? CloudRain;

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md rounded-xl border ${config.border} ${config.bg} shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black/10">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.icon}`} />
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
              {ALERT_TYPE_LABELS[alert.alertType]}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}
            >
              {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-black/10 text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3 className={`text-lg font-bold ${config.text} mb-2`}>{alert.title}</h3>
          <p className={`text-sm ${config.text} opacity-90 leading-relaxed mb-4`}>
            {alert.description}
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>From: {formatDateTime(alert.validFrom)}</span>
            <span>Until: {formatDateTime(alert.validTo)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-black/10">
          <button
            onClick={onDismiss}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${config.badge} hover:opacity-80`}
          >
            Dismiss for 24h
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
