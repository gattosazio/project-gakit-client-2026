'use client';

import { CloudRain, AlertTriangle, Flame, Thermometer, X } from 'lucide-react';
import type { CurrentWeather, WeatherAlert, AlertSeverity, AlertType, WeatherDayData } from '@/types/weather';
import { getWeatherCondition } from '@/lib/weather/weatherCodes';
import { WeatherAttribution } from './weather/WeatherAttribution';
import { CurrentConditions } from './weather/CurrentConditions';
import { RainStrip } from './weather/RainStrip';

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

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Tomorrow", or "Sat, Aug 25" */
function friendlyDay(iso: string): string {
  const target = new Date(iso);
  const dayDiff = Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff === -1) return 'Yesterday';

  return target.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function DayRow({ day, highlighted }: { day: WeatherDayData; highlighted?: boolean }) {
  const condition = getWeatherCondition(day.conditionCode);
  const Icon = condition.icon;

  // Precipitation codes (WMO 51+) read naturally with their probability,
  // e.g. "24% chance of light drizzle" — never implying rain is certain.
  const isPrecip = day.conditionCode >= 51;
  const detail = isPrecip
    ? `${day.rainChance}% chance of ${condition.label.toLowerCase()}` +
      (day.rainMm > 0 ? ` (${day.rainMm.toFixed(1)}mm)` : '')
    : condition.label;

  return (
    <div
      className={`rounded-lg border p-3 ${
        highlighted
          ? 'border-transparent bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/80'
          : 'border-canvas-grey bg-canvas-light'
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-canvas-grey">
          <Icon className="h-5 w-5 text-slate-600" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{friendlyDay(`${day.date}T00:00:00+08:00`)}</span>
          <span className="block text-xs text-slate-500">{detail}</span>
        </span>
        <span className="shrink-0 text-right text-sm font-semibold text-slate-800">
          <span className="text-xs font-medium text-slate-400">H </span>
          {day.tempMax}°
          <span className="ml-1.5 text-xs font-medium text-slate-400">L </span>
          {day.tempMin}°
        </span>
      </span>
      <div className="mt-2">
        <RainStrip hours={day.hours} />
      </div>
    </div>
  );
}

/** Human-friendly period covered by the alert, e.g. "Today – Tomorrow".
 *  Returns null when the period is obvious (today through tomorrow). */
function friendlyPeriod(validFrom: string, validTo: string): string | null {
  const from = new Date(validFrom);
  const to = new Date(validTo);
  const dayDiffFromToday = Math.round((startOfDay(from) - startOfDay(new Date())) / 86_400_000);
  const spansTwoDays =
    Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000) === 1;

  // Digest-style window: covered by the title/description already
  if (dayDiffFromToday === 0 && spansTwoDays) return null;

  const fromLabel = friendlyDay(validFrom);
  return fromLabel === friendlyDay(validTo) ? fromLabel : `${fromLabel} – ${friendlyDay(validTo)}`;
}

interface WeatherAlertModalProps {
  alert: WeatherAlert;
  /** ISO date of the day to emphasize (e.g. the card the user clicked). */
  highlightDate?: string;
  /** Live conditions snapshot; rendered above the body when provided. */
  current?: CurrentWeather | null;
  onClose: () => void;
}

export function WeatherAlertModal({ alert, highlightDate, current, onClose }: WeatherAlertModalProps) {
  const config = SEVERITY_CONFIG[alert.severity];
  const Icon = ALERT_ICONS[alert.alertType] ?? CloudRain;
  const period = friendlyPeriod(alert.validFrom, alert.validTo);

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
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${config.badge}`}>
                {ALERT_TYPE_LABELS[alert.alertType]}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${config.badge}`}>
                {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
              </span>
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
          <h3 className="text-base font-bold text-slate-900">{alert.title}</h3>
          <p className="mb-2 text-[10px] text-slate-400">
            Issued{' '}
            {new Date(alert.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>

          {current && (
            <div className="mb-2">
              <CurrentConditions current={current} />
            </div>
          )}

          {alert.data?.days?.length ? (
            <div className="space-y-2">
              {alert.data.days.map((day) => (
                <DayRow key={day.date} day={day} highlighted={highlightDate === day.date} />
              ))}
            </div>
          ) : (
            <p className="whitespace-pre-line text-sm text-slate-600 leading-relaxed mb-4">
              {alert.description}
            </p>
          )}

          {period && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light p-3 text-sm text-slate-700">
              <span className="font-medium">When:</span>
              <span>{period}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-canvas-grey p-4 md:p-5">
          <WeatherAttribution />
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
