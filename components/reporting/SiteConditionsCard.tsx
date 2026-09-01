'use client';

import {
  AlertTriangle,
  Anchor,
  CloudRain,
  Mountain,
  MountainSnow,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import type { LocationRiskInfo } from '@/components/PublicMap';
import type { HazardLevel } from '@/lib/map/geohazardQuery';

const HAZARD_META: Record<
  'high' | 'medium' | 'low' | 'none',
  { label: string; color: string; bg: string }
> = {
  high: { label: 'High hazard', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  medium: { label: 'Medium hazard', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  low: { label: 'Low hazard', color: 'text-lime-700', bg: 'bg-lime-50 border-lime-200' },
  none: { label: 'No hazard mapped', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

const hazardMeta = (level: HazardLevel | null) => HAZARD_META[level ?? 'none'];

function HazardPill({ level, badge }: { level: HazardLevel | null; badge?: string }) {
  const meta = hazardMeta(level);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.color}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      <span className="font-bold">{meta.label}</span>
      {badge && <span className="font-medium opacity-70">· {badge}</span>}
    </span>
  );
}

interface SiteConditionsRowProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  isLoading: boolean;
  children?: ReactNode;
}

function SiteConditionsRow({
  icon: Icon,
  iconClassName = 'text-slate-500',
  label,
  isLoading,
  children,
}: SiteConditionsRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden />
        {label}
      </div>
      {isLoading ? (
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <Spinner size="xs" iconClassName="bg-slate-400" />
          Checking…
        </span>
      ) : (
        <div className="text-right">{children}</div>
      )}
    </div>
  );
}

function MetricValue({ value, caption }: { value: string; caption?: string }) {
  return (
    <>
      <div className="text-sm font-bold text-slate-900">{value}</div>
      {caption && <div className="text-[10px] text-slate-400">{caption}</div>}
    </>
  );
}

const NO_DATA = <div className="text-sm font-medium text-slate-400">No data</div>;

interface SiteConditionsCardProps {
  elevation: number | null;
  isCheckingElevation: boolean;
  locationRisk: LocationRiskInfo | null;
  isCheckingLocation: boolean;
  rainfallHours?: number;
}

export function SiteConditionsCard({
  elevation,
  isCheckingElevation,
  locationRisk,
  isCheckingLocation,
  rainfallHours,
}: SiteConditionsCardProps) {
  const stormSurge = locationRisk?.stormSurge;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
        <AlertTriangle className="w-3 h-3" />
        Site Conditions
      </div>
      <div className="divide-y divide-slate-200">
        <SiteConditionsRow
          icon={Mountain}
          iconClassName="text-violet-500"
          label="Elevation"
          isLoading={isCheckingElevation}
        >
          {elevation != null ? (
            <MetricValue value={`${elevation.toFixed(1)} m`} caption="Copernicus 30m" />
          ) : (
            NO_DATA
          )}
        </SiteConditionsRow>

        <SiteConditionsRow
          icon={CloudRain}
          iconClassName="text-sky-500"
          label="Rainfall"
          isLoading={isCheckingLocation}
        >
          {locationRisk?.precipMm != null ? (
            <MetricValue
              value={
                rainfallHours === 1
                  ? `${locationRisk.precipMm.toFixed(2)} mm/hr`
                  : `${locationRisk.precipMm.toFixed(2)} mm`
              }
              caption={
                rainfallHours && rainfallHours !== 1 ? `${rainfallHours}h accum.` : undefined
              }
            />
          ) : (
            NO_DATA
          )}
        </SiteConditionsRow>

        <SiteConditionsRow
          icon={Waves}
          iconClassName="text-blue-600"
          label="Flood"
          isLoading={isCheckingLocation}
        >
          <HazardPill level={locationRisk?.floodHazard ?? null} />
        </SiteConditionsRow>

        <SiteConditionsRow
          icon={MountainSnow}
          iconClassName="text-orange-600"
          label="Landslide"
          isLoading={isCheckingLocation}
        >
          <HazardPill level={locationRisk?.landslide ?? null} />
        </SiteConditionsRow>

        <SiteConditionsRow
          icon={Anchor}
          iconClassName="text-cyan-600"
          label="Storm surge"
          isLoading={isCheckingLocation}
        >
          <HazardPill
            level={stormSurge?.level ?? null}
            badge={stormSurge ? `SSA #${stormSurge.advisory}` : undefined}
          />
        </SiteConditionsRow>
      </div>
    </div>
  );
}