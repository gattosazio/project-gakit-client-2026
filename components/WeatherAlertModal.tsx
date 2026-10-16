import { useId, useState } from 'react';
import { CloudRain, X, Droplet, MapPin } from 'lucide-react';
import type { WeatherAlert, AlertSeverity } from '@/types/weather';
import { alertDescription, alertTitle, digestPeriod, formatDayForecast, getWeatherCondition } from '@/lib/weather/weatherCodes';
import { ALERT_ICONS, ALERT_TYPE_LABELS } from '@/lib/weather/alertLabels';
import { hazardSummary, isPagasaAlert, otherProvinceCount, parseLocalTowns, shortTitle } from '@/lib/weather/pagasa';
import { WeatherAttribution } from './weather/WeatherAttribution';
import { RainStrip } from './weather/RainStrip';
import { Dialog } from '@/components/ui/Dialog';
import { WeatherOutlookModal } from './weather/WeatherOutlookModal';

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

function alertDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

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
  allAlerts?: WeatherAlert[];
  /** ISO date of the day to emphasize (e.g. the card the user clicked). */
  highlightDate?: string;
  onClose: () => void;
}

export function WeatherAlertModal({ alert, highlightDate, onClose }: WeatherAlertModalProps) {
  return alert.alertType === 'daily_digest'
    ? <WeatherOutlookModal key={`${alert.id}:${highlightDate ?? ''}`} alert={alert} highlightDate={highlightDate} onClose={onClose} />
    : <AdvisoryWeatherAlertModal alert={alert} highlightDate={highlightDate} onClose={onClose} />;
}

