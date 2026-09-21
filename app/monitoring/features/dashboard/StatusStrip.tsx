'use client';

import { useMemo, useState } from 'react';
import { BellRing, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { CurrentConditions } from '@/components/weather/CurrentConditions';
import { WeatherAlertModal } from '@/components/WeatherAlertModal';
import { alertDescription, alertTitle } from '@/lib/weather/weatherCodes';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [outlookOpen, setOutlookOpen] = useState(false);
  const expanded = activeAlerts.find((alert) => alert.id === expandedId) ?? null;

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
              if (digest) setOutlookOpen(true);
            }}
            disabled={!digest}
            title={digest ? 'Weather outlook for Iligan' : 'Weather outlook unavailable'}
            aria-haspopup="dialog"
            aria-expanded={outlookOpen}
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
              const isExpanded = alert.id === expanded?.id;
              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  aria-expanded={isExpanded}
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
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
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

      {expanded && (
        <div className="border-t border-slate-200/70 bg-slate-50/50 p-4 md:p-5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {alertDescription(expanded)}
          </p>

          {expanded.data?.affectedAreas && expanded.data.affectedAreas.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Affected areas (MINPRSD)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {expanded.data.affectedAreas.map((area, index) => (
                  <span
                    key={index}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            {expanded.data?.bulletinNumber && (
              <div>
                <dt className="font-semibold text-slate-400">Bulletin</dt>
                <dd className="font-semibold text-slate-700">
                  #{expanded.data.bulletinNumber}
                </dd>
              </div>
            )}
            <div>
              <dt className="font-semibold text-slate-400">Source</dt>
              <dd className="font-semibold text-slate-700">
                {expanded.data?.source ?? 'DOST-PAGASA MINPRSD'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">Valid until</dt>
              <dd className="font-semibold text-slate-700">
                {shortTime(expanded.validTo)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {outlookOpen && digest && (
        <WeatherAlertModal
          alert={digest}
          current={current}
          onClose={() => setOutlookOpen(false)}
        />
      )}
    </section>
  );
}