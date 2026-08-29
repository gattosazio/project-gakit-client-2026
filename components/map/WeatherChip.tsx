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

  return (
    <div className={className}>
      {open ? (
        <div className="w-72 rounded-2xl bg-white/90 p-3 shadow-[0_12px_40px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.9)] border border-white/60 ring-1 ring-slate-200/80 backdrop-blur-xl animate-[weatherGrow_160ms_ease-out] origin-bottom">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-900">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0">Weather Outlook</span>
              {issuedAt && (
                <span className="truncate text-[10px] font-medium text-slate-400 tabular-nums">
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
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-canvas-light hover:text-slate-700 active:scale-95"
              aria-label="Collapse weather outlook"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          {current && (
            <div className="mb-2">
              <CurrentConditions current={current} />
            </div>
          )}
          <div className="space-y-1">
            {days.map((day) => {
              const condition = getWeatherCondition(day.conditionCode);
              const Icon = condition.icon;
              const detail = formatDayForecast(day);

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDayDate(day.date)}
                  aria-label={`Open weather details for ${friendlyDay(`${day.date}T00:00:00+08:00`)}`}
                  className="-mx-1 w-[calc(100%+0.5rem)] rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-canvas-light active:scale-[0.98]"
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
                    <span className="shrink-0 text-right text-xs font-semibold text-slate-800 tabular-nums">
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
          className="flex items-center gap-2 rounded-2xl bg-white/85 px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.9)] border border-white/60 ring-1 ring-slate-200/80 backdrop-blur-xl transition-all duration-150 hover:bg-white hover:shadow-xl active:scale-[0.97]"
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
