'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { getElevation } from '@/lib/map/elevation';
import { SiteConditionsCard } from '@/components/reporting/SiteConditionsCard';
import type { LocationRiskInfo } from '@/components/PublicMap';

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
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationRisk, setLocationRisk] = useState<LocationRiskInfo | null>(null);
  const [elevation, setElevation] = useState<number | null>(null);
  const [isCheckingElevation, setIsCheckingElevation] = useState(false);
  const lastElevationKey = useRef('');

  useEffect(() => {
    if (!isOpen) {
      lastElevationKey.current = '';
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !selectedLocation) return;
    const key = `${selectedLocation.lat.toFixed(5)},${selectedLocation.lng.toFixed(5)}`;
    if (key === lastElevationKey.current && elevation !== null) {
      setIsCheckingElevation(false);
      return;
    }
    lastElevationKey.current = key;

    let cancelled = false;
    const abort = new AbortController();
    setIsCheckingElevation(true);

    void getElevation(selectedLocation.lat, selectedLocation.lng, abort.signal)
      .then((elev) => {
        if (!cancelled) {
          setElevation(elev);
          setIsCheckingElevation(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setElevation(null);
          setIsCheckingElevation(false);
        }
      });

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [isOpen, selectedLocation, elevation]);

  useEffect(() => {
    if (!isOpen || !selectedLocation || !onCheckLocation) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsCheckingLocation(true);
      setLocationRisk(null);
      try {
        const risk = await onCheckLocation(selectedLocation);
        if (!cancelled) setLocationRisk(risk);
      } catch {
        if (!cancelled) {
          setLocationRisk({ floodHazard: null, landslide: null, stormSurge: null, precipMm: null });
        }
      } finally {
        if (!cancelled) setIsCheckingLocation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedLocation, rainfallHours, onCheckLocation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center pointer-events-none md:items-center md:justify-end md:p-6">
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs pointer-events-auto md:hidden"
        onClick={onClose}
      />
      <div className="relative z-10 bg-white rounded-t-3xl shadow-2xl w-full max-h-[82vh] flex flex-col pointer-events-auto md:rounded-2xl md:max-h-[calc(100vh-8rem)] md:h-auto md:max-w-96 border border-slate-200/90 ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-canvas-grey">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-heading">
              Hazard Assessment
            </h2>
            <div className="text-xs text-slate-500 mt-1">
              Site conditions &amp; geohazard risk
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close hazard assessment modal"
            className="p-1.5 hover:bg-canvas-light text-slate-400 hover:text-slate-700 rounded-xl transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-1">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              Selected Location
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {selectedLocation?.address || 'No location selected'}
            </div>
            {selectedLocation && (
              <div className="text-xs text-slate-600 mt-2">
                {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
              </div>
            )}
          </div>

          {withinCity === false && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                This location is <span className="font-semibold">outside Iligan City</span>.
                Geohazard conditions are shown where data coverage exists.
              </span>
            </div>
          )}

          {selectedLocation && (
            <SiteConditionsCard
              elevation={elevation}
              isCheckingElevation={isCheckingElevation}
              locationRisk={locationRisk}
              isCheckingLocation={isCheckingLocation}
              rainfallHours={rainfallHours}
            />
          )}
        </div>

        <div className="p-4 pb-8 sm:pb-4 md:p-6 border-t border-canvas-grey bg-canvas-light/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-6 rounded-xl font-semibold text-slate-700 bg-canvas-grey hover:bg-slate-300 active:scale-[0.98] transition-all text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