function AdvisoryWeatherAlertModal({ alert, highlightDate, onClose }: WeatherAlertModalProps) {
  const activeAlert = alert;
  const titleId = useId();

  const days = activeAlert.data?.days ?? [];
  const [selectedDate, setSelectedDate] = useState<string>(() => highlightDate || (days[0]?.date ?? ''));
  const [townsExpanded, setTownsExpanded] = useState(false);
  const [expandedFor, setExpandedFor] = useState(activeAlert.id);
  if (expandedFor !== activeAlert.id) {
    setExpandedFor(activeAlert.id);
    setTownsExpanded(false);
  }

  const config = SEVERITY_CONFIG[activeAlert.severity];
  const Icon = ALERT_ICONS[activeAlert.alertType] ?? CloudRain;
  const pagasa = isPagasaAlert(activeAlert);
  const heading = pagasa ? shortTitle(activeAlert) || alertTitle(activeAlert) : alertTitle(activeAlert);
  const localTowns = pagasa ? parseLocalTowns(activeAlert) : [];
  const towns = [...new Set(localTowns.length ? localTowns : activeAlert.data?.affectedAreas?.filter(Boolean) ?? [])];
  const summary = (pagasa ? hazardSummary(activeAlert) : null) || activeAlert.data?.description?.trim() || alertDescription(activeAlert);
  const otherCount = pagasa ? otherProvinceCount(activeAlert) : 0;
  const fullText = activeAlert.data?.rawText ?? activeAlert.data?.description ?? '';
  const showFull = fullText.trim() !== summary.trim() && fullText.trim().length > 0;
  const visibleTowns = townsExpanded ? towns : towns.slice(0, 7);

  const activeDay = days.find((d) => d.date === selectedDate) ?? days[0];
  const activeCondition = activeDay ? getWeatherCondition(activeDay.conditionCode) : null;
  const ActiveIcon = activeCondition ? activeCondition.icon : CloudRain;
  const activeDetail = activeDay ? formatDayForecast(activeDay) : '';

  return (
    <Dialog
      isOpen
      onClose={onClose}
      ariaLabelledBy={titleId}
      maxWidthClass="max-w-xl"
      panelClassName="relative flex max-h-[90dvh] flex-col overflow-hidden border border-canvas-grey"
    >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className={`mt-0.5 shrink-0 rounded-xl p-2 ${config.badge}`}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide">
                <span className="text-slate-500">{ALERT_TYPE_LABELS[activeAlert.alertType]}</span>
                <span className={`rounded px-1.5 py-0.5 ${config.badge}`}>{activeAlert.severity}</span>
                {activeAlert.data?.bulletinNumber != null && <span className="text-slate-400">Bulletin #{activeAlert.data.bulletinNumber}</span>}
              </div>
              <h3 id={titleId} className="text-sm font-bold leading-5 text-slate-900">{heading}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close weather alert"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <dl className="grid grid-cols-2 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 py-2.5">
            <div className="px-3"><dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Issued · PHT</dt><dd className="mt-1 text-[11px] font-semibold text-slate-700">{alertDateTime(activeAlert.data?.issuedAt || activeAlert.createdAt)}</dd></div>
            <div className="px-3"><dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Valid until · PHT</dt><dd className="mt-1 text-[11px] font-semibold text-slate-700">{alertDateTime(activeAlert.validTo)}</dd></div>
          </dl>
          {activeAlert.alertType === 'daily_digest' && digestPeriod(activeAlert) && <p className="text-[11px] font-medium text-slate-500">{digestPeriod(activeAlert)}</p>}

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
                      <span className={`mt-1 flex items-center justify-center gap-0.5 text-[9px] font-semibold tabular-nums leading-none ${(day.rainChance ?? 0) > 0 ? 'text-sky-600' : 'text-slate-400'}`}>
                        {(day.rainChance ?? 0) > 0 && <Droplet className="h-2.5 w-2.5 text-sky-500 fill-sky-500/30 shrink-0" />}
                        <span>{day.rainChance == null ? 'Unavailable' : `${day.rainChance}%`}</span>
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
                  {((activeDay.hourlyProbabilities && activeDay.hourlyProbabilities.length > 0) ||
                    (activeDay.hours && activeDay.hours.length > 0)) && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Hourly Precipitation Chance
                      </div>
                      <RainStrip
                        hours={activeDay.hours}
                        probabilities={activeDay.hourlyProbabilities}
                      />
                    </div>
                  )}

                  {/* Key Day Metrics */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center">
                    <div className="rounded-lg bg-white p-2 shadow-2xs ring-1 ring-canvas-grey">
                      <span className="block text-[10px] text-slate-400 font-medium">Rain chance</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">{activeDay.rainChance}%</span>
                    </div>
                    <div className="rounded-lg bg-white p-2 shadow-2xs ring-1 ring-canvas-grey">
                      <span className="block text-[10px] text-slate-400 font-medium">Precipitation</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">~{activeDay.rainMm.toFixed(1)} mm</span>
                    </div>
                    <div className="rounded-lg bg-white p-2 shadow-2xs ring-1 ring-canvas-grey">
                      <span className="block text-[10px] text-slate-400 font-medium">Peak Wind</span>
                      <span className="text-xs font-bold text-slate-800 tabular-nums">{activeDay.windMax} km/h</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {summary && (
                <div className={`rounded-xl border border-slate-200 border-l-[3px] bg-slate-50/70 p-3 ${activeAlert.severity === 'critical' ? 'border-l-red-500' : activeAlert.severity === 'warning' ? 'border-l-orange-500' : 'border-l-blue-500'}`}>
                  <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Advisory summary</h4>
                  <p className="whitespace-pre-line text-xs leading-5 text-slate-700">{summary}</p>
                </div>
              )}
              {towns.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70 text-xs">
                  <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"><MapPin className="h-3 w-3" />Affected areas <span className="ml-auto rounded-full bg-white px-1.5 text-slate-400">{towns.length}</span></h4>
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
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 sm:px-5">
          <WeatherAttribution source={activeAlert.data?.source ?? (activeAlert.alertType === 'daily_digest' ? 'Open-Meteo' : 'DOST-PAGASA MINPRSD')} />
          <button
            onClick={onClose}
            className="rounded-lg bg-gakit-maroon px-3 py-1.5 text-xs font-semibold text-white hover:bg-maroon-800 transition-colors"
          >
            Close
          </button>
        </div>
    </Dialog>
  );
}
