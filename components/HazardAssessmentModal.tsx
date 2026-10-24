'use client';

import { useEffect, useId, useState } from 'react';
import { AlertTriangle, CloudRain, Droplets, Info, MountainSnow, RefreshCw, Shield, Waves } from 'lucide-react';
import { LocationDialog, LocationSummary, LOCATION_DIALOG_PRIMARY_BUTTON } from '@/components/map/LocationDialog';
import { Spinner } from '@/components/ui/Spinner';
import { HeatIndexAssessment } from '@/components/HeatIndexAssessment';
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
  const hasRainfall = hasResult && rainfall != null && Number.isFinite(rainfall) && rainfall >= 0;

  return (
    <LocationDialog isOpen={isOpen} onClose={onClose} title="Hazard assessment"
      subtitle="Mapped hazards & weather outlook" icon={Shield} closeLabel="Close hazard assessment"
      footer={<button type="button" onClick={onClose} className={LOCATION_DIALOG_PRIMARY_BUTTON}>Back to map</button>}>
        <LocationSummary location={selectedLocation} address={displayAddress} />

        {withinCity === false && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p><span className="font-semibold">Outside Iligan City.</span> Results are available only where map data provides coverage.</p>
          </div>
        )}

        {selectedLocation && <>
          <section aria-labelledby={`${titleId}-hazards`} aria-busy={isCheckingLocation}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 id={`${titleId}-hazards`} className="text-sm font-semibold text-slate-900">Mapped hazards</h3>
              {isCheckingLocation && <span role="status" className="flex items-center gap-1.5 text-xs text-slate-500"><Spinner size="xs" />Checking…</span>}
            </div>
            <div className="divide-y divide-slate-100">
              {hazards.map(({ name, icon: Icon, level, detail, color }) => {
                const meta = level ? levelStyles[level] : null;
                return <div key={name} className="flex items-center justify-between gap-2 py-2">
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

          <section aria-labelledby={`${titleId}-weather`}>
            <h3 id={`${titleId}-weather`} className="mb-2 text-sm font-semibold text-slate-900">Weather outlook</h3>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl">
              <section className="min-w-0 bg-sky-50 p-3" aria-label="Rainfall">
                <div className="mb-2 flex items-center gap-2 text-sky-900">
                  <CloudRain className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">Rainfall</h3>
                </div>
                {isCheckingLocation ? <div className="flex h-9 items-center"><Spinner size="sm" /></div> : hasRainfall
                  ? <p className="text-2xl font-bold tabular-nums tracking-tight text-sky-950">{rainfall.toFixed(1)} <span className="text-xs font-medium text-sky-800">{rainfallPeriod === 1 ? 'mm/hr' : 'mm'}</span></p>
                  : <p className="flex h-9 items-center text-sm font-medium text-sky-900">Unavailable</p>}
                <p className="mt-1 text-xs text-sky-900">{rainfallPeriod === 1 ? '1-hour rate' : `${rainfallPeriod}-hour total`}</p>
              </section>
              {isOpen && <HeatIndexAssessment key={`${selectedLocation.lat},${selectedLocation.lng}`} lat={selectedLocation.lat} lng={selectedLocation.lng} />}
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
    </LocationDialog>
  );
}
