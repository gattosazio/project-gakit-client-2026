'use client';

import { useCallback, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useActiveAlerts, useCurrentWeather } from '@/lib/weather/weatherStore';
import { formatDayForecast, getWeatherCondition, isDaytimeInManila } from '@/lib/weather/weatherCodes';
import { WeatherAttribution } from '../weather/WeatherAttribution';
import { CurrentConditions } from '../weather/CurrentConditions';
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

function friendlyShortDay(iso: string): string {
  const target = new Date(iso);
  const dayDiff = Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tom';

  return target.toLocaleDateString('en-PH', {
    weekday: 'short',
  });
}

/**
 * Floating weather-outlook control for the map. Collapsed by default;
 * `defaultExpanded` opens it on desktop viewports (>=768px) on mount. Hidden
 * entirely when no digest exists (e.g. backend unreachable). The collapsed
 * pill prefers live current conditions and silently falls back to today's rain
 * chance when they are unavailable.
 *
 * Like the reports/layers controls, the pill swaps in place to the expanded
 * card (no portal / fixed positioning), so it collapses and expands in the
 * same spot. At its top-left placement it grows downward and stays within the
 * map card, so the `overflow-hidden` map container never clips it.
 */
export function WeatherChip({
  className = '',
  defaultExpanded = false,
  open: controlledOpen,
  onToggle: setControlledOpen,
}: {
  className?: string;
  defaultExpanded?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  const alerts = useActiveAlerts();
  const current = useCurrentWeather();
  const digest = alerts?.find((a) => a.alertType === 'daily_digest') ?? null;
  const [showAllDays, setShowAllDays] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(
    () =>
      defaultExpanded &&
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches
  );

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(open) : next;
      if (setControlledOpen) {
        setControlledOpen(resolved);
      } else {
        setInternalOpen(resolved);
      }
      if (!resolved) {
        setShowAllDays(false);
      }
    },
    [open, setControlledOpen]
  );
  const days = digest?.data?.days ?? null;
  const issuedAt = digest?.createdAt ?? null;

  if (!digest || !days || days.length === 0) return null;

  const todayCondition = getWeatherCondition(days[0].conditionCode);

  // Collapsed pill: prefer live conditions when available.
  const liveCondition = current
    ? getWeatherCondition(current.conditionCode, isDaytimeInManila(current.observedAt))
    : null;
  const PillIcon = liveCondition ? liveCondition.icon : todayCondition.icon;
  const hasLive = current !== null && liveCondition !== null;
  const pillLabel = hasLive
    ? `${liveCondition.label} · ${Math.round(current.temperature)}°`
    : `${days[0].rainChance}%`;
  const pillTooltip = hasLive
    ? `${liveCondition.label}, ${Math.round(current.temperature)}° now · as of ${new Date(
        current.observedAt
      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `Weather outlook — ${todayCondition.label}, ${days[0].rainChance}% chance of rain`;

  const numericLabel = hasLive
    ? `${Math.round(current.temperature)}°`
    : `${days[0].rainChance}%`;

  const today = days[0];
  const upcomingDays = days.slice(1);

  return (
    <div className={className}>
      {open ? (
        <div className="w-[300px] sm:w-[316px] max-h-[60vh] overflow-y-auto rounded-2xl bg-white p-3.5 shadow-xl border border-slate-200/90 md:bg-white/90 md:backdrop-blur-xl md:border-white/60 ring-1 ring-slate-200/80 animate-[weatherGrow_160ms_ease-out]">
          {/* Header */}
          <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-5 items-center gap-1.5 rounded-full bg-maroon-50 px-2 text-[10px] font-bold text-gakit-maroon ring-1 ring-maroon-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-gakit-maroon animate-pulse" />
                <span>WEATHER</span>
              </div>
              {issuedAt && (
                <span className="truncate text-[10px] font-medium text-slate-400 tabular-nums">
                  · Issued {new Date(issuedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-95"
              aria-label="Collapse weather outlook"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Current Conditions ("Right Now") */}
          {current && (
            <div className="mb-2.5">
              <CurrentConditions current={current} />
            </div>
          )}

          <div className="space-y-2">
            {/* Today's Forecast with Hourly Rain Timeline */}
            {(() => {
              const condition = getWeatherCondition(today.conditionCode);
              const Icon = condition.icon;
              const detail = formatDayForecast(today);

              return (
                <button
                  type="button"
                  onClick={() => setSelectedDayDate(today.date)}
                  aria-label="Open detailed weather breakdown for Today"
                  className="group flex flex-col w-full rounded-xl bg-slate-50/60 p-2.5 text-left ring-1 ring-slate-200/60 transition-all duration-150 hover:bg-slate-50 hover:ring-slate-300 active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-2xs ring-1 ring-slate-200/80">
                        <Icon className="h-3.5 w-3.5 text-slate-700" />
                      </span>
                      <div>
                        <span className="block text-xs font-bold text-slate-900 group-hover:text-gakit-maroon transition-colors">Today</span>
                        <span className="block text-[10px] text-slate-500 font-medium leading-tight">{detail}</span>
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <span className="text-xs font-bold text-slate-900">{today.tempMax}°</span>
                      <span className="ml-1.5 text-[11px] font-medium text-slate-400">{today.tempMin}°</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-200/40">
                    <RainStrip hours={today.hours} />
                  </div>
                </button>
              );
            })()}

            {/* Expandable Upcoming Days (Horizontal Mini-Cards Stack) */}
            {showAllDays && (
              <div className="pt-2 border-t border-slate-100">
                <div className="grid grid-cols-4 gap-1.5">
                  {upcomingDays.map((day) => {
                    const condition = getWeatherCondition(day.conditionCode);
                    const Icon = condition.icon;
                    const shortName = friendlyShortDay(`${day.date}T00:00:00+08:00`);

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDayDate(day.date)}
                        aria-label={`Open detailed weather breakdown for ${friendlyDay(`${day.date}T00:00:00+08:00`)}`}
                        className="group relative flex flex-col items-center justify-between rounded-xl bg-slate-50/70 p-2 text-center ring-1 ring-slate-200/60 transition-all duration-150 hover:bg-white hover:ring-maroon-300 hover:shadow-md active:scale-95"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-gakit-maroon transition-colors">
                          {shortName}
                        </span>
                        <div className="my-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-2xs ring-1 ring-slate-200/80 group-hover:scale-105 transition-transform">
                          <Icon className="h-4 w-4 text-slate-700" />
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-900 tabular-nums">
                          <span>{day.tempMax}°</span>
                          <span className="text-[9px] font-medium text-slate-400">{day.tempMin}°</span>
                        </div>
                        {day.rainChance > 20 && (
                          <span className="mt-0.5 text-[9px] font-bold text-sky-600">
                            {day.rainChance}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {upcomingDays.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllDays((prev) => !prev)}
              className="mt-2.5 flex w-full items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/60 hover:bg-maroon-50/60 hover:text-gakit-maroon hover:ring-maroon-200/80 active:scale-[0.98] transition-all"
            >
              <span>{showAllDays ? 'Hide upcoming days' : '5-Day Forecast'}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showAllDays ? 'rotate-180 text-gakit-maroon' : 'text-slate-400'}`} />
            </button>
          )}

          <div className="mt-2.5 flex items-center justify-end border-t border-slate-100 pt-1.5">
            <WeatherAttribution />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-md border border-slate-200/90 md:bg-white/85 md:backdrop-blur-xl md:border-white/60 ring-1 ring-slate-200/80 transition-all duration-150 hover:bg-white hover:shadow-lg active:scale-[0.97]"
          title={pillTooltip}
          aria-label="Show weather outlook"
          aria-expanded={open}
        >
          <PillIcon className="h-5 w-5 text-gakit-maroon" />
          <span className="hidden text-sm font-semibold text-slate-700 tabular-nums md:inline">{pillLabel}</span>
          <span className="text-sm font-semibold text-slate-700 tabular-nums md:hidden">{numericLabel}</span>
        </button>
      )}

      {selectedDayDate && (
        <WeatherAlertModal
          alert={digest}
          highlightDate={selectedDayDate}
          current={current}
          onClose={() => setSelectedDayDate(null)}
        />
      )}
    </div>
  );
}
