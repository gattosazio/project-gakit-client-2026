'use client';

import { CloudRain, AlertTriangle, Flame, Thermometer, X } from 'lucide-react';
import type { WeatherAlert, AlertSeverity, AlertType } from '@/types/weather';

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { text: string; badge: string; icon: string; dot: string }
> = {
  critical: {
    text: 'text-red-700',
    badge: 'bg-red-50 text-red-700',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
  warning: {
    text: 'text-orange-700',
    badge: 'bg-orange-50 text-orange-700',
    icon: 'text-orange-500',
    dot: 'bg-orange-500',
  },
  info: {
    text: 'text-blue-700',
    badge: 'bg-blue-50 text-blue-700',
    icon: 'text-blue-500',
    dot: 'bg-blue-500',
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

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl border border-canvas-grey bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-canvas-grey p-4 md:p-5">
          <div className="flex items-center gap-3">
            <span className={`rounded-xl p-2.5 ${config.badge}`}>
              <Icon className={`h-5 w-5 ${config.icon}`} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${config.badge}`}>
                  {ALERT_TYPE_LABELS[alert.alertType]}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${config.badge}`}>
                  {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-canvas-light hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 md:p-5">
          <h3 className="text-base font-bold text-slate-900 mb-2">{alert.title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            {alert.description}
          </p>

          <div className="rounded-lg border border-canvas-grey bg-canvas-light p-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <span className="font-medium">Valid from:</span>
              <span>{formatDate(alert.validFrom)} at {formatTime(alert.validFrom)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-700 mt-1.5">
              <span className="font-medium">Valid until:</span>
              <span>{formatDate(alert.validTo)} at {formatTime(alert.validTo)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-canvas-grey p-4 md:p-5">
          <button
            onClick={onDismiss}
            className="rounded-lg border border-canvas-grey px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light transition-colors"
          >
            Dismiss for 24h
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
