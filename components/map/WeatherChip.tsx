'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, CloudSun, Droplet, Loader2 } from 'lucide-react';
import { usableCurrentWeather } from '@/lib/weather/weather';
import { usePointOutlook } from '@/hooks/usePointOutlook';
import { getWeatherCondition, isDaytimeInManila } from '@/lib/weather/weatherCodes';
import { manilaDayKey, outlookDayLabel, outlookDays, weatherTime } from '@/lib/weather/outlook';
import { dailyRainMetric, hourlyRainSeries } from '@/lib/weather/hourlyOutlook';
import { WeatherAttribution } from '../weather/WeatherAttribution';
import { RainStrip } from '../weather/RainStrip';
import { WeatherAlertModal } from '../WeatherAlertModal';
import type { CurrentWeather, WeatherAlert, WeatherDayData } from '@/types/weather';

const numberLabel = (value: number | null | undefined, suffix = '') => value != null && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : '—';

function WeatherForecastContent({ current, days, now, loading, delayed, onSelectDay, locationLabel, source }: {
  source?: string;
  locationLabel: string;
  current: CurrentWeather | null;
  days: WeatherDayData[];
  now: number;
  loading: boolean;
  delayed: boolean;
  onSelectDay: (date: string) => void;
}) {
  const first = days[0];
  const currentRain = current?.precipitation;
  const currentRainLabel = typeof currentRain === 'number' && Number.isFinite(currentRain) && currentRain >= 0
    ? `${currentRain.toFixed(1)} mm` : 'Unavailable';
  const condition = current ? getWeatherCondition(current.conditionCode, isDaytimeInManila(current.observedAt))
    : first ? getWeatherCondition(first.conditionCode) : null;
  const Icon = condition?.icon ?? CloudSun;
  const probabilities = first?.hourlyProbabilities;
  const hasProbabilities = Boolean(first && hourlyRainSeries(first, 'chance'));
  const hasRainHours = Boolean(first && hourlyRainSeries(first, 'amount'));

  return <>
    {condition ? <div className="flex items-center gap-3 px-0.5 pb-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100/80 text-slate-600"><Icon className="h-6 w-6" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-800">{condition.label}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">{current ? `${weatherTime(current.observedAt)} PHT` : `${outlookDayLabel(first.date, now)} forecast · PHT`}</p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        {current ? <p className="text-2xl font-semibold leading-none tracking-tight text-slate-900">{numberLabel(current.temperature, '°')}<span className="ml-0.5 align-top text-[10px] font-medium text-slate-400">C</span></p>
          : <p className="text-lg font-semibold text-slate-900">{numberLabel(first.tempMax, '°')}<span className="ml-1 text-sm font-medium text-slate-400">{numberLabel(first.tempMin, '°')}</span></p>}
        {current && <p aria-label={`Current rainfall: ${currentRainLabel}`} title="Current rainfall"
          className="mt-1 flex items-center justify-end gap-1 whitespace-nowrap text-[10px] text-sky-700">
          <Droplet className="h-3 w-3" aria-hidden="true" />{currentRainLabel}
        </p>}
      </div>
    </div> : <p role="status" className="flex items-center gap-2 py-2 text-xs text-slate-500">{loading && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}{loading ? 'Loading weather…' : 'Weather is temporarily unavailable.'}</p>}

    {first ? <>
      <section className="rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2.5" aria-label={`${outlookDayLabel(first.date, now)} rain outlook`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold text-sky-800" title={`${dailyRainMetric(first).label}${first.partialDay ? ' · remaining hours' : ''}`}>{outlookDayLabel(first.date, now)} · {first.rainChance != null ? 'peak rain chance' : 'rainfall'}</p>
            <p className="mt-1 text-2xl font-semibold leading-none tracking-tight text-slate-900 tabular-nums">{dailyRainMetric(first).value}</p>
          </div>
          <div className="text-right">
            <button type="button" onClick={() => onSelectDay(first.date)} className="inline-flex items-center gap-0.5 rounded-md py-0.5 pl-1 text-[10px] font-semibold text-sky-800 hover:text-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600" aria-label={`View ${outlookDayLabel(first.date, now)} weather details`}>Details<ChevronRight className="h-3 w-3" /></button>
            <p className="mt-1 text-[10px] text-slate-500">{first.rainMm != null && Number.isFinite(first.rainMm) ? `${first.rainMm.toFixed(1)} mm ${first.partialDay ? "remaining" : "forecast"}` : 'Rain amount unavailable'}</p>
          </div>
        </div>
        {hasProbabilities || hasRainHours ? <div className="mt-2 border-t border-sky-100 pt-2">
          <p className="text-[9px] font-medium text-sky-800/80">{hasProbabilities ? 'Rain chance · % · hour ending · PHT' : 'Rainfall · mm · hour ending · PHT'}</p>
          <RainStrip hours={first.hours} probabilities={probabilities} />
        </div> : <p className="mt-2 text-[10px] text-slate-500">Hourly breakdown unavailable</p>}
      </section>

      <section className="pt-2" aria-label="Five-day forecast">
        <div className="mb-1.5 flex items-center justify-between text-[9px] font-medium text-slate-500"><span>{days.length}-day forecast</span><span>High / low · {first ? dailyRainMetric(first).shortLabel : 'rainfall'}</span></div>
        <div className="grid grid-cols-5 gap-0.5">
          {days.map(day => {
            const DayIcon = getWeatherCondition(day.conditionCode).icon;
            const label = outlookDayLabel(day.date, now);
            return <button key={day.date} type="button" onClick={() => onSelectDay(day.date)}
              aria-label={`${label}, ${day.date}: ${getWeatherCondition(day.conditionCode).label}, high ${numberLabel(day.tempMax)} and low ${numberLabel(day.tempMin)} degrees Celsius, ${dailyRainMetric(day).value} ${dailyRainMetric(day).label.toLowerCase()}. View details.`}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 py-2 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 ${day.date === manilaDayKey(now) ? 'bg-slate-100/70' : ''}`}>
              <span className="text-[10px] font-semibold text-slate-600">{label}</span>
              <DayIcon className="my-0.5 h-4 w-4 text-slate-600" aria-hidden="true" />
              <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-slate-900">{numberLabel(day.tempMax, '°')}<span className="ml-0.5 font-medium text-slate-400">{numberLabel(day.tempMin, '°')}</span></span>
              <span className="flex items-center gap-0.5 text-[9px] font-medium tabular-nums text-sky-700"><Droplet className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />{dailyRainMetric(day).value}</span>
            </button>;
          })}
        </div>
      </section>
    </> : condition && <p role="status" className="py-2 text-xs text-slate-500">{loading ? 'Loading forecast…' : 'Forecast temporarily unavailable.'}</p>}

    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 pt-1.5 text-[9px] text-slate-500">
      <span role="status" className={delayed ? 'text-amber-700' : ''}>{delayed ? 'Updates delayed' : `${locationLabel} · PHT`}</span>
      <WeatherAttribution source={source} />
    </div>
  </>;
}

/** Compact map weather card, with usable current-only and unavailable states. */
export function WeatherChip({ className = '', defaultExpanded = false, open: controlledOpen, onToggle, isSidebarItem = false }: {
  className?: string;
  defaultExpanded?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  isSidebarItem?: boolean;
}) {
  const feed = usePointOutlook();
  const outlook = feed.data;
  const digest: WeatherAlert | null = outlook ? {
    id: `outlook:${outlook.location.latitude}:${outlook.location.longitude}:${outlook.retrievedAt}`,
    alertType: 'daily_digest', severity: 'info', validFrom: outlook.retrievedAt,
    validTo: outlook.validTo, createdAt: outlook.retrievedAt,
    data: { days: outlook.days, source: outlook.source, retrievedAt: outlook.retrievedAt, location: outlook.location },
  } : null;
  const [now, setNow] = useState(() => Date.now());
  const current = usableCurrentWeather(outlook?.current ?? null, now);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(() => defaultExpanded && typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);
  const contentId = useId();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => onToggle ? onToggle(next) : setInternalOpen(next);
  const days = outlookDays(digest?.data?.days ?? [], now);
  const delayed = Boolean(feed.error);
  const loading = feed.status === 'idle' || feed.status === 'loading';
  const condition = current ? getWeatherCondition(current.conditionCode, isDaytimeInManila(current.observedAt))
    : days[0] ? getWeatherCondition(days[0].conditionCode) : null;
  const PillIcon = condition?.icon ?? CloudSun;
  const numericLabel = current ? numberLabel(current.temperature, '°') : days[0] ? dailyRainMetric(days[0]).value : loading ? 'Loading' : 'Unavailable';
  const forecastContent = <WeatherForecastContent source={outlook?.source} current={current} days={days} now={now} loading={loading} delayed={delayed}
    onSelectDay={setSelectedDayDate} locationLabel={outlook?.location.label ?? 'Iligan City'} />;

  const header = <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={contentId}
    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-bold text-slate-900 transition-colors hover:bg-slate-50/60">
    <span className="flex min-w-0 items-center gap-2"><PillIcon className="h-4 w-4 shrink-0 text-gakit-maroon" aria-hidden="true" /><span className="truncate">Weather Outlook</span>
      {!open && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">{numericLabel}</span>}</span>
    {open ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
  </button>;

  return <div className={className}>
    {isSidebarItem || open ? <div className={`${isSidebarItem ? 'w-full' : 'w-72 max-w-[calc(100vw-2rem)]'} hud-card overflow-hidden`}>
      {header}
      {open && <div id={contentId} className={`${isSidebarItem ? '' : 'max-h-[60dvh] overflow-y-auto'} border-t border-slate-100/80 px-3 pb-2.5 pt-3`}>{forecastContent}</div>}
    </div> : <button type="button" onClick={() => setOpen(true)} aria-label="Show weather outlook" aria-expanded={false}
      className="flex items-center gap-2 px-3 py-2.5 hud-pill transition-colors hover:bg-white"
      title={condition ? `${condition.label} · ${numericLabel}` : 'Weather outlook'}>
      <PillIcon className="h-5 w-5 text-gakit-maroon" aria-hidden="true" /><span className="text-xs font-semibold tabular-nums text-slate-700">{numericLabel}</span>
    </button>}
    {selectedDayDate && digest && <WeatherAlertModal alert={digest} highlightDate={selectedDayDate} onClose={() => setSelectedDayDate(null)} />}
  </div>;
}
