'use client';

import { useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FlaskConical,
} from 'lucide-react';
import { WeatherAlertModal } from '@/components/WeatherAlertModal';
import { AmbientWeatherIcon } from '@/components/weather/AmbientWeatherIcon';
import { WeatherCanvasBackdrop } from '@/components/weather/WeatherCanvasBackdrop';
import { alertTitle, getWeatherCondition, isDaytimeInManila } from '@/lib/weather/weatherCodes';
import { isPagasaAlert, shortTitle } from '@/lib/weather/pagasa';
import type { CurrentWeather, WeatherAlert } from '@/types/weather';

interface StatusStripProps {
  current: CurrentWeather | null;
  alerts: WeatherAlert[] | null;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  thunderstorm: 'Thunderstorm',
  heavy_rain: 'Heavy Rain',
  extreme_heat: 'Heat Advisory',
  daily_digest: 'Daily Forecast',
};

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

type WeatherPresetKey =
  | 'live'
  | 'clear_day'
  | 'clear_night'
  | 'mainly_clear_day'
  | 'mainly_clear_night'
  | 'overcast_day'
  | 'overcast_night'
  | 'rain'
  | 'thunder';

const PRESET_WEATHER: Record<
  Exclude<WeatherPresetKey, 'live'>,
  { conditionCode: number; temperature: number; precipitation: number; observedAt: string; label: string }
> = {
  clear_day: {
    conditionCode: 0,
    temperature: 31,
    precipitation: 0.0,
    observedAt: '2026-10-02T13:00:00+08:00',
    label: '☀️ Clear (Day)',
  },
  clear_night: {
    conditionCode: 0,
    temperature: 25,
    precipitation: 0.0,
    observedAt: '2026-10-02T21:00:00+08:00',
    label: '🌙 Clear (Night)',
  },
  mainly_clear_day: {
    conditionCode: 1,
    temperature: 29,
    precipitation: 0.0,
    observedAt: '2026-10-02T14:00:00+08:00',
    label: '⛅ Mainly Clear (Day)',
  },
  mainly_clear_night: {
    conditionCode: 1,
    temperature: 24,
    precipitation: 0.0,
    observedAt: '2026-10-02T22:00:00+08:00',
    label: '☁️🌙 Mainly Clear (Night)',
  },
  overcast_day: {
    conditionCode: 3,
    temperature: 26,
    precipitation: 0.0,
    observedAt: '2026-10-02T11:00:00+08:00',
    label: '☁️ Overcast (Day)',
  },
  overcast_night: {
    conditionCode: 3,
    temperature: 24,
    precipitation: 0.0,
    observedAt: '2026-10-02T20:00:00+08:00',
    label: '☁️🌙 Overcast (Night)',
  },
  rain: {
    conditionCode: 63,
    temperature: 25,
    precipitation: 12.8,
    observedAt: '2026-10-02T15:00:00+08:00',
    label: '🌧️ Moderate Rain',
  },
  thunder: {
    conditionCode: 95,
    temperature: 23,
    precipitation: 32.4,
    observedAt: '2026-10-02T16:00:00+08:00',
    label: '⛈️ Thunderstorm',
  },
};

type AlertPresetKey = 'live' | 'all_clear' | 'single_warning' | 'multiple_alerts';

