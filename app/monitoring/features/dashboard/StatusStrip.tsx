'use client';

import { useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
} from 'lucide-react';
import { WeatherAlertModal } from '@/components/WeatherAlertModal';
import { AmbientWeatherIcon } from '@/components/weather/AmbientWeatherIcon';
import { WeatherCanvasBackdrop } from '@/components/weather/WeatherCanvasBackdrop';
import { alertTitle, getWeatherCondition, isDaytimeInManila } from '@/lib/weather/weatherCodes';
import { ALERT_TYPE_LABELS } from '@/lib/weather/alertLabels';
import { isPagasaAlert, shortTitle } from '@/lib/weather/pagasa';
import type { CurrentWeather, WeatherAlert } from '@/types/weather';

interface StatusStripProps {
  current: CurrentWeather | null;
  alerts: WeatherAlert[] | null;
  alertsCheckedAt?: string | null;
  alertsError?: boolean;
  currentError?: boolean;
  asOf?: string;
}

const SEVERITY_CHIP: Record<string, string> = {
  critical: 'bg-red-50 text-red-900 border-red-200 hover:bg-red-100/70',
  warning: 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100/70',
  info: 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100/70',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Advisory',
};

function manilaTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')}, ${get('month')} ${get('day')} · ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function StatusStrip({ current, alerts, alertsCheckedAt, alertsError = false, currentError = false, asOf }: StatusStripProps) {
  const [alertPage, setAlertPage] = useState(0);

  const activeAlerts = useMemo(
    () => (alerts ?? []).filter((alert) => alert.alertType !== 'daily_digest' && (
      !asOf || (Date.parse(alert.validFrom) <= Date.parse(asOf) && Date.parse(alert.validTo) > Date.parse(asOf))
    )),
    [alerts, asOf]
  );
  const advisoryUnknown = alerts === null || alertsError;
  const digest = useMemo(
    () => (alerts ?? []).find((alert) => alert.alertType === 'daily_digest') ?? null,
    [alerts]
  );
  const [modalAlert, setModalAlert] = useState<WeatherAlert | null>(null);

  const sortedAlerts = useMemo(() => {
    const weight: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return [...activeAlerts].sort(
      (a, b) => (weight[a.severity] ?? 3) - (weight[b.severity] ?? 3)
    );
  }, [activeAlerts]);

  const ADVISORIES_PER_PAGE = 2;
  const totalAlertPages = Math.ceil(sortedAlerts.length / ADVISORIES_PER_PAGE);
  const currentAlertPage = totalAlertPages > 0 ? alertPage % totalAlertPages : 0;
  const pageAlerts = sortedAlerts.slice(
    currentAlertPage * ADVISORIES_PER_PAGE,
    currentAlertPage * ADVISORIES_PER_PAGE + ADVISORIES_PER_PAGE
  );

  const condition = current
    ? getWeatherCondition(current.conditionCode, isDaytimeInManila(current.observedAt))
    : null;

  const isNight = current ? !isDaytimeInManila(current.observedAt) : false;
  const isThunder = current
    ? current.conditionCode >= 95 && current.conditionCode <= 99
    : false;
  const isDarkAtmosphere = isNight || isThunder;

  return (
    <div className="flex flex-col gap-2">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 min-w-0">
          {/* Left Segment: Environmental Telemetry (Iligan City) */}
          {current && condition ? (
            <button
              type="button"
              onClick={() => {
                if (digest) setModalAlert(digest);
              }}
              disabled={!digest}
              title={digest ? 'Open weather forecast for Iligan City' : 'Current conditions from Open-Meteo'}
              aria-haspopup="dialog"
              className={`group relative overflow-hidden flex flex-col justify-between p-3.5 sm:px-4 sm:py-3 text-left transition-colors min-w-0 ${
                isDarkAtmosphere
                  ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white hover:from-slate-900 hover:to-indigo-900'
                  : 'bg-gradient-to-br from-sky-200/90 via-sky-100/70 to-sky-50/50 text-slate-900 hover:from-sky-200 hover:to-sky-100/60'
              }`}
            >
              <WeatherCanvasBackdrop
                paused={modalAlert !== null}
                conditionCode={current.conditionCode}
                observedAt={current.observedAt}
              />

              <div className="relative z-10 flex items-center justify-between gap-2 min-w-0 mb-1.5 w-full">
                <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                  isDarkAtmosphere ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Iligan City · {manilaTimestamp(new Date(current.observedAt))} PHT{currentError ? ' · Update delayed' : ''}
                </span>
                {digest && (
                  <span className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold transition-colors ${
                    isDarkAtmosphere
                      ? 'text-slate-300 group-hover:text-amber-300'
                      : 'text-slate-700 group-hover:text-gakit-maroon'
                  }`}>
                    <span className="hidden sm:inline">Open </span>
                    <span>Weather Forecast</span>
                    <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </div>

              <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 min-w-0 w-full">
                <AmbientWeatherIcon
                  paused={modalAlert !== null}
                  conditionCode={current.conditionCode}
                  observedAt={current.observedAt}
                  isDark={isDarkAtmosphere}
                />
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0 flex-1">
                  <span className={`text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums ${
                    isDarkAtmosphere ? 'text-white' : 'text-slate-900'
                  }`}>
                    {Math.round(current.temperature)}°C
                  </span>
                  <span className={`text-xs sm:text-sm font-semibold truncate ${
                    isDarkAtmosphere ? 'text-slate-200' : 'text-slate-800'
                  }`}>
                    {condition.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                    isDarkAtmosphere ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <span className={isDarkAtmosphere ? 'text-slate-600' : 'text-slate-400'}>·</span>
                    <span>Rain: <strong className={`font-semibold tabular-nums ${
                      isDarkAtmosphere ? 'text-slate-200' : 'text-slate-900'
                    }`}>{current.precipitation == null ? 'Unavailable' : `${current.precipitation.toFixed(1)} mm (ECMWF prediction)`}</strong></span>
                  </span>
                </div>
              </div>
            </button>
          ) : (
            <div className="flex flex-col justify-between p-3.5 sm:px-4 sm:py-3 min-w-0 text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Iligan City · Open-Meteo
              </span>
              <div className="flex items-center gap-2.5 py-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Cloud className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs font-medium text-slate-400">Atmospheric conditions unavailable</span>
              </div>
            </div>
          )}

          <div className="flex flex-col justify-between p-3.5 sm:px-4 sm:py-3 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0 mb-1.5 w-full">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                Weather Advisories
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  DOST-PAGASA{alertsCheckedAt && <> · checked {shortTime(alertsCheckedAt)}</>}
                </span>

              </div>
            </div>

            {alertsError && pageAlerts.length > 0 && <p role="status" className="mb-2 text-[11px] text-amber-700">Advisory refresh unavailable · showing the last retrieved bulletins.</p>}
            {pageAlerts.length > 0 ? (
              <div className="flex flex-col justify-between flex-1 min-w-0 gap-1.5">
                <div className="flex flex-col gap-1.5 min-w-0 w-full">
                  {pageAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => setModalAlert(alert)}
                      aria-haspopup="dialog"
                      className={`group flex items-center justify-between gap-2 sm:gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-all min-w-0 w-full ${SEVERITY_CHIP[alert.severity] ?? SEVERITY_CHIP.info}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                        <BellRing className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="truncate text-xs sm:text-sm font-bold">
                              {isPagasaAlert(alert) ? shortTitle(alert) || alertTitle(alert) : alertTitle(alert)}
                            </span>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${SEVERITY_BADGE[alert.severity] ?? SEVERITY_BADGE.info}`}>
                              {SEVERITY_LABEL[alert.severity] ?? 'Info'}
                            </span>
                          </div>
                          <p className="truncate text-[11px] font-semibold opacity-80 mt-0.5">
                            {ALERT_TYPE_LABELS[alert.alertType] ?? 'Advisory'} · Issued {shortTime(alert.data?.issuedAt ?? alert.createdAt)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>

                {totalAlertPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setAlertPage((prev) => (prev > 0 ? prev - 1 : totalAlertPages - 1))}
                      title="Previous advisories page"
                      aria-label="Previous advisories page"
                      className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalAlertPages }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setAlertPage(i)}
                          title={`Page ${i + 1} of ${totalAlertPages}`}
                          aria-label={`Page ${i + 1} of ${totalAlertPages}`}
                          className={`h-1.5 rounded-full transition-all ${
                            currentAlertPage === i
                              ? 'w-3.5 bg-slate-700'
                              : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlertPage((prev) => (prev < totalAlertPages - 1 ? prev + 1 : 0))}
                      title="Next advisories page"
                      aria-label="Next advisories page"
                      className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0 w-full py-2">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${advisoryUnknown ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-emerald-200/60 bg-emerald-50 text-emerald-600'}`}>
                  <CheckCircle2 className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {advisoryUnknown ? (alertsError ? 'Advisory data unavailable' : 'Checking official advisories') : 'No active official advisories'}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shrink-0 ${advisoryUnknown ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100/80 text-emerald-800'}`}>
                      {advisoryUnknown ? 'Unknown' : 'No advisories'}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                    {advisoryUnknown ? 'Waiting for a successful advisory update.' : 'No current weather bulletins returned for this area.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {modalAlert && (
          <WeatherAlertModal
            alert={modalAlert}
            onClose={() => setModalAlert(null)}
          />
        )}
      </section>


    </div>
  );
}
