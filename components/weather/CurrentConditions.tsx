'use client';

import type { CurrentWeather } from '@/types/weather';
import { getWeatherCondition, isDaytimeInManila } from '@/lib/weather/weatherCodes';

/**
 * Live-conditions row shared by the expanded weather-outlook card and the
 * alert modal. Maroon accent distinguishes the live snapshot from the
 * forecast rows beneath it.
 */
export function CurrentConditions({ current }: { current: CurrentWeather }) {
  const condition = getWeatherCondition(
    current.conditionCode,
    isDaytimeInManila(current.observedAt)
  );
  const Icon = condition.icon;
  const observed = new Date(current.observedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-canvas-light p-2.5 ring-1 ring-canvas-grey">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs ring-1 ring-canvas-grey">
        <Icon className="h-4 w-4 text-gakit-maroon" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-900">Now</span>
          <span className="text-[10px] font-medium text-slate-400">· as of {observed}</span>
        </div>
        <span className="block truncate text-[11px] font-medium text-slate-500">
          {condition.label}
          {current.precipitation > 0 && ` · ${current.precipitation.toFixed(1)} mm`}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="text-sm font-bold text-slate-900 tabular-nums">
          {Math.round(current.temperature)}°
        </span>
      </span>
    </div>
  );
}
