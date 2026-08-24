'use client';

import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { fetchActiveAlerts, fetchCurrentWeather } from '@/lib/weather/weather';
import { getWeatherCondition } from '@/lib/weather/weatherCodes';
import type { CurrentWeather, WeatherAlert } from '@/types/weather';
import { WeatherAttribution } from '../weather/WeatherAttribution';
import { RainStrip } from '../weather/RainStrip';
import { WeatherAlertModal } from '../WeatherAlertModal';

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function friendlyDay(iso: string): string {
  const target = new Date(iso);
  const dayDiff = Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';

  return target.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Floating weather-outlook control for the map's desktop control stack.
 * Collapsed by default; `defaultExpanded` opens it on desktop viewports
 * (≥768px) on mount. Hidden entirely when no digest exists (e.g. backend
 * unreachable). The collapsed pill prefers live current conditions and
 * silently falls back to today's rain chance when they are unavailable.
 */
export function WeatherChip({
  className = '',
  defaultExpanded = false,
}: {
  className?: string;
  defaultExpanded?: boolean;
}) {
  const [digest, setDigest] = useState<WeatherAlert | null>(null);
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [open, setOpen] = useState(
    () =>
      defaultExpanded &&
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const alerts: WeatherAlert[] = await fetchActiveAlerts();
        if (cancelled) return;
        setDigest(alerts.find((a) => a.alertType === 'daily_digest') ?? null);
      } catch {
        if (!cancelled) setDigest(null);
      }
    };

    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 5 * 60 * 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCurrent = async () => {
      try {
        const snapshot = await fetchCurrentWeather();
        if (!cancelled) setCurrent(snapshot);
      } catch {
        // Keep whatever we had — the pill falls back to rain chance.
      }
    };

    void loadCurrent();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void loadCurrent();
    }, 5 * 60 * 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void loadCurrent();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const days = digest?.data?.days ?? null;
  const issuedAt = digest?.createdAt ?? null;

  if (!digest || !days || days.length === 0) return null;

  const todayCondition = getWeatherCondition(days[0].conditionCode);
  const TodayIcon = todayCondition.icon;

  // Collapsed pill: prefer live conditions when available.
  const liveCondition = current ? getWeatherCondition(current.conditionCode) : null;
  const PillIcon = liveCondition ? liveCondition.icon : TodayIcon;
  const hasLive = current !== null && liveCondition !== null;
  const pillLabel = hasLive
    ? `${liveCondition.label} · ${Math.round(current.temperature)}°`
    : `${days[0].rainChance}%`;
  const pillTooltip = hasLive
    ? `${liveCondition.label}, ${Math.round(current.temperature)}° now · as of ${new Date(
        current.observedAt
      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `Weather outlook — ${todayCondition.label}, ${days[0].rainChance}% chance of rain`;

  return (
    <div className={className}>
      {open ? (
        <div className="w-72 rounded-xl bg-white/95 p-3 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-900">
            <div className="flex min-w-0 items-center gap-2">
              <TodayIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0">Weather Outlook</span>
              {issuedAt && (
                <span className="truncate text-[10px] font-medium text-slate-400">
                  · Issued{' '}
                  {new Date(issuedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-canvas-light hover:text-slate-700"
              aria-label="Collapse weather outlook"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            {days.map((day) => {
              const condition = getWeatherCondition(day.conditionCode);
              const Icon = condition.icon;
              const isPrecip = day.conditionCode >= 51;
              const detail = isPrecip
                ? `${day.rainChance}% chance of ${condition.label.toLowerCase()}`
                : condition.label;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDayDate(day.date)}
                  aria-label={`Open weather details for ${friendlyDay(`${day.date}T00:00:00+08:00`)}`}
                  className="-mx-1 w-[calc(100%+0.5rem)] rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-canvas-light"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas-light ring-1 ring-canvas-grey">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold leading-tight text-slate-900">
                        {friendlyDay(`${day.date}T00:00:00+08:00`)}
                      </span>
                      <span className="block text-[11px] leading-snug text-slate-500">{detail}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs font-semibold text-slate-800">
                      <span className="text-[10px] font-medium text-slate-400">H </span>
                      {day.tempMax}°
                      <span className="ml-1 text-[10px] font-medium text-slate-400">L </span>
                      {day.tempMin}°
                    </span>
                  </span>
                  <span className="mt-1 block">
                    <RainStrip hours={day.hours} />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-end border-t border-slate-100 pt-1.5">
            <WeatherAttribution />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2.5 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-2xl md:backdrop-blur"
          title={pillTooltip}
          aria-label="Show weather outlook"
        >
          <PillIcon className="h-5 w-5 text-gakit-maroon" />
          <span className="text-sm font-medium text-slate-700">{pillLabel}</span>
        </button>
      )}
      {selectedDayDate && (
        <WeatherAlertModal
          alert={digest}
          highlightDate={selectedDayDate}
          onClose={() => setSelectedDayDate(null)}
        />
      )}
    </div>
  );
}
