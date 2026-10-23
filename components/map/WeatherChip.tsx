'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, CloudSun, Droplet, Loader2, Umbrella } from 'lucide-react';
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

  const rainMetric = first ? dailyRainMetric(first) : null;
  const hasDailyChance = rainMetric?.shortLabel === 'peak chance';
  const forecastRainLabel = first && typeof first.rainMm === 'number' && Number.isFinite(first.rainMm) && first.rainMm >= 0
    ? `${first.rainMm.toFixed(1)} mm` : '—';

  return <>
    {condition ? <div className="flex items-center gap-3 pb-2.5" role="group" aria-label="Current weather">
      <span role="img" aria-label={condition.label} title={condition.label} className="flex h-11 w-11 shrink-0 items-center justify-center text-sky-600">
        <Icon className="h-9 w-9" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 tabular-nums">
        <p className="mb-1 text-xs font-medium leading-4 text-slate-500">{condition.label}</p>
        {current ? <p aria-label={`Current temperature: ${numberLabel(current.temperature)} degrees Celsius`} className="text-[32px] font-semibold leading-none tracking-tight text-slate-900">
          {numberLabel(current.temperature, '°')}<span className="ml-0.5 align-top text-xs font-medium text-slate-400">C</span>
        </p> : <p title="Forecast high and low" className="text-2xl font-semibold text-slate-900">{numberLabel(first.tempMax, '°')}<span className="ml-1.5 text-base font-medium text-slate-400">{numberLabel(first.tempMin, '°')}</span></p>}
      </div>
      {current && <p aria-label={`Current rainfall: ${currentRainLabel}`} title="Current rainfall"
        className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium tabular-nums text-sky-700">
        <Droplet className="h-3.5 w-3.5" aria-hidden="true" />{currentRainLabel === 'Unavailable' ? '—' : currentRainLabel}
      </p>}
    </div> : <p role="status" className="flex items-center gap-2 py-2 text-xs text-slate-500">{loading && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}{loading ? 'Loading weather…' : 'Weather is temporarily unavailable.'}</p>}

    {first && rainMetric ? <>
      <section className="border-t border-slate-100 py-2" aria-label={`${outlookDayLabel(first.date, now)} rain outlook`}>
        <button type="button" onClick={() => onSelectDay(first.date)}
          aria-label={`View ${outlookDayLabel(first.date, now)} weather details`}
          title={`${rainMetric.label}: ${rainMetric.value}${first.partialDay ? ' · remaining hours' : ''}`}
          className="flex w-full items-end justify-between gap-3 rounded-md pb-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600">
          <span className="space-y-1">
            <span className="block text-[10px] font-semibold text-slate-500">{outlookDayLabel(first.date, now)}</span>
            <span className="flex items-center gap-1.5 text-sky-700">
              {hasDailyChance ? <Umbrella className="h-4 w-4" aria-hidden="true" /> : <Droplet className="h-4 w-4" aria-hidden="true" />}
              <span className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-slate-900">{rainMetric.value === 'Unavailable' ? '—' : rainMetric.value}</span>
            </span>
          </span>
          <span className="flex items-center gap-2 pb-0.5">
            {hasDailyChance && <span title={first.partialDay ? 'Remaining rainfall' : 'Forecast rainfall'} className="flex items-center gap-1 text-xs font-medium tabular-nums text-sky-700"><Droplet className="h-3 w-3" aria-hidden="true" />{forecastRainLabel}</span>}
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          </span>
        </button>
        {hasProbabilities || hasRainHours ? <RainStrip hours={first.hours} probabilities={probabilities} compact />
          : <span className="sr-only">Hourly breakdown unavailable</span>}
      </section>

      <section className="border-t border-slate-100 pt-2" aria-label="Five-day forecast">
        <div className="grid grid-cols-5 gap-1">
          {days.map(day => {
            const dayCondition = getWeatherCondition(day.conditionCode);
            const DayIcon = dayCondition.icon;
            const label = outlookDayLabel(day.date, now);
            const metric = dailyRainMetric(day);
            return <button key={day.date} type="button" onClick={() => onSelectDay(day.date)}
              aria-label={`${label}, ${day.date}: ${dayCondition.label}, high ${numberLabel(day.tempMax)} and low ${numberLabel(day.tempMin)} degrees Celsius, ${metric.value} ${metric.label.toLowerCase()}. View details.`}
              title={dayCondition.label}
              className={`flex min-w-0 flex-col items-center gap-1.5 rounded-lg px-0.5 py-2 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 ${day.date === manilaDayKey(now) ? 'bg-slate-50' : ''}`}>
              <span className="text-[10px] font-semibold leading-4 text-slate-600">{label}</span>
              <DayIcon className="h-5 w-5 text-sky-600" strokeWidth={1.5} aria-hidden="true" />
              <span className="whitespace-nowrap text-[10px] font-semibold leading-4 tabular-nums text-slate-900">{numberLabel(day.tempMax, '°')}<span className="ml-1 font-medium text-slate-400">{numberLabel(day.tempMin, '°')}</span></span>
              <span className="flex items-center gap-0.5 text-[9px] font-medium leading-4 tabular-nums text-sky-700"><Droplet className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />{metric.value === 'Unavailable' ? '—' : metric.value}</span>
            </button>;
          })}
        </div>
      </section>
    </> : condition && <p role="status" className="py-2 text-xs text-slate-500">{loading ? 'Loading forecast…' : 'Forecast temporarily unavailable.'}</p>}

    <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[9px] text-slate-500">
      <span role="status" title={`${locationLabel}${current ? ' · ' + weatherTime(current.observedAt) + ' PHT' : ' · PHT'}`} className={`min-w-0 truncate ${delayed ? 'text-amber-700' : ''}`}>
        {delayed ? 'Updates delayed' : `${locationLabel}${current ? ' · ' + weatherTime(current.observedAt) : ''}`}
      </span>
      <WeatherAttribution source={source} compact className="shrink-0" />
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
      {open && <div id={contentId} className={`${isSidebarItem ? '' : 'max-h-[60dvh] overflow-y-auto'} border-t border-slate-100/80 px-3 pb-2.5 pt-2.5`}>{forecastContent}</div>}
    </div> : <button type="button" onClick={() => setOpen(true)} aria-label="Show weather outlook" aria-expanded={false}
      className="flex items-center gap-2 px-3 py-2.5 hud-pill transition-colors hover:bg-white"
      title={condition ? `${condition.label} · ${numericLabel}` : 'Weather outlook'}>
      <PillIcon className="h-5 w-5 text-gakit-maroon" aria-hidden="true" /><span className="text-xs font-semibold tabular-nums text-slate-700">{numericLabel}</span>
    </button>}
    {selectedDayDate && digest && <WeatherAlertModal alert={digest} highlightDate={selectedDayDate} onClose={() => setSelectedDayDate(null)} />}
  </div>;
}
