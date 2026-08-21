'use client';

import { useEffect, useState, useCallback } from 'react';
import { CloudRain, AlertTriangle, Flame, Thermometer, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchActiveAlerts } from '@/lib/weather';
import type { WeatherAlert, AlertSeverity, AlertType } from '@/types/weather';
import { WeatherAlertModal } from './WeatherAlertModal';

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { bg: string; border: string; text: string; icon: string; dot: string }
> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    icon: 'text-orange-500',
    dot: 'bg-orange-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
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

export function WeatherAlertCards() {
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<WeatherAlert | null>(null);
  const [expanded, setExpanded] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchActiveAlerts();
      setAlerts(data);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  if (alerts.length === 0) return null;

  return (
    <>
      <div className="absolute top-4 left-4 z-[1000] w-64">
        {/* Collapsed pill */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 rounded-xl bg-white/90 px-3 py-3 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-2xl md:backdrop-blur"
            title="Show weather alerts"
            aria-label="Show weather alerts"
          >
            <CloudRain className="w-5 h-5 text-gakit-maroon" />
            <span className="text-sm font-medium text-slate-700">Weather Alerts</span>
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {alerts.length}
            </span>
          </button>
        )}

        {/* Expanded card */}
        {expanded && (
          <div className="rounded-xl bg-white/95 p-3 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur">
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-900 mb-2">
              <div className="flex items-center gap-2">
                <CloudRain className="w-3.5 h-3.5 text-gakit-maroon" />
                Weather Alerts
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {alerts.length}
                </span>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Collapse weather alerts"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {alerts.map((alert) => {
                const config = SEVERITY_CONFIG[alert.severity];
                const Icon = ALERT_ICONS[alert.alertType] ?? CloudRain;
                return (
                  <button
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`flex items-start gap-2 rounded-lg p-2 text-left ring-1 transition-colors hover:brightness-95 ${config.bg} ${config.border}`}
                  >
                    <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${config.icon}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-semibold leading-tight ${config.text} truncate`}>
                        {alert.title}
                      </p>
                      <p className={`text-[10px] leading-tight ${config.text} opacity-70 truncate`}>
                        {ALERT_TYPE_LABELS[alert.alertType]}
                      </p>
                    </div>
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedAlert && (
        <WeatherAlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onDismiss={() => setSelectedAlert(null)}
        />
      )}
    </>
  );
}