const SAMPLE_ALERTS: Record<Exclude<AlertPresetKey, 'live'>, WeatherAlert[]> = {
  all_clear: [],
  single_warning: [
    {
      id: 'mock-thunderstorm-1',
      alertType: 'thunderstorm',
      severity: 'warning',
      createdAt: '2026-10-02T14:30:00+08:00',
      validFrom: '2026-10-02T14:30:00+08:00',
      validTo: '2026-10-02T18:30:00+08:00',
      data: {
        title: 'Thunderstorm Advisory No. 2',
        description: 'Moderate to heavy rainshowers with lightning and strong winds over Iligan City and nearby municipalities.',
        issuedAt: '2026-10-02T14:30:00+08:00',
        source: 'DOST-PAGASA MINPRSD',
      },
    },
  ],
  multiple_alerts: [
    {
      id: 'mock-critical-1',
      alertType: 'heavy_rain',
      severity: 'critical',
      createdAt: '2026-10-02T15:00:00+08:00',
      validFrom: '2026-10-02T15:00:00+08:00',
      validTo: '2026-10-02T21:00:00+08:00',
      data: {
        title: 'Red Rainfall Warning No. 5',
        description: 'Torrential rains observed over Lanao del Norte. Serious flooding expected in low-lying areas and landslides along mountain slopes.',
        issuedAt: '2026-10-02T15:00:00+08:00',
        source: 'DOST-PAGASA MINPRSD',
      },
    },
    {
      id: 'mock-warning-2',
      alertType: 'thunderstorm',
      severity: 'warning',
      createdAt: '2026-10-02T14:30:00+08:00',
      validFrom: '2026-10-02T14:30:00+08:00',
      validTo: '2026-10-02T18:30:00+08:00',
      data: {
        title: 'Thunderstorm Advisory No. 3',
        description: 'Thunderstorm affecting Iligan City within the next 1-2 hours.',
        issuedAt: '2026-10-02T14:30:00+08:00',
        source: 'DOST-PAGASA MINPRSD',
      },
    },
    {
      id: 'mock-info-3',
      alertType: 'extreme_heat',
      severity: 'info',
      createdAt: '2026-10-02T11:00:00+08:00',
      validFrom: '2026-10-02T11:00:00+08:00',
      validTo: '2026-10-02T17:00:00+08:00',
      data: {
        title: 'Heat Index Advisory',
        description: 'Heat index reaching 41°C caution level.',
        issuedAt: '2026-10-02T11:00:00+08:00',
        source: 'DOST-PAGASA MINPRSD',
      },
    },
  ],
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
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function StatusStrip({ current, alerts }: StatusStripProps) {
  const [showTester, setShowTester] = useState(false);
  const [weatherPreset, setWeatherPreset] = useState<WeatherPresetKey>('live');
  const [alertPreset, setAlertPreset] = useState<AlertPresetKey>('live');
  const [alertPage, setAlertPage] = useState(0);

  const effectiveCurrent = useMemo<CurrentWeather | null>(() => {
    if (weatherPreset === 'live') return current;
    const preset = PRESET_WEATHER[weatherPreset];
    return {
      temperature: preset.temperature,
      precipitation: preset.precipitation,
      conditionCode: preset.conditionCode,
      observedAt: preset.observedAt,
    };
  }, [current, weatherPreset]);

  const effectiveAlerts = useMemo<WeatherAlert[] | null>(() => {
    if (alertPreset === 'live') return alerts;
    return SAMPLE_ALERTS[alertPreset];
  }, [alerts, alertPreset]);

  const activeAlerts = useMemo(
    () => (effectiveAlerts ?? []).filter((alert) => alert.alertType !== 'daily_digest'),
    [effectiveAlerts]
  );
  const digest = useMemo(
    () => (effectiveAlerts ?? []).find((alert) => alert.alertType === 'daily_digest') ?? null,
    [effectiveAlerts]
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

  const condition = effectiveCurrent
    ? getWeatherCondition(effectiveCurrent.conditionCode, isDaytimeInManila(effectiveCurrent.observedAt))
    : null;

  const isNight = effectiveCurrent ? !isDaytimeInManila(effectiveCurrent.observedAt) : false;
  const isThunder = effectiveCurrent
    ? effectiveCurrent.conditionCode >= 95 && effectiveCurrent.conditionCode <= 99
    : false;
  const isDarkAtmosphere = isNight || isThunder;

  return (
    <div className="flex flex-col gap-2">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 min-w-0">
          {/* Left Segment: Environmental Telemetry (Iligan City) */}
          {effectiveCurrent && condition ? (
            <button
              type="button"
              onClick={() => {
                if (digest) setModalAlert(digest);
              }}
              disabled={!digest}
              title={digest ? 'Open weather forecast for Iligan City' : 'Conditions as observed by Open-Meteo'}
              aria-haspopup="dialog"
              className={`group relative overflow-hidden flex flex-col justify-between p-3.5 sm:px-4 sm:py-3 text-left transition-colors min-w-0 ${
                isDarkAtmosphere
                  ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white hover:from-slate-900 hover:to-indigo-900'
                  : 'bg-gradient-to-br from-sky-200/90 via-sky-100/70 to-sky-50/50 text-slate-900 hover:from-sky-200 hover:to-sky-100/60'
              }`}
            >
              {/* Cinematic Animated Weather Canvas Backdrop */}
              <WeatherCanvasBackdrop
                conditionCode={effectiveCurrent.conditionCode}
                observedAt={effectiveCurrent.observedAt}
              />

              <div className="relative z-10 flex items-center justify-between gap-2 min-w-0 mb-1.5 w-full">
                <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                  isDarkAtmosphere ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Iligan City · {manilaTimestamp(new Date(effectiveCurrent.observedAt ?? new Date()))} PST
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
                  conditionCode={effectiveCurrent.conditionCode}
                  observedAt={effectiveCurrent.observedAt}
                  isDark={isDarkAtmosphere}
                />
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0 flex-1">
                  <span className={`text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums ${
                    isDarkAtmosphere ? 'text-white' : 'text-slate-900'
                  }`}>
                    {Math.round(effectiveCurrent.temperature)}°C
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
                    }`}>{effectiveCurrent.precipitation.toFixed(1)} mm/h</strong></span>
                  </span>
                </div>
              </div>
            </button>
          ) : (
            <div className="flex flex-col justify-between p-3.5 sm:px-4 sm:py-3 min-w-0 text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Iligan City · {manilaTimestamp(new Date())} PST
              </span>
              <div className="flex items-center gap-2.5 py-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Cloud className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs font-medium text-slate-400">Atmospheric conditions unavailable</span>
              </div>
            </div>
          )}

          {/* Right Segment: Regional Weather Advisories */}
          <div className="flex flex-col justify-between p-3.5 sm:px-4 sm:py-3 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0 mb-1.5 w-full">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                Weather Advisories
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  DOST-PAGASA · Lanao del Norte
                </span>
                <button
                  type="button"
                  onClick={() => setShowTester((prev) => !prev)}
                  title="Toggle Weather & Alerts Interactive Preview Toolbar"
                  className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-all ${
                    showTester || weatherPreset !== 'live' || alertPreset !== 'live'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <FlaskConical className="h-3 w-3" />
                  <span>Preview</span>
                </button>
              </div>
            </div>

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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                  <CheckCircle2 className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      All Clear · Normal Conditions
                    </span>
                    <span className="inline-flex items-center rounded-full bg-emerald-100/80 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 shrink-0">
                      Nominal
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                    No active severe weather warnings or thunderstorm advisories
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

      {/* Interactive Testing Toolbar */}
      {showTester && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
            <span className="font-extrabold uppercase tracking-wider text-[11px] text-amber-900 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-amber-700" />
              <span>Interactive Weather & Alert Previewer (Test Mode)</span>
            </span>
            {(weatherPreset !== 'live' || alertPreset !== 'live') && (
              <button
                type="button"
                onClick={() => {
                  setWeatherPreset('live');
                  setAlertPreset('live');
                }}
                className="rounded-lg bg-amber-200/70 px-2 py-0.5 text-[11px] font-bold text-amber-900 hover:bg-amber-300/80 transition-colors"
              >
                Reset All to Live
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-600 text-[11px] mr-1">
              Weather Condition:
            </span>
            <button
              type="button"
              onClick={() => setWeatherPreset('live')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                weatherPreset === 'live'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              📡 Live
            </button>
            {Object.entries(PRESET_WEATHER).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => setWeatherPreset(key as WeatherPresetKey)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  weatherPreset === key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="font-bold text-slate-600 text-[11px] mr-1">
              Advisories State:
            </span>
            <button
              type="button"
              onClick={() => setAlertPreset('live')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                alertPreset === 'live'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              📡 Live Alerts
            </button>
            <button
              type="button"
              onClick={() => setAlertPreset('all_clear')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                alertPreset === 'all_clear'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              🟢 0 Alerts (All Clear)
            </button>
            <button
              type="button"
              onClick={() => setAlertPreset('single_warning')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                alertPreset === 'single_warning'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              🟡 1 Warning
            </button>
            <button
              type="button"
              onClick={() => setAlertPreset('multiple_alerts')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                alertPreset === 'multiple_alerts'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              🔴 3 Bulletins (Paginated 2/page)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}