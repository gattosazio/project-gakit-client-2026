'use client';

import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { fetchActiveAlerts } from '@/lib/weather';
import { getWeatherCondition } from '@/lib/weatherCodes';
import type { WeatherAlert, WeatherDayData } from '@/types/weather';

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
 * Collapsed by default; expands to the two-day outlook. Hidden entirely
 * when no digest exists (e.g. backend unreachable).
 */
export function WeatherChip({ className = '' }: { className?: string }) {
  const [days, setDays] = useState<WeatherDayData[] | null>(null);
  const [open, setOpen] = useState(false);

  // Expanded by default on desktop (where map controls live); collapsed on mobile
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) setOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const alerts: WeatherAlert[] = await fetchActiveAlerts();
        if (cancelled) return;
        const digest = alerts.find((a) => a.alertType === 'daily_digest');
        setDays(digest?.data?.days ?? null);
      } catch {
        if (!cancelled) setDays(null);
      }
    };

    void load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!days || days.length === 0) return null;

  const todayCondition = getWeatherCondition(days[0].conditionCode);
  const TodayIcon = todayCondition.icon;

  return (
    <div className={className}>
      {open ? (
        <div className="w-72 rounded-xl bg-white/95 p-3 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-900">
            <div className="flex items-center gap-2">
              <TodayIcon className="h-3.5 w-3.5" />
              Weather Outlook
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-canvas-light hover:text-slate-700"
              aria-label="Collapse weather outlook"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {days.map((day) => {
              const condition = getWeatherCondition(day.conditionCode);
              const Icon = condition.icon;
              const isPrecip = day.conditionCode >= 51;
              const detail = isPrecip
                ? `${day.rainChance}% chance of ${condition.label.toLowerCase()}`
                : condition.label;

              return (
                <div key={day.date} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas-light ring-1 ring-canvas-grey">
                    <Icon className="h-4 w-4 text-slate-600" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-tight text-slate-900">
                      {friendlyDay(`${day.date}T00:00:00+08:00`)}
                    </p>
                    <p className="text-[11px] leading-snug text-slate-500">{detail}</p>
                  </div>
                  <p className="shrink-0 text-right text-xs font-semibold text-slate-800">
                    <span className="text-[10px] font-medium text-slate-400">H </span>
                    {day.tempMax}°
                    <span className="ml-1 text-[10px] font-medium text-slate-400">L </span>
                    {day.tempMin}°
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2.5 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-2xl md:backdrop-blur"
          title={`Weather outlook — ${todayCondition.label}, ${days[0].rainChance}% chance of rain`}
          aria-label="Show weather outlook"
        >
          <TodayIcon className="h-5 w-5 text-gakit-maroon" />
          <span className="text-sm font-medium text-slate-700">{days[0].rainChance}%</span>
        </button>
      )}
    </div>
  );
}
