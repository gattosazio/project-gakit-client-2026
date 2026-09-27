import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CloudRain, AlertTriangle, Flame, Thermometer, X, Droplet } from 'lucide-react';
import type { CurrentWeather, WeatherAlert, AlertSeverity, AlertType, WeatherDayData } from '@/types/weather';
import { alertTitle, digestPeriod, formatDayForecast, getWeatherCondition } from '@/lib/weather/weatherCodes';
import { hazardSummary, isPagasaAlert, otherProvinceCount, parseLocalTowns, shortTitle } from '@/lib/weather/pagasa';
import { WeatherAttribution } from './weather/WeatherAttribution';
import { CurrentConditions } from './weather/CurrentConditions';
import { RainStrip } from './weather/RainStrip';

const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { text: string; badge: string; icon: string; dot: string }
> = {
  critical: {
    text: 'text-red-700',
    badge: 'bg-red-50 text-red-700',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
  warning: {
    text: 'text-orange-700',
    badge: 'bg-orange-50 text-orange-700',
    icon: 'text-orange-500',
    dot: 'bg-orange-500',
  },
  info: {
    text: 'text-blue-700',
    badge: 'bg-blue-50 text-blue-700',
    icon: 'text-blue-500',
    dot: 'bg-blue-500',
  },
};

const ALERT_ICONS: Record<AlertType, typeof CloudRain> = {
  thunderstorm: AlertTriangle,
  heavy_rain: CloudRain,
  extreme_heat: Flame,
  daily_digest: Thermometer,
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  thunderstorm: 'Thunderstorm',
  heavy_rain: 'Heavy Rain',
  extreme_heat: 'Heat Advisory',
  daily_digest: 'Daily Forecast',
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today, Sep 27", "Tomorrow, Sep 28", or "Sat, Aug 25" */
function friendlyDay(iso: string): string {
  const target = new Date(iso);
  const dayDiff = Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);
  const date = target.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

  if (dayDiff === 0) return `Today, ${date}`;
  if (dayDiff === 1) return `Tomorrow, ${date}`;
  if (dayDiff === -1) return `Yesterday, ${date}`;

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

interface WeatherAlertModalProps {
  alert: WeatherAlert;
  /** ISO date of the day to emphasize (e.g. the card the user clicked). */
  highlightDate?: string;
  /** Live conditions snapshot; rendered above the body when provided. */
  current?: CurrentWeather | null;
  onClose: () => void;
}

export function WeatherAlertModal({ alert, highlightDate, current, onClose }: WeatherAlertModalProps) {
  const mounted = useMounted();
  const days = alert.data?.days ?? [];
  const [selectedDate, setSelectedDate] = useState<string>(() => highlightDate || (days[0]?.date ?? ''));
  const [townsExpanded, setTownsExpanded] = useState(false);
  const [expandedFor, setExpandedFor] = useState(alert.id);
  if (expandedFor !== alert.id) {
    setExpandedFor(alert.id);
    setTownsExpanded(false);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const config = SEVERITY_CONFIG[alert.severity];
  const Icon = ALERT_ICONS[alert.alertType] ?? CloudRain;
  const pagasa = isPagasaAlert(alert);
  const heading = pagasa ? shortTitle(alert) || alertTitle(alert) : alertTitle(alert);
  const towns = pagasa ? parseLocalTowns(alert) : [];
  const summary = pagasa ? hazardSummary(alert) : null;
  const otherCount = pagasa ? otherProvinceCount(alert) : 0;
  const fullText = alert.data?.rawText ?? alert.data?.description ?? '';
  const showFull = pagasa && fullText.trim().length > (summary ?? '').length + 40;
  const visibleTowns = townsExpanded ? towns : towns.slice(0, 7);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  const activeDay = days.find((d) => d.date === selectedDate) ?? days[0];
  const activeCondition = activeDay ? getWeatherCondition(activeDay.conditionCode) : null;
  const ActiveIcon = activeCondition ? activeCondition.icon : CloudRain;
  const activeDetail = activeDay ? formatDayForecast(activeDay) : '';

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-canvas-grey p-4 md:px-5 md:py-4">
          <div className="flex items-center gap-3">
            <span className={`rounded-xl p-2.5 ${config.badge}`}>
              <Icon className={`h-5 w-5 ${config.icon}`} />
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${config.badge}`}>
                {ALERT_TYPE_LABELS[alert.alertType]}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${config.badge}`}>
                {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
              </span>
              {alert.data?.source && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  {alert.data.source}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-canvas-light hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{heading}</h3>
            <p className="text-[10px] text-slate-400">
              {alert.alertType === 'daily_digest' && digestPeriod(alert)
                ? digestPeriod(alert)
                : alert.data?.issuedAt
                ? `Issued ${new Date(alert.data.issuedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} · Valid until ${new Date(alert.validTo).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : `Issued ${new Date(alert.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
            </p>
          </div>

          {current && (
            <CurrentConditions current={current} />
          )}

          {days.length > 0 ? (
            <div className="space-y-3">
              {/* 5-Day Horizontal Tab Selector */}
              <div className="grid grid-cols-5 gap-1.5">
                {days.map((day) => {
                  const isSelected = day.date === (activeDay?.date ?? '');
                  const dayCondition = getWeatherCondition(day.conditionCode);
                  const DayIcon = dayCondition.icon;
                  const shortName = friendlyShortDay(`${day.date}T00:00:00+08:00`);

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDate(day.date)}
                      className={`flex flex-col items-center justify-between rounded-xl p-2 text-center transition-colors duration-150 ${
                        isSelected
                          ? 'bg-white text-slate-900 shadow-md ring-2 ring-gakit-maroon font-bold'
                          : 'bg-canvas-light text-slate-600 hover:bg-slate-100/80 ring-1 ring-canvas-grey'
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${isSelected ? 'text-gakit-maroon' : 'text-slate-400'}`}>
                        {shortName}
                      </span>
                      <div className={`my-1.5 flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isSelected ? 'bg-maroon-50/80 ring-1 ring-maroon-200/60' : 'bg-white shadow-2xs ring-1 ring-canvas-grey'}`}>
                        <DayIcon className={`h-4 w-4 ${isSelected ? 'text-gakit-maroon' : 'text-slate-600'}`} />
                      </div>
                      <div className="flex items-center gap-0.5 text-[10px] tabular-nums font-bold leading-none">
                        <span className="text-slate-900">{day.tempMax}°</span>
                        <span className="text-slate-400 font-normal text-[9px]">{day.tempMin}°</span>
                      </div>
                      <span className={`mt-1 flex items-center justify-center gap-0.5 text-[9px] font-semibold tabular-nums leading-none ${day.rainChance > 0 ? 'text-sky-600' : 'text-slate-400'}`}>
                        {day.rainChance > 0 && <Droplet className="h-2.5 w-2.5 text-sky-500 fill-sky-500/30 shrink-0" />}
                        <span>{day.rainChance}%</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Day Detail Card */}
              {activeDay && (
                <div className="rounded-xl bg-canvas-light p-3.5 ring-1 ring-canvas-grey space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs ring-1 ring-canvas-grey">
                        <ActiveIcon className="h-5 w-5 text-gakit-maroon" />
                      </span>
                      <div>
                        <span className="block text-sm font-bold text-slate-900">
                          {friendlyDay(`${activeDay.date}T00:00:00+08:00`)}
                        </span>
                        <span className="block text-xs font-medium text-slate-500">
                          {activeDetail}
                        </span>
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-base font-bold text-slate-900">
                        {activeDay.tempMax}°
                        <span className="ml-1 text-xs font-normal text-slate-400">/ {activeDay.tempMin}°</span>
                      </div>
                    </div>
                  </div>

                  {/* Hourly Rain Timeline */}
                  {activeDay.hours && activeDay.hours.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Hourly Rainfall Timeline (mm)
                      </div>
                      <RainStrip hours={activeDay.hours} />
                    </div>
                  )}

                  {/* Key Day Metrics */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-center">
                    <div className="rounded-lg bg-white p-2 shadow-2xs ring-1 ring-canvas-grey">
                      <span className="block text-[10px] text-slate-400 font-medium">Precipitation</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">{activeDay.rainMm.toFixed(1)} mm</span>
                    </div>
                    <div className="rounded-lg bg-white p-2 shadow-2xs ring-1 ring-canvas-grey">
                      <span className="block text-[10px] text-slate-400 font-medium">Peak Wind</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">{activeDay.windMax} km/h</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : pagasa ? (
            <div className="space-y-3 mb-4">
              {summary && (
                <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
              )}
              {towns.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70 text-xs">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Affected areas
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleTowns.map((town) =>
                      /iligan/i.test(town) ? (
                        <span
                          key={town}
                          title="Your area"
                          className="inline-block rounded-md bg-maroon-50 px-2 py-0.5 text-xs font-bold text-gakit-maroon border border-maroon-200/80 shadow-2xs"
                        >
                          {town}
                        </span>
                      ) : (
                        <span
                          key={town}
                          className="inline-block rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200 shadow-2xs"
                        >
                          {town}
                        </span>
                      )
                    )}
                    {towns.length > visibleTowns.length && (
                      <button
                        type="button"
                        onClick={() => setTownsExpanded(true)}
                        className="inline-block rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-gakit-maroon border border-maroon-200/70 hover:bg-maroon-50 transition-colors"
                      >
                        +{towns.length - visibleTowns.length} more
                      </button>
                    )}
                    {townsExpanded && towns.length > 7 && (
                      <button
                        type="button"
                        onClick={() => setTownsExpanded(false)}
                        className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                </div>
              )}
              {otherCount > 0 && (
                <p className="text-[11px] text-slate-400">
                  + also covering {otherCount} other province{otherCount === 1 ? '' : 's'}.
                </p>
              )}
              {showFull && (
                <details className="rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">
                    Full bulletin
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-xs text-slate-600 leading-relaxed">
                    {fullText.trim()}
                  </p>
                </details>
              )}
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              <p className="whitespace-pre-line text-sm text-slate-700 leading-relaxed">
                {alert.data?.description ?? ''}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-canvas-grey p-4 md:px-5 md:py-3.5">
          <WeatherAttribution source={alert.data?.source ?? (alert.alertType === 'daily_digest' ? 'Open-Meteo' : 'DOST-PAGASA MINPRSD')} />
          <button
            onClick={onClose}
            className="rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
