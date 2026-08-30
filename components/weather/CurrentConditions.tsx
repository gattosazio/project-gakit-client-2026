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
    <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-50 via-rose-50/30 to-slate-50/80 p-2.5 ring-1 ring-slate-200/70">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs ring-1 ring-slate-200/80">
        <Icon className="h-4.5 w-4.5 text-gakit-maroon" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-900">Right Now</span>
          <span className="text-[10px] font-medium text-slate-400">· {observed}</span>
        </div>
        <span className="block truncate text-[11px] font-medium text-slate-500 mt-0.5">
          {condition.label}
          {current.precipitation > 0 && ` · ${current.precipitation.toFixed(1)} mm`}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="text-base font-black tracking-tight text-slate-900 tabular-nums">
          {Math.round(current.temperature)}°
        </span>
      </span>
    </div>
  );
}
