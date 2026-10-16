'use client';

import { useEffect, useId, useState } from 'react';
import { CloudSun, Droplets, Wind, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import type { WeatherAlert } from '@/types/weather';
import { getWeatherCondition } from '@/lib/weather/weatherCodes';
import { outlookDayLabel, outlookDays } from '@/lib/weather/outlook';
import { AmbientWeatherIcon } from './AmbientWeatherIcon';
import { HourlyOutlookChart } from './HourlyOutlookChart';
import { WeatherAttribution } from './WeatherAttribution';
import { WeatherCanvasBackdrop } from './WeatherCanvasBackdrop';

const metric = (value: number | null | undefined, unit: string, decimals = 0) => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(decimals)}${unit}` : 'Unavailable';
function forecastTime(iso: string) {
  return Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Time unavailable';
}

export function WeatherOutlookModal({ alert, highlightDate, onClose }: { alert: WeatherAlert; highlightDate?: string; onClose: () => void }) {
  const titleId = useId();
  const [now, setNow] = useState(() => Date.now());
  const [selectedDate, setDate] = useState(highlightDate);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const available = [...new Map((alert.data?.days ?? []).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isFinite(Date.parse(`${day.date}T12:00:00+08:00`))).map(day => [day.date, day])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = outlookDays(available, now);
  // Historical notifications remain inspectable, with their original dates.
  const days = upcoming.length && !available.some(day => day.date === highlightDate && !upcoming.includes(day)) ? upcoming : available.slice(0, 5);
  const day = days.find(value => value.date === selectedDate) ?? days[0];
  const stale = !Number.isFinite(Date.parse(alert.validTo)) || Date.parse(alert.validTo) <= now || !upcoming.length;
  const condition = day ? getWeatherCondition(day.conditionCode) : null;
  const darkSummary = Boolean(day && day.conditionCode >= 95 && day.conditionCode <= 99);
  const updated = alert.data?.retrievedAt || alert.data?.issuedAt || alert.createdAt;

  return <Dialog isOpen onClose={onClose} ariaLabelledBy={titleId} maxWidthClass="max-w-xl" panelClassName="flex max-h-[90dvh] flex-col overflow-hidden">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><CloudSun className="h-4 w-4" aria-hidden="true" /></span><div><h2 id={titleId} className="font-heading text-base font-bold tracking-tight text-slate-900">Weather outlook</h2><p className="text-[11px] text-slate-500">{alert.data?.location?.label ?? 'Iligan City'} · Model forecast · PHT</p></div></div>
      <button type="button" onClick={onClose} aria-label="Close weather outlook" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-4 w-4" /></button>
    </header>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
      {stale && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">This forecast is out of date. Check the latest outlook for current weather information.</p>}
      {day ? <>
        <div className="grid grid-cols-5 gap-1" role="group" aria-label="Select forecast day">
          {days.map(value => {
            const Icon = getWeatherCondition(value.conditionCode).icon;
            const selected = value.date === day.date;
            return <button key={value.date} type="button" aria-pressed={selected} aria-label={`${outlookDayLabel(value.date, now)}, ${value.date}`} onClick={() => setDate(value.date)}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors ${selected ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
              <span className="text-[11px] font-semibold">{outlookDayLabel(value.date, now)}</span><span className="text-[9px]">{new Date(`${value.date}T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}</span><Icon className="mt-0.5 h-4 w-4" aria-hidden="true" />
              <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums">{metric(value.tempMax, '°')} <span className="font-normal text-slate-400">{metric(value.tempMin, '°')}</span></span>
            </button>;
          })}
        </div>
        <section aria-label="Selected day summary" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className={`relative overflow-hidden p-3.5 ${darkSummary ? 'bg-slate-900 text-white' : 'bg-sky-100 text-slate-900'}`}>
            <WeatherCanvasBackdrop conditionCode={day.conditionCode} observedAt={`${day.date}T12:00:00+08:00`} />
            <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-[1] ${darkSummary ? 'bg-slate-950/30' : 'bg-white/30'}`} />
            <div className="relative z-10 flex items-center gap-3">
            <AmbientWeatherIcon conditionCode={day.conditionCode} observedAt={`${day.date}T12:00:00+08:00`} isDark={darkSummary} className="!h-12 !w-12 [&_svg]:!h-7 [&_svg]:!w-7" />
            <div className="min-w-0 flex-1"><h3 className="text-sm font-bold">{outlookDayLabel(day.date, now)} forecast</h3><p className={`mt-0.5 text-xs ${darkSummary ? 'text-slate-200' : 'text-slate-600'}`}>{condition?.label}</p></div>
            <div className="shrink-0 text-right tabular-nums"><p className="text-xl font-semibold tracking-tight">{metric(day.tempMax, '°')}<span className={`ml-1 text-sm font-normal ${darkSummary ? 'text-slate-300' : 'text-slate-500'}`}>/ {metric(day.tempMin, '°')}</span></p><p className={`text-[9px] ${darkSummary ? 'text-slate-300' : 'text-slate-600'}`}>High / low · °C</p></div>
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 py-3">
            {[{ icon: Droplets, label: 'Rain chance', value: metric(day.rainChance, '%') }, { icon: Droplets, label: 'Rainfall', value: metric(day.rainMm, ' mm', 1) }, { icon: Wind, label: 'Max wind', value: metric(day.windMax, ' km/h') }].map(({ icon: Icon, label, value }) => <div key={label} className="min-w-0 px-1 text-center"><dt className="flex items-center justify-center gap-1 text-[10px] text-slate-500"><Icon className="hidden h-3 w-3 sm:block" aria-hidden="true" />{label}</dt><dd className="mt-1 text-xs font-bold tabular-nums text-slate-800">{value}</dd></div>)}
          </dl>
        </section>
        <HourlyOutlookChart key={day.date} day={day} />
      </> : <p role="status" className="py-8 text-center text-sm text-slate-500">Daily forecast details are unavailable.</p>}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
      <div className="min-w-0"><WeatherAttribution source="Open-Meteo" /><p className="mt-0.5 text-[10px] text-slate-500">{alert.data?.retrievedAt ? 'Retrieved' : 'Issued'} {forecastTime(updated)} · PHT</p></div>
      <button type="button" onClick={onClose} className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700">Done</button>
    </footer>
  </Dialog>;
}
