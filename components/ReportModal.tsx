'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bike, Bus, Car, CloudRain, Loader2, MapPin, Mountain, UserRound, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { listDepthCategories } from '@/app/public-view/actions/public.view';
import { getElevation } from '@/lib/map/elevation';
import {
  FLOOD_REFERENCE_PROFILES,
  FloodReferenceIllustration,
  type FloodReference,
  type FloodReferenceLevel,
} from '@/components/reporting/FloodReferenceIllustration';
import type { FloodDepth, FloodDepthCategory } from '@/app/public-view/actions/public.view';
import type { LocationRiskInfo } from '@/components/PublicMap';

type ReportStep = 'confirm' | 'depth';

const REFERENCE_ICONS: Record<FloodReference, typeof Car> = {
  adult: UserRound,
  motorcycle: Bike,
  sedan: Car,
  suv: Car,
  jeepney: Car,
  bus: Bus,
};

const getClosestLevelIndex = (
  levels: FloodReferenceLevel[],
  waterLevel: number
) =>
  levels.reduce(
    (closestIndex, level, index) =>
      Math.abs(level.waterLevel - waterLevel) <
      Math.abs(levels[closestIndex].waterLevel - waterLevel)
        ? index
        : closestIndex,
    0
  );

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedLocation: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  onSubmit: (data: {
    location: { lat: number; lng: number };
    depth: FloodDepth;
    reference: { label: string; landmark: string };
  }) => Promise<void>;
  onCheckLocation?: (location: {
    lat: number;
    lng: number;
  }) => Promise<LocationRiskInfo>;
  rainfallHours?: number;
}

const HAZARD_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  high: { label: 'High hazard', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  medium: { label: 'Medium hazard', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  low: { label: 'Low hazard', color: 'text-lime-700', bg: 'bg-lime-50 border-lime-200' },
  none: { label: 'No hazard mapped', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

export function ReportModal({
  isOpen,
  onClose,
  onSuccess,
  selectedLocation,
  onSubmit,
  onCheckLocation,
  rainfallHours,
}: ReportModalProps) {
  const [step, setStep] = useState<ReportStep>('confirm');
  const [selectedDepth, setSelectedDepth] = useState<FloodDepth | null>(null);
  const [selectedReference, setSelectedReference] = useState<FloodReference | null>(null);
  const [hoveredLevelIndex, setHoveredLevelIndex] = useState<number | null>(null);
  const [depthCategories, setDepthCategories] = useState<FloodDepthCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationRisk, setLocationRisk] = useState<LocationRiskInfo | null>(null);
  const [elevation, setElevation] = useState<number | null>(null);
  const [isCheckingElevation, setIsCheckingElevation] = useState(false);
  const lastElevationKey = useRef('');

  useEffect(() => {
    if (isOpen) setStep('confirm');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || step !== 'confirm' || !selectedLocation) {
      setIsCheckingElevation(false);
      return;
    }
    const key = `${selectedLocation.lat},${selectedLocation.lng}`;
    if (key === lastElevationKey.current) return;
    lastElevationKey.current = key;

    let cancelled = false;
    setIsCheckingElevation(true);

    const abort = new AbortController();
    void getElevation(selectedLocation.lat, selectedLocation.lng, abort.signal)
      .then((elev) => {
        if (!cancelled) setElevation(elev);
      })
      .catch(() => {
        if (!cancelled) setElevation(null);
      })
      .finally(() => {
        setIsCheckingElevation(false);
      });

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [isOpen, step, selectedLocation]);

  useEffect(() => {
    if (!isOpen || step !== 'confirm' || !selectedLocation || !onCheckLocation) {
      return;
    }

    let cancelled = false;
    setIsCheckingLocation(true);
    setLocationRisk(null);

    void onCheckLocation(selectedLocation)
      .then((risk) => {
        if (!cancelled) setLocationRisk(risk);
      })
      .catch(() => {
        if (!cancelled) setLocationRisk({ hazardLevel: null, precipMm: null });
      })
      .finally(() => {
        if (!cancelled) setIsCheckingLocation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, step, selectedLocation, onCheckLocation]);

  useEffect(() => {
    if (!isOpen) return;

    const abortController = new AbortController();
    void listDepthCategories(abortController.signal)
      .then(setDepthCategories)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        toast.error(
          error instanceof Error
            ? error.message
            : 'Unable to load flood-depth choices.',
          { position: 'top-right', autoClose: 3000 }
        );
      });

    return () => abortController.abort();
  }, [isOpen]);

  const resetForm = () => {
    setStep('confirm');
    setSelectedDepth(null);
    setSelectedReference(null);
    setHoveredLevelIndex(null);
    lastElevationKey.current = '';
  };

  const referenceProfile = selectedReference
    ? FLOOD_REFERENCE_PROFILES.find((profile) => profile.id === selectedReference)
    : null;
  const selectedLevelIndex = referenceProfile
    ? referenceProfile.levels.findIndex((level) => level.depth === selectedDepth)
    : -1;
  const selectedLevel = referenceProfile?.levels[selectedLevelIndex];
  const displayedLevel = referenceProfile?.levels[
    hoveredLevelIndex ?? Math.max(selectedLevelIndex, 0)
  ];
  const selectedDepthCategory = depthCategories.find(
    (category) => category.code === selectedDepth
  );

  const setReference = (reference: FloodReference) => {
    setSelectedReference(reference);
    setSelectedDepth(null);
    setHoveredLevelIndex(null);
  };

  const selectLevel = (index: number) => {
    if (!referenceProfile) return;
    setSelectedDepth(referenceProfile.levels[index].depth);
    setHoveredLevelIndex(null);
  };

  const handleSubmit = async () => {
    if (!selectedLocation || !selectedDepth || !referenceProfile || !selectedLevel) {
      toast.error('Please complete the report details.', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        location: selectedLocation,
        depth: selectedDepth,
        reference: {
          label: referenceProfile.label,
          landmark: selectedLevel.label,
        },
      });
      resetForm();
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to submit report. Please try again.',
        { position: 'top-right', autoClose: 3000 }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1300] flex items-end md:fixed md:right-0 md:top-0 md:bottom-0 md:items-center md:justify-end md:w-auto md:pointer-events-none">
      <div className="bg-white rounded-t-2xl shadow-2xl w-full max-h-[78vh] flex flex-col md:rounded-2xl md:max-h-[calc(100vh-12rem)] md:h-auto md:max-w-96 md:mr-6 md:pointer-events-auto">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-canvas-grey">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {step === 'confirm' ? 'Confirm Location' : 'Estimate Flood Depth'}
            </h2>
            <div className="text-xs text-slate-500 mt-1">
              Step {step === 'confirm' ? '1' : '2'} of 2
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-canvas-light rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-1">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  Selected Location
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {selectedLocation?.address || 'No location selected'}
                </div>
                {selectedLocation && (
                  <div className="text-xs text-slate-600 mt-2">
                    {selectedLocation.lat.toFixed(4)},{' '}
                    {selectedLocation.lng.toFixed(4)}
                  </div>
                )}
              </div>

              {selectedLocation && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                        <Mountain className="w-3 h-3" />
                        Elevation
                      </div>
                      {isCheckingElevation ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Checking...
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-slate-900">
                          {elevation != null
                            ? `${elevation.toFixed(1)} m`
                            : 'No data'}
                        </div>
                      )}
                      {elevation != null && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          SRTM 30m
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                        <CloudRain className="w-3 h-3" />
                        Precipitation
                      </div>
                      {isCheckingLocation ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Checking...
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-slate-900">
                          {locationRisk?.precipMm != null
                            ? `${locationRisk.precipMm.toFixed(2)} mm`
                            : 'No data'}
                        </div>
                      )}
                      {rainfallHours && locationRisk?.precipMm != null && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          {rainfallHours}h accumulation
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`rounded-lg border p-3 ${
                      locationRisk?.hazardLevel
                        ? HAZARD_META[locationRisk.hazardLevel].bg
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                      <AlertTriangle className="w-3 h-3" />
                      Flood Hazard
                    </div>
                    {isCheckingLocation ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Checking...
                      </div>
                    ) : (
                      <div
                        className={`text-sm font-bold ${
                          locationRisk?.hazardLevel
                            ? HAZARD_META[locationRisk.hazardLevel].color
                            : 'text-slate-600'
                        }`}
                      >
                        {HAZARD_META[
                          locationRisk?.hazardLevel ?? 'none'
                        ].label}
                      </div>
                    )}
                  </div>
                </>
              )}

              <p className="text-sm text-slate-600">
                Confirm this is the flooded location before continuing.
              </p>
            </div>
          )}

          {step === 'depth' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Choose a reference
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Pick what best matches the flooded area, then set the waterline.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Flood-depth reference">
                {FLOOD_REFERENCE_PROFILES.map((profile) => {
                  const Icon = REFERENCE_ICONS[profile.id];
                  const isSelected = selectedReference === profile.id;

                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setReference(profile.id)}
                      aria-pressed={isSelected}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'border-gakit-maroon bg-maroon-50 text-gakit-maroon'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-maroon-200 hover:bg-maroon-50/50'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{profile.label}</span>
                    </button>
                  );
                })}
              </div>

              {referenceProfile && displayedLevel && (
                <section className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/50">
                  <div
                    className="relative cursor-crosshair touch-pan-y"
                    onPointerMove={(event) => {
                      if (event.pointerType !== 'mouse') return;
                      const bounds = event.currentTarget.getBoundingClientRect();
                      const waterLevel = 1 - (event.clientY - bounds.top) / bounds.height;
                      setHoveredLevelIndex(
                        getClosestLevelIndex(referenceProfile.levels, waterLevel)
                      );
                    }}
                    onPointerLeave={() => setHoveredLevelIndex(null)}
                  >
                    <FloodReferenceIllustration
                      reference={referenceProfile.id}
                      waterLevel={displayedLevel.waterLevel}
                      label={referenceProfile.label}
                    />
                    <div className="pointer-events-none absolute inset-x-4 bottom-3 rounded-lg bg-white/90 px-3 py-2 text-center shadow-sm">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                        {hoveredLevelIndex != null ? 'Preview' : 'Selected waterline'}
                      </div>
                      <div className="text-sm font-bold text-slate-900">{displayedLevel.label}</div>
                    </div>
                  </div>

                  <div className="border-t border-sky-200 bg-white p-4">
                    <label className="block text-xs font-semibold text-slate-700" htmlFor="flood-depth-level">
                      Drag to estimate the flood depth
                    </label>
                    <input
                      id="flood-depth-level"
                      type="range"
                      min="0"
                      max={referenceProfile.levels.length - 1}
                      step="1"
                      value={Math.max(selectedLevelIndex, 0)}
                      onChange={(event) => selectLevel(Number(event.target.value))}
                      className="mt-3 h-2 w-full cursor-pointer accent-gakit-maroon"
                      aria-valuetext={displayedLevel.label}
                    />
                    <div className="mt-3 flex justify-between gap-1">
                      {referenceProfile.levels.map((level, index) => {
                        const isSelected = selectedLevelIndex === index;
                        return (
                          <button
                            key={level.depth}
                            type="button"
                            onClick={() => selectLevel(index)}
                            aria-label={level.label}
                            aria-pressed={isSelected}
                            className={`h-3 w-3 rounded-full ring-2 ring-white transition-colors ${
                              isSelected ? 'bg-gakit-maroon' : 'bg-sky-200 hover:bg-sky-400'
                            }`}
                          />
                        );
                      })}
                    </div>
                    {selectedDepthCategory && selectedDepth && (
                      <p className="mt-3 text-center text-sm font-semibold text-slate-900">
                        Estimated depth: {selectedDepthCategory.label} ({selectedDepthCategory.approximateCm} cm{selectedDepth === 'overhead' ? '+' : ''})
                      </p>
                    )}
                    {!selectedDepth && (
                      <p className="mt-3 text-center text-xs text-slate-500">
                        Drag the control or choose a landmark to continue.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {!referenceProfile && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  Select a person or vehicle reference to estimate the flood depth.
                </div>
              )}
            </div>
          )}

        </div>

        <div className="p-4 md:p-6 border-t border-canvas-grey bg-canvas-light/50">
          {step === 'confirm' ? (
            <button
              onClick={() => setStep('depth')}
              disabled={!selectedLocation}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-gakit-maroon hover:bg-maroon-800 text-white disabled:bg-canvas-grey disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              Confirm location
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep('confirm')}
                className="py-3 px-6 rounded-lg font-semibold text-slate-700 bg-canvas-grey hover:bg-canvas-grey/80 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedDepth || isSubmitting}
                className="py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-gakit-maroon hover:bg-maroon-800 text-white disabled:bg-canvas-grey disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  'Submit report'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
