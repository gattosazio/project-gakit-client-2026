'use client';

import { useMemo, type ReactNode } from 'react';
import { BarChart3, MapPinned, Waves } from 'lucide-react';
import { DEPTH_BAR_COLOR, DEPTH_LABELS } from '@/lib/reports/reportFormatting';
import type { DeepestSpot, HourlyBucket, PeriodComparison, Spot, Trend } from './aggregate';
import { DISPLAY_DEPTHS, niceTicks } from './aggregate';

interface TodayActivityProps {
  hourly: HourlyBucket[];
  comparison: PeriodComparison;
  deepSpots: DeepestSpot[];
  spots: Spot[];
}

const TREND_CHIP: Record<Trend, string> = {
  rising: 'bg-orange-50 text-orange-700 border-orange-200',
  steady: 'bg-slate-100 text-slate-600 border-slate-200',
  falling: 'bg-sky-50 text-sky-700 border-sky-200',
};

function trendLabel(comparison: PeriodComparison): string {
  const { delta } = comparison;
  if (delta > 0) return `+${delta} vs prior 24h`;
  if (delta < 0) return `${delta} vs prior 24h`;
  return 'No change vs prior 24h';
}

export function TodayActivity({ hourly, comparison, deepSpots, spots }: TodayActivityProps) {
  const totalInWindow = comparison.last24;
  const maxHourly = useMemo(
    () => Math.max(0, ...hourly.map((bucket) => bucket.count)),
    [hourly]
  );
  const ticks = useMemo(() => niceTicks(Math.max(2, maxHourly)), [maxHourly]);
  const displayTicks = useMemo(() => [...ticks].reverse(), [ticks]);
  const maxTick = ticks[ticks.length - 1] || 2;

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <ActivityCard
        icon={BarChart3}
        title="Report Inflow"
        subtitle={hourly.length ? 'Hourly submission distribution, last 24h' : 'No data in window'}
      >
        <div className="flex items-end justify-between gap-2">
          <p className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums tracking-[-0.02em] text-slate-900">
              {totalInWindow}
            </span>
            <span className="text-xs font-medium text-slate-500">reports in last 24h</span>
          </p>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TREND_CHIP[comparison.trend]}`}
            title={`Current 24h: ${comparison.last24} | Prior 24h: ${comparison.prev24} (net change: ${comparison.delta > 0 ? '+' : ''}${comparison.delta})`}
          >
            {comparison.trend === 'rising' ? '▲' : comparison.trend === 'falling' ? '▼' : '–'}{' '}
            {trendLabel(comparison)}
          </span>
        </div>

        {hourly.length > 0 ? (
          <div className="mt-3.5 flex h-36 gap-2">
            <div className="activity-hourly-axis">
              {displayTicks.map((tick) => (
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
          <p className="mt-4 py-8 text-center text-sm text-slate-500">
            No incident reports recorded in the last 24 hours.
          </p>
        )}
      </ActivityCard>

      <ActivityCard
        icon={Waves}
        title="Peak Flood Depths"
        subtitle="Highest reported water levels by location, last 24h"
      >
        {deepSpots.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No incident reports recorded in the last 24 hours.
          </p>
        ) : (
          <>
            <ol className="divide-y divide-slate-100">
              {deepSpots.map((spot, index) => (
                <li key={spot.label} className="flex items-center justify-between gap-3 py-1.5 sm:py-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                      style={{ backgroundColor: DEPTH_BAR_COLOR[spot.code] }}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-800">
                        {spot.label}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {spot.count} report{spot.count === 1 ? '' : 's'} · up to{' '}
                        {spot.maxDepthCm > 0 ? `${spot.maxDepthCm} cm` : spot.depthLabel}
                      </span>
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
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
            <div className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 border-t border-slate-100 pt-2">
              {DISPLAY_DEPTHS.map((code) => (
                <span
                  key={code}
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-500"
                >
                  <span
                    className="h-1.5 w-2.5 rounded-full"
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
        title="Incident Hotspots"
        subtitle="Locations with highest report density, last 24h"
      >
        {spots.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No incident reports recorded in the last 24 hours.
          </p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {spots.map((spot, index) => (
              <li key={spot.label} className="flex items-center justify-between gap-3 py-2 sm:py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                    {index + 1}
                  </span>
                  <span className="truncate text-xs font-medium text-slate-700">
                    {spot.label}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
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
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-lg bg-maroon-50 p-2 text-gakit-maroon">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">{children}</div>
    </div>
  );
}