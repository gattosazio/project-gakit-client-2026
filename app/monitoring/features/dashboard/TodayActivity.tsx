'use client';

import { useMemo, type ReactNode } from 'react';
import { BarChart3, MapPinned, Waves } from 'lucide-react';
import { DEPTH_LABELS } from '@/lib/reports/reportFormatting';
import type { FloodDepthCode } from '@/types/report';
import type { DeepestSpot, HourlyBucket, PeriodComparison, Spot, Trend } from './aggregate';
import { DISPLAY_DEPTHS, niceTicks } from './aggregate';

interface TodayActivityProps {
  hourly: HourlyBucket[];
  comparison: PeriodComparison;
  deepSpots: DeepestSpot[];
  spots: Spot[];
}

const DEPTH_BAR_COLOR: Record<FloodDepthCode, string> = {
  ankle: '#10B981',
  knee: '#84CC16',
  waist: '#F5B301',
  shoulder: '#F97316',
  head: '#EF4444',
  overhead: '#7A0019',
};

const TREND_CHIP: Record<Trend, string> = {
  rising: 'bg-orange-50 text-orange-700 border-orange-200',
  steady: 'bg-slate-100 text-slate-600 border-slate-200',
  falling: 'bg-sky-50 text-sky-700 border-sky-200',
};

function trendLabel(comparison: PeriodComparison): string {
  const { delta } = comparison;
  if (delta > 0) return `+${delta} vs previous 24h`;
  if (delta < 0) return `${delta} vs previous 24h`;
  return 'same as previous 24h';
}

export function TodayActivity({ hourly, comparison, deepSpots, spots }: TodayActivityProps) {
  const totalInWindow = useMemo(
    () => hourly.reduce((sum, bucket) => sum + bucket.count, 0),
    [hourly]
  );
  const maxHourly = useMemo(
    () => Math.max(0, ...hourly.map((bucket) => bucket.count)),
    [hourly]
  );
  const ticks = useMemo(() => niceTicks(maxHourly), [maxHourly]);
  const maxTick = ticks[ticks.length - 1] || 1;

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <ActivityCard
        icon={BarChart3}
        title="Incoming reports"
        subtitle={hourly.length ? 'Hourly volume, last 24 hours' : 'No data in the window'}
      >
        <div className="flex items-end justify-between gap-2">
          <p className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums tracking-[-0.02em] text-slate-900">
              {totalInWindow}
            </span>
            <span className="text-xs font-medium text-slate-500">reports in 24h</span>
          </p>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TREND_CHIP[comparison.trend]}`}
            title="Based on the last 100 reports returned by the API"
          >
            {comparison.trend === 'rising' ? '▲' : comparison.trend === 'falling' ? '▼' : '–'}{' '}
            {trendLabel(comparison)}
          </span>
        </div>

        {hourly.length > 0 ? (
          <div className="mt-4 flex h-40 gap-2">
            <div className="activity-hourly-axis">
              {ticks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            <div className="activity-hourly-plot">
              <div className="activity-hourly-grid">
                {ticks.map((tick) => (
                  <span key={tick} className="activity-hourly-gridline" />
                ))}
              </div>
              <div className="activity-hourly-bars">
                {hourly.map((bucket) => (
                  <div key={bucket.label} className="activity-hourly-item">
                    {bucket.count > 0 && (
                      <div className="activity-hourly-value">{bucket.count}</div>
                    )}
                    <div
                      className="activity-hourly-bar"
                      style={{
                        height:
                          bucket.count > 0
                            ? `${Math.max(8, (bucket.count / maxTick) * 100)}%`
                            : '0%',
                      }}
                      title={`${bucket.label}: ${bucket.count} report${bucket.count === 1 ? '' : 's'}`}
                    />
                  </div>
                ))}
              </div>
              <div className="activity-hourly-labels">
                <span>{hourly[0]?.label}</span>
                <span>{hourly[hourly.length - 1]?.label}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-6 py-8 text-center text-sm text-slate-500">
            No reports submitted yet.
          </p>
        )}
      </ActivityCard>

      <ActivityCard
        icon={Waves}
        title="Deepest flooding"
        subtitle="Worst spots by water level, last 24h"
      >
        {deepSpots.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No reports submitted yet.</p>
        ) : (
          <>
            <ol className="divide-y divide-slate-100">
              {deepSpots.map((spot, index) => (
                <li key={spot.label} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                      style={{ backgroundColor: DEPTH_BAR_COLOR[spot.code] }}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {spot.label}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {spot.count} report{spot.count === 1 ? '' : 's'} · up to{' '}
                        {spot.maxDepthCm > 0 ? `${spot.maxDepthCm} cm` : 'record depth'}
                      </span>
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                    style={{
                      backgroundColor: `${DEPTH_BAR_COLOR[spot.code]}1A`,
                      color: DEPTH_BAR_COLOR[spot.code],
                    }}
                  >
                    {spot.depthLabel}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-3">
              {DISPLAY_DEPTHS.map((code) => (
                <span
                  key={code}
                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"
                >
                  <span
                    className="h-1.5 w-3 rounded-full"
                    style={{ backgroundColor: DEPTH_BAR_COLOR[code] }}
                  />
                  {DEPTH_LABELS[code]}
                </span>
              ))}
            </div>
          </>
        )}
      </ActivityCard>

      <ActivityCard
        icon={MapPinned}
        title="Most reported"
        subtitle="Locations with the most reports, last 24h"
      >
        {spots.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No reports submitted yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {spots.map((spot, index) => (
              <li key={spot.label} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-700">
                    {spot.label}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                  {spot.count}
                </span>
              </li>
            ))}
          </ol>
        )}
      </ActivityCard>
    </section>
  );
}

function ActivityCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof BarChart3;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[16rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-xl bg-maroon-50 p-2.5 text-gakit-maroon">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="flex-1 p-5">{children}</div>
    </div>
  );
}