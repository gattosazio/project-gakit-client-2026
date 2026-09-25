'use client';

import {
  AlertTriangle,
  CloudRain,
  Droplets,
  MountainSnow,
  Waves,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { LocationRiskInfo } from '@/components/PublicMap';
import type { HazardLevel } from '@/lib/map/geohazardQuery';

const HAZARD_META: Record<
  'high' | 'medium' | 'low' | 'none',
  { label: string; color: string; bg: string; dot: string }
> = {
  high: {
    label: 'High Hazard',
    color: 'text-rose-950',
    bg: 'bg-rose-100 border-rose-300',
    dot: 'bg-rose-600',
  },
  medium: {
    label: 'Medium Hazard',
    color: 'text-orange-950',
    bg: 'bg-orange-100 border-orange-300',
    dot: 'bg-orange-500',
  },
  low: {
    label: 'Low Hazard',
    color: 'text-amber-950',
    bg: 'bg-amber-100 border-amber-300',
    dot: 'bg-amber-500',
  },
  none: {
    label: 'None Mapped',
    color: 'text-slate-600',
    bg: 'bg-slate-100 border-slate-200',
    dot: 'bg-slate-400',
  },
};

const hazardMeta = (level: HazardLevel | null) => HAZARD_META[level ?? 'none'];

function HazardBadge({ level, badge }: { level: HazardLevel | null; badge?: string }) {
  const meta = hazardMeta(level);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.bg} ${meta.color} whitespace-nowrap`}
    >
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${meta.dot}`} aria-hidden />
      <span className="font-bold">{meta.label}</span>
      {badge && <span className="font-medium opacity-75">· {badge}</span>}
    </span>
  );
}

interface SiteConditionsCardProps {
  locationRisk: LocationRiskInfo | null;
  isCheckingLocation: boolean;
  rainfallHours?: number;
}

export function SiteConditionsCard({
  locationRisk,
  isCheckingLocation,
  rainfallHours,
}: SiteConditionsCardProps) {
  const stormSurge = locationRisk?.stormSurge;
  const precipMm = locationRisk?.precipMm;

  const rainfallLabel =
    rainfallHours === 1 || !rainfallHours
      ? 'Rainfall (1-Hour Rate)'
      : `Rainfall (${rainfallHours}-Hour Total)`;

  const rainfallUnit = rainfallHours === 1 || !rainfallHours ? 'mm/hr' : 'mm';

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-0.5">
        <AlertTriangle className="w-3.5 h-3.5 text-gakit-maroon" />
        <span>Site Conditions</span>
      </div>

      {/* 1. Dynamic Rainfall Weather Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
            <CloudRain className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-800">
            {rainfallLabel}
          </span>
        </div>

        <div className="text-right">
          {isCheckingLocation ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Spinner size="xs" iconClassName="bg-sky-500" />
              <span>Checking…</span>
            </span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tracking-tight text-slate-900 font-mono">
                {precipMm != null ? precipMm.toFixed(1) : '0.0'}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {rainfallUnit}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Geohazard Susceptibility Card (Flood, Landslide, Storm Surge) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 mb-1">
          Geohazard Susceptibility
        </div>

        <div className="divide-y divide-slate-100">
          {/* Flood */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                <Droplets className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800">Flood</span>
            </div>
            {isCheckingLocation ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Spinner size="xs" iconClassName="bg-blue-500" />
              </span>
            ) : (
              <HazardBadge level={locationRisk?.floodHazard ?? null} />
            )}
          </div>

          {/* Landslide */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
                <MountainSnow className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800">Landslide</span>
            </div>
            {isCheckingLocation ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Spinner size="xs" iconClassName="bg-amber-500" />
              </span>
            ) : (
              <HazardBadge level={locationRisk?.landslide ?? null} />
            )}
          </div>

          {/* Storm Surge */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-50 text-cyan-700 border border-cyan-100 shrink-0">
                <Waves className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800">Storm Surge</span>
            </div>
            {isCheckingLocation ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Spinner size="xs" iconClassName="bg-cyan-500" />
              </span>
            ) : (
              <HazardBadge
                level={stormSurge?.level ?? null}
                badge={stormSurge?.advisory ? `SSA #${stormSurge.advisory}` : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}