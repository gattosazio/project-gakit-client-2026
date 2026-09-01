'use client';

import { AlertTriangle, CloudRain, Mountain } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { LocationRiskInfo } from '@/components/PublicMap';

const HAZARD_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  high: { label: 'High hazard', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  medium: { label: 'Medium hazard', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  low: { label: 'Low hazard', color: 'text-lime-700', bg: 'bg-lime-50 border-lime-200' },
  none: { label: 'No hazard mapped', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

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
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-3">
        <AlertTriangle className="w-3 h-3" />
        Site Conditions
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-200">
        <div className="flex flex-col items-center text-center px-2">
          <Mountain className="w-3.5 h-3.5 text-violet-500 mb-1" />
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
            Elevation
          </div>
          {isCheckingElevation ? (
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
              <Spinner size="xs" iconClassName="bg-slate-500" />
              ...
            </div>
          ) : (
            <>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {elevation != null ? `${elevation.toFixed(1)} m` : 'No data'}
              </div>
              {elevation != null && (
                <div className="text-[10px] text-slate-400">Copernicus 30m</div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col items-center text-center px-2">
          <CloudRain className="w-3.5 h-3.5 text-sky-500 mb-1" />
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
            Rainfall
          </div>
          {isCheckingLocation ? (
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
              <Spinner size="xs" iconClassName="bg-slate-500" />
              ...
            </div>
          ) : (
            <>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {locationRisk?.precipMm != null
                  ? `${locationRisk.precipMm.toFixed(2)} mm`
                  : 'No data'}
              </div>
              {rainfallHours && locationRisk?.precipMm != null && (
                <div className="text-[10px] text-slate-400">{rainfallHours}h accum.</div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col items-center text-center px-2">
          <AlertTriangle
            className={`w-3.5 h-3.5 mb-1 ${
              locationRisk?.hazardLevel
                ? HAZARD_META[locationRisk.hazardLevel].color
                : 'text-slate-400'
            }`}
          />
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
            Hazard
          </div>
          {isCheckingLocation ? (
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
              <Spinner size="xs" iconClassName="bg-slate-500" />
              ...
            </div>
          ) : (
            <div
              className={`text-sm font-bold mt-0.5 ${
                locationRisk?.hazardLevel
                  ? HAZARD_META[locationRisk.hazardLevel].color
                  : 'text-slate-600'
              }`}
            >
              {HAZARD_META[locationRisk?.hazardLevel ?? 'none'].label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
