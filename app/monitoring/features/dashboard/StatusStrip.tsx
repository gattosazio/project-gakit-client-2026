'use client';

import { useMemo, useState } from 'react';
import { BellRing, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { CurrentConditions } from '@/components/weather/CurrentConditions';
import { WeatherAlertModal } from '@/components/WeatherAlertModal';
import { alertTitle } from '@/lib/weather/weatherCodes';
import type { CurrentWeather, WeatherAlert } from '@/types/weather';

interface StatusStripProps {
  current: CurrentWeather | null;
  alerts: WeatherAlert[] | null;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  thunderstorm: 'Thunderstorm',
  heavy_rain: 'Heavy rain',
  extreme_heat: 'Extreme heat',
  daily_digest: 'Daily forecast',
};

const SEVERITY_CHIP: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-orange-50 text-orange-700 border-orange-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

function manilaClock(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}


export function StatusStrip({ current, alerts }: StatusStripProps) {
  const activeAlerts = useMemo(
    () => (alerts ?? []).filter((alert) => alert.alertType !== 'daily_digest'),
    [alerts]
  );
  const digest = useMemo(
    () => (alerts ?? []).find((alert) => alert.alertType === 'daily_digest') ?? null,
    [alerts]
  );
  const [modalAlert, setModalAlert] = useState<WeatherAlert | null>(null);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-stretch gap-3 p-3">
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            {manilaClock(new Date())}
          </span>
        </div>

        {current ? (
          <button
            type="button"
            onClick={() => {
              if (digest) setModalAlert(digest);
            }}
            disabled={!digest}
            title={digest ? 'Weather outlook for Iligan' : 'Weather outlook unavailable'}
            aria-haspopup="dialog"
            className="group flex items-center gap-1.5 rounded-xl transition-colors disabled:cursor-default"
          >
            <CurrentConditions current={current} />
            <ChevronUp
              className={`h-3.5 w-3.5 shrink-0 transition-all ${
                digest
                  ? 'text-slate-300 group-hover:text-gakit-maroon group-hover:-translate-y-0.5'
                  : 'text-slate-200'
              }`}
              aria-hidden="true"
            />
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2">
            <span className="text-xs font-medium text-slate-400">Conditions unavailable</span>
          </div>
        )}

        {activeAlerts.length > 0 ? (
          <div className="ml-auto flex min-w-0 flex-1 flex-col gap-1.5">
            {activeAlerts.map((alert) => {
              const chipClass = SEVERITY_CHIP[alert.severity] ?? SEVERITY_CHIP.info;
              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => setModalAlert(alert)}
                  aria-haspopup="dialog"
                  className={`flex min-w-[17rem] max-w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${chipClass}`}
                >
                  <BellRing className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {alertTitle(alert)}
                    </span>
                    <span className="block text-xs font-semibold opacity-80">
                      {ALERT_TYPE_LABELS[alert.alertType] ?? 'Advisory'} · issued{' '}
                      {shortTime(alert.data?.issuedAt ?? alert.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    {SEVERITY_LABEL[alert.severity] ?? 'Info'}
                  </span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="ml-auto flex items-center text-xs font-medium text-slate-400">
            No active advisories from DOST-PAGASA
          </p>
        )}
      </div>

      {modalAlert && (
        <WeatherAlertModal
          alert={modalAlert}
          current={current}
          onClose={() => setModalAlert(null)}
        />
      )}
    </section>
  );
}