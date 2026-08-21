'use client';

import { useEffect, useState, useCallback } from 'react';
import { CloudRain, AlertTriangle, Flame, Thermometer, X } from 'lucide-react';
import { fetchActiveAlerts } from '@/lib/weather';
import type { WeatherAlert, AlertSeverity, AlertType } from '@/types/weather';
import { WeatherAlertModal } from './WeatherAlertModal';

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { bg: string; border: string; text: string; icon: string }
> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-800',
    icon: 'text-orange-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-800',
    icon: 'text-blue-500',
  },
};

const ALERT_ICONS: Record<AlertType, typeof CloudRain> = {
  thunderstorm: AlertTriangle,
  heavy_rain: CloudRain,
  extreme_heat: Flame,
  daily_digest: Thermometer,
};

const DISMISS_KEY = 'gakit-dismissed-alerts';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getDismissedIds(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function setDismissedIds(ids: Record<string, number>) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
}

function cleanupExpiredDismissed(ids: Record<string, number>): Record<string, number> {
  const now = Date.now();
  const cleaned: Record<string, number> = {};
  for (const [id, ts] of Object.entries(ids)) {
    if (now - ts < DISMISS_DURATION_MS) {
      cleaned[id] = ts;
    }
  }
  return cleaned;
}

export function WeatherAlertBanner() {
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<WeatherAlert | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchActiveAlerts();
      setAlerts(data);
    } catch {
      // Silently fail — banner just won't show
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 5 * 60 * 1000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, [loadAlerts]);

  useEffect(() => {
    setDismissed(cleanupExpiredDismissed(getDismissedIds()));
  }, []);

  const handleDismiss = (id: string) => {
    const updated = { ...getDismissedIds(), [id]: Date.now() };
    setDismissedIds(updated);
    setDismissed(updated);
    setSelectedAlert(null);
  };

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter((a) => !dismissed[a.id]);

  if (visibleAlerts.length === 0) return null;

  // Show the most severe alert in the banner
  const topAlert = visibleAlerts.reduce((prev, curr) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[curr.severity] < order[prev.severity] ? curr : prev;
  });

  const config = SEVERITY_CONFIG[topAlert.severity];
  const Icon = ALERT_ICONS[topAlert.alertType] ?? CloudRain;

  return (
    <>
      <div
        className={`relative z-30 ${config.bg} border-b ${config.border} cursor-pointer`}
        onClick={() => setSelectedAlert(topAlert)}
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Icon className={`w-5 h-5 flex-shrink-0 ${config.icon}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${config.text} truncate`}>
              {topAlert.title}
            </p>
            <p className={`text-xs ${config.text} opacity-80 truncate`}>
              {topAlert.description}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss(topAlert.id);
            }}
            className={`flex-shrink-0 p-1 rounded hover:bg-black/5 ${config.text}`}
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {visibleAlerts.length > 1 && (
          <p className={`text-xs ${config.text} opacity-60 text-center pb-1`}>
            +{visibleAlerts.length - 1} more alert{visibleAlerts.length > 2 ? 's' : ''}
          </p>
        )}
      </div>

      {selectedAlert && (
        <WeatherAlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onDismiss={() => handleDismiss(selectedAlert.id)}
        />
      )}
    </>
  );
}
