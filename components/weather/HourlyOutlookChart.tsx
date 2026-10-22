'use client';

import { useId, useState } from 'react';
import type { WeatherDayData } from '@/types/weather';
import { hourlyRainSeries, outlookHour, rainChartMaximum, rainIntervalLabel } from '@/lib/weather/hourlyOutlook';

export function HourlyOutlookChart({ day }: { day: WeatherDayData }) {
  const chance = hourlyRainSeries(day, 'chance');
  const amount = hourlyRainSeries(day, 'amount');
  const series = chance ?? amount;
  const mode = chance ? 'chance' : 'amount';
  const maximum = series ? rainChartMaximum(series, mode) : 1;
  const [hour, setHour] = useState(12);
  const chartId = useId();
  const amountLabel = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value.toFixed(1)} mm`;
  const chanceLabel = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value}%`;
  const hours = Array.from({ length: 24 }, (_, index) => index);

  return <section aria-labelledby={`${chartId}-title`} className="rounded-xl border border-slate-200 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={`${chartId}-title`} className="text-xs font-bold text-slate-900">Hourly outlook</h3>
      <span className="text-[10px] font-medium text-sky-700">{chance ? 'Chance of rain · %' : 'Estimated rainfall · mm'}</span>
    </div>
    {chance || amount ? <>
      <div className="mb-3 mt-3 flex flex-wrap items-center justify-between gap-2 tabular-nums">
        <span className="text-[11px] font-medium text-slate-500">{rainIntervalLabel(hour)} · PHT</span>
        <div className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1">{chance && <span className="text-lg font-bold text-sky-800">{chanceLabel(chance[hour])}<span className="ml-1 text-[10px] font-normal text-slate-500">chance</span></span>}{amount && <span className={chance ? 'text-xs font-semibold text-slate-700' : 'text-lg font-bold text-sky-800'}>{amountLabel(amount[hour])}<span className="ml-1 text-[10px] font-normal text-slate-500">estimated rain</span></span>}</div>
      </div>
      {series ? <div className="flex gap-2">
        <div className="flex h-28 w-8 shrink-0 flex-col justify-between text-right text-[9px] tabular-nums text-slate-400" aria-hidden="true">{[maximum, maximum / 2, 0].map(value => <span key={value}>{chance ? `${value}%` : `${Number(value.toFixed(2))} mm`}</span>)}</div>
        <div className="min-w-0 flex-1">
          <div className="relative">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-28 w-full overflow-visible" aria-hidden="true">
            {[0, 50, 100].map(y => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" strokeWidth="0.5" vectorEffect="non-scaling-stroke" className="text-slate-200" />)}
            {series.map((value, index) => value == null ? null : <rect key={index} x={index * 100 / 24 + .5} y={100 - Math.max(.6, value / maximum * 100)} width={100 / 24 - 1} height={Math.max(.6, value / maximum * 100)} rx="0.6" className={index === hour ? 'fill-sky-700' : value === 0 ? 'fill-sky-200' : 'fill-sky-400'} />)}
          </svg>
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }} role="group" aria-label="Hourly forecast. Tap a bar or use left and right arrow keys to inspect hours.">
            {hours.map(index => <button key={index} type="button" data-hour={index} tabIndex={index === hour ? 0 : -1}
              aria-label={`${rainIntervalLabel(index)} Philippine time: ${chance ? `${chanceLabel(chance[index])} chance of rain, ` : ''}estimated rainfall ${amountLabel(amount?.[index])}`}
              onMouseEnter={() => setHour(index)} onFocus={() => setHour(index)} onClick={() => setHour(index)}
              onKeyDown={event => {
                const next = event.key === 'ArrowRight' ? Math.min(23, index + 1) : event.key === 'ArrowLeft' ? Math.max(0, index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? 23 : null;
                if (next === null) return;
                event.preventDefault();
                setHour(next);
                event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-hour="${next}"]`)?.focus();
              }}
              className="min-w-0 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700" />)}
          </div>
          </div>
          <div className="mt-2 flex justify-between text-[9px] tabular-nums text-slate-400" aria-hidden="true">{[0, 6, 12, 18, 23].map(value => <span key={value}>{outlookHour(value)}</span>)}</div>
        </div>
      </div> : <p role="status" className="py-3 text-xs text-slate-500">Hourly rainfall data is unavailable.</p>}
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Hourly estimates · intervals end at the labelled time.</p>
    </> : <p role="status" className="py-6 text-center text-xs text-slate-500">Hourly data is unavailable for this day.</p>}
  </section>;
}
