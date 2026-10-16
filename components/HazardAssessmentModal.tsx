'use client';

import { useEffect, useId, useState } from 'react';
import { AlertTriangle, CloudRain, Droplets, Info, MapPin, MountainSnow, RefreshCw, Shield, Waves, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import type { LocationRiskInfo } from '@/components/PublicMap';
import { isRawCoordinateString, reverseGeocode } from '@/lib/map/geoUtils';

interface HazardAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  onCheckLocation?: (location: {
    lat: number;
    lng: number;
  }) => Promise<LocationRiskInfo>;
  rainfallHours?: number;
  /** Server-authoritative geofence result; indicates whether location is inside Iligan City. */
  withinCity?: boolean | null;
}

export function HazardAssessmentModal({
  isOpen,
  onClose,
  selectedLocation,
  onCheckLocation,
  rainfallHours,
  withinCity,
}: HazardAssessmentModalProps) {
  const titleId = useId();
  const [checkFailed, setCheckFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationRisk, setLocationRisk] = useState<LocationRiskInfo | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const displayAddress = selectedLocation && isRawCoordinateString(selectedLocation.address)
    && resolvedLocation?.lat === selectedLocation.lat && resolvedLocation.lng === selectedLocation.lng
    ? resolvedLocation.address : selectedLocation?.address;

  useEffect(() => {
    if (isOpen && selectedLocation && isRawCoordinateString(selectedLocation.address)) {
      let cancelled = false;
      void reverseGeocode(selectedLocation.lat, selectedLocation.lng).then((resolved) => {
        if (!cancelled && resolved && !isRawCoordinateString(resolved)) {
          setResolvedLocation({ ...selectedLocation, address: resolved });
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, selectedLocation]);

  useEffect(() => {
    if (!isOpen || !selectedLocation || !onCheckLocation) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsCheckingLocation(true);
      setLocationRisk(null);
      setCheckFailed(false);
      try {
        const risk = await onCheckLocation(selectedLocation);
        if (!cancelled) setLocationRisk(risk);
      } catch {
        if (!cancelled) {
          setCheckFailed(true);
        }
      } finally {
        if (!cancelled) setIsCheckingLocation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedLocation, rainfallHours, onCheckLocation, retryCount]);

  const hazards = [
    { name: 'Flood', icon: Droplets, level: locationRisk?.floodHazard, detail: 'Mapped flood susceptibility', color: 'bg-blue-50 text-blue-600' },
    { name: 'Landslide', icon: MountainSnow, level: locationRisk?.landslide, detail: 'Mapped slope susceptibility', color: 'bg-amber-50 text-amber-700' },
    { name: 'Storm surge', icon: Waves, level: locationRisk?.stormSurge?.level,
      detail: locationRisk?.stormSurge ? `SSA #${locationRisk.stormSurge.advisory} map scenario` : 'Coastal inundation scenario', color: 'bg-cyan-50 text-cyan-700' },
  ];
  const levelStyles = {
    high: { label: 'High', classes: 'border-rose-200 bg-rose-50 text-rose-700', dots: 3 },
    medium: { label: 'Medium', classes: 'border-orange-200 bg-orange-50 text-orange-700', dots: 2 },
    low: { label: 'Low', classes: 'border-amber-200 bg-amber-50 text-amber-800', dots: 1 },
  };
  const hasResult = Boolean(locationRisk) && !checkFailed;
  const rainfallPeriod = rainfallHours && rainfallHours > 1 ? rainfallHours : 1;
  const rainfall = locationRisk?.precipMm;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} ariaLabelledBy={titleId}
      maxWidthClass="max-w-lg" panelClassName="flex max-h-[90dvh] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Shield className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-heading text-lg font-bold tracking-tight text-slate-900">Hazard assessment</h2>
          <p className="text-xs text-slate-500">Hazards and rainfall at your selected location</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close hazard assessment"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <section className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3" aria-label="Selected location">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-slate-900">{displayAddress || selectedLocation?.address || 'Select a location on the map'}</p>
            {selectedLocation && <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">{selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}</p>}
          </div>
        </section>

        {withinCity === false && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p><span className="font-semibold">Outside Iligan City.</span> Results are available only where map data provides coverage.</p>
          </div>
        )}

        {selectedLocation && <>
          <section aria-labelledby={`${titleId}-hazards`} aria-busy={isCheckingLocation}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 id={`${titleId}-hazards`} className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mapped hazards</h3>
              {isCheckingLocation && <span role="status" className="flex items-center gap-1.5 text-xs text-slate-500"><Spinner size="xs" />Checking…</span>}
            </div>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {hazards.map(({ name, icon: Icon, level, detail, color }) => {
                const meta = level ? levelStyles[level] : null;
                return <div key={name} className="flex items-center justify-between gap-2 px-3.5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                    <div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{name}</p><p className="mt-0.5 text-[11px] leading-snug text-slate-500">{detail}</p></div>
                  </div>
                  {isCheckingLocation ? <span className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" aria-hidden="true" />
                    : meta && hasResult ? <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${meta.classes}`}>
                      <span className="flex gap-0.5" aria-hidden="true">{[1, 2, 3].map(dot => <span key={dot} className={`h-1 w-1 rounded-full bg-current ${dot > meta.dots ? 'opacity-20' : ''}`} />)}</span>{meta.label}
                    </span>
                    : <span className="shrink-0 text-[11px] font-medium text-slate-500">{hasResult ? 'None mapped' : 'Unavailable'}</span>}
                </div>;
              })}
            </div>
          </section>

          <section className="flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/60 px-3.5 py-3" aria-label="Rainfall">
            <div className="flex items-center gap-2.5">
              <CloudRain className="h-5 w-5 shrink-0 text-sky-600" aria-hidden="true" />
              <div><h3 className="text-sm font-semibold text-slate-900">Rainfall</h3><p className="text-[11px] text-slate-500">{rainfallPeriod === 1 ? '1-hour rate' : `${rainfallPeriod}-hour total`}</p></div>
            </div>
            <div className="shrink-0 text-right">
              {isCheckingLocation ? <Spinner size="sm" /> : hasResult && rainfall != null && Number.isFinite(rainfall)
                ? <p className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{rainfall.toFixed(1)} <span className="text-xs font-medium text-slate-500">{rainfallPeriod === 1 ? 'mm/hr' : 'mm'}</span></p>
                : <span className="text-xs font-medium text-slate-500">Unavailable</span>}
            </div>
          </section>

          {checkFailed && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <p>Unable to load the assessment.</p>
            <button type="button" onClick={() => setRetryCount(count => count + 1)} className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-semibold hover:bg-amber-100"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
          </div>}
          <div className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>Hazard maps show susceptibility, not current conditions. “None mapped” does not guarantee safety. Follow official advisories for current warnings.</p>
          </div>
        </>}
      </div>

      <footer className="flex shrink-0 items-center justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700">Back to map</button>
      </footer>
    </Dialog>
  );
}
