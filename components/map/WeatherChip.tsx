'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Droplet } from 'lucide-react';
import { useActiveAlerts, useCurrentWeather } from '@/lib/weather/weatherStore';
import { formatDayForecast, getWeatherCondition, isDaytimeInManila } from '@/lib/weather/weatherCodes';
import { WeatherAttribution } from '../weather/WeatherAttribution';
import { CurrentConditions } from '../weather/CurrentConditions';
import { RainStrip } from '../weather/RainStrip';
import { WeatherAlertModal } from '../WeatherAlertModal';
import type { CurrentWeather, WeatherDayData } from '@/types/weather';

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

interface WeatherForecastContentProps {
  current: CurrentWeather | null;
  today: WeatherDayData;
  upcomingDays: WeatherDayData[];
  showAllDays: boolean;
  onToggleShowAllDays: () => void;
  onSelectDay: (date: string) => void;
}

function WeatherForecastContent({
  current,
  today,
  upcomingDays,
  showAllDays,
  onToggleShowAllDays,
  onSelectDay,
}: WeatherForecastContentProps) {
  const condition = getWeatherCondition(today.conditionCode);
  const Icon = condition.icon;
  const detail = formatDayForecast(today);

  return (
    <>
      {/* Current Conditions ("Now") */}
      {current && <CurrentConditions current={current} />}

      {/* Today's Forecast with Hourly Rain Timeline */}
      <button
        type="button"
        onClick={() => onSelectDay(today.date)}
        title="Click to view detailed hourly rainfall breakdown for Today"
        aria-label="Open detailed weather breakdown for Today"
        className="group flex flex-col w-full p-2.5 text-left rounded-xl bg-slate-50/80 border border-slate-200/70 shadow-2xs hover:bg-slate-100/90 hover:border-slate-300/80 cursor-pointer transition-all"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200/60 shadow-xs">
              <Icon className="h-3.5 w-3.5 text-slate-700" />
            </span>
            <div>
              <span className="block text-xs font-bold text-slate-900">Today</span>
              <span className="block text-[10px] text-slate-500 font-medium leading-tight">{detail}</span>
            </div>
          </div>
          <div className="text-right tabular-nums">
            <span className="text-xs font-bold text-slate-900">{today.tempMax}°</span>
            <span className="ml-1.5 text-[11px] font-medium text-slate-400">{today.tempMin}°</span>
          </div>
        </div>
        <div className="mt-2 pt-1.5 border-t border-slate-200/60">
          <RainStrip hours={today.hours} probabilities={today.hourlyProbabilities} />
        </div>
      </button>

      {/* Expandable Upcoming Days */}
      {showAllDays && (
        <div className="pt-2 border-t border-slate-100">
          <div className="grid grid-cols-4 gap-1.5">
            {upcomingDays.map((day) => {
              const dayCondition = getWeatherCondition(day.conditionCode);
              const DayIcon = dayCondition.icon;
              const shortName = friendlyShortDay(`${day.date}T00:00:00+08:00`);

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => onSelectDay(day.date)}
                  className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50/80 border border-slate-200/60 hover:bg-slate-100/90 transition-all text-center"
                >
                  <span className="text-[10px] font-bold text-slate-600">{shortName}</span>
                  <span className="my-1 flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200/50 shadow-2xs">
                    <DayIcon className="h-3 w-3 text-slate-700" />
                  </span>
                  <span className="text-[10px] font-bold text-slate-900 tabular-nums">
                    {day.tempMax}°
                  </span>
                  <span className="flex items-center gap-0.5 text-[9px] font-semibold text-slate-400 tabular-nums">
                    {day.rainChance > 0 && <Droplet className="h-2.5 w-2.5 text-sky-500 fill-sky-500/30 shrink-0" />}
                    <span>{day.rainChance ?? 0}%</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {upcomingDays.length > 0 && (
        <button
          type="button"
          onClick={onToggleShowAllDays}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:bg-slate-100/90 hover:text-slate-900 transition-all"
        >
          <span>{showAllDays ? 'Hide upcoming days' : '5-Day Forecast'}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showAllDays ? 'rotate-180 text-slate-700' : 'text-slate-400'}`} />
        </button>
      )}

      <div className="flex items-center justify-end border-t border-slate-100 pt-1.5">
        <WeatherAttribution />
      </div>
    </>
  );
}

/**
 * Floating weather-outlook control for the map. Collapsed by default;
 * `defaultExpanded` opens it on desktop viewports (>=768px) on mount. Hidden
 * entirely when no digest exists (e.g. backend unreachable). The collapsed
 * pill prefers live current conditions and silently falls back to today's rain
 * chance when they are unavailable.
 *
 * Inside MapSidebar, it renders as a collapsible accordion card. When standalone,
 * it toggles between an expanded card and a compact pill.
 */
export function WeatherChip({
  className = '',
  defaultExpanded = false,
  open: controlledOpen,
  onToggle: setControlledOpen,
  isSidebarItem = false,
}: {
  className?: string;
  defaultExpanded?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  isSidebarItem?: boolean;
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
    [open, setControlledOpen, setShowAllDays]
  );

  const days = digest?.data?.days ?? null;

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

  const forecastContent = (
    <WeatherForecastContent
      current={current}
      today={today}
      upcomingDays={upcomingDays}
      showAllDays={open && showAllDays}
      onToggleShowAllDays={() => setShowAllDays((prev) => !prev)}
      onSelectDay={(date) => setSelectedDayDate(date)}
    />
  );

  return (
    <div className={className}>
      {isSidebarItem ? (
        <div className="w-full hud-card overflow-hidden transition-all duration-200">
          <div
            onClick={() => setOpen(!open)}
            className="flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-bold text-slate-900 cursor-pointer select-none hover:bg-slate-50/60 transition-colors"
          >
            <div className="flex min-w-0 items-center gap-2">
              <PillIcon className="w-4 h-4 text-gakit-maroon shrink-0" />
              <span className="truncate">Weather Outlook</span>
              {!open && numericLabel && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 tabular-nums">
                  {numericLabel}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(!open);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-canvas-light transition-colors"
              aria-label={open ? 'Collapse weather outlook' : 'Expand weather outlook'}
            >
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <div
            aria-hidden={!open}
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="px-2.5 pb-2.5 pt-1 space-y-1.5 border-t border-slate-100/80">
                {forecastContent}
              </div>
            </div>
          </div>
        </div>
      ) : open ? (
        <div className="w-72 hud-card">
          <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-1 text-xs font-bold text-slate-900">
            <div className="flex min-w-0 items-center gap-2">
              <PillIcon className="w-3.5 h-3.5 text-gakit-maroon shrink-0" />
              <span className="truncate">Weather Outlook</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-canvas-light transition-colors"
              aria-label="Collapse weather outlook"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[46vh] overflow-y-auto px-3 pb-3 pt-1 space-y-2">
            {forecastContent}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2.5 hud-pill hover:bg-white hover:shadow-lg transition-all duration-150"
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
          onClose={() => setSelectedDayDate(null)}
        />
      )}
    </div>
  );
}
