'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bike, Bus, Car, CloudRain, Loader2, MapPin, Mountain, UserRound, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { listDepthCategories } from '@/app/public-view/actions/public.view';
import { getElevation } from '@/lib/map/elevation';
import {
  DEPTH_PRESETS,
  FLOOD_REFERENCE_META,
  depthCodeFromCm,
  depthCriticality,
  fallbackCategoryLabel,
  type DepthCriticality,
  type FloodReference,
} from '@/lib/reports/depthReferences';
import { FloodReferenceIllustration } from '@/components/reporting/FloodReferenceIllustration';
import { FloodDepthScale } from '@/components/reporting/FloodDepthScale';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
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
    depthCm: number;
    reference: { id: FloodReference; label: string; landmark: string };
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

const PRESET_CHIP_BASE_CLASSES =
  'border-slate-200 bg-white text-slate-600 hover:bg-slate-100';

const CRITICALITY_CHIP_SELECTED: Record<DepthCriticality, string> = {
  low: 'border-green-500 bg-green-100 text-green-800',
  medium: 'border-amber-500 bg-amber-100 text-amber-800',
  critical: 'border-red-500 bg-red-100 text-red-800',
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
  const [selectedCm, setSelectedCm] = useState<number | null>(null);
  const [customCm, setCustomCm] = useState('');
  const [hoveredCm, setHoveredCm] = useState<number | null>(null);
  const [selectedReference, setSelectedReference] = useState<FloodReference>('adult');
  const [depthCategories, setDepthCategories] = useState<FloodDepthCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationRisk, setLocationRisk] = useState<LocationRiskInfo | null>(null);
  const [elevation, setElevation] = useState<number | null>(null);
  const [isCheckingElevation, setIsCheckingElevation] = useState(false);
  const lastElevationKey = useRef('');

  useEffect(() => {
    if (isOpen) setStep('confirm');
    if (!isOpen) setCustomCm('');
  }, [isOpen]);

  // Keep the exact-centimeter input in step with any selection source
  // (strips, presets, or typing into the input itself).
  useEffect(() => {
    if (selectedCm != null) setCustomCm(String(selectedCm));
  }, [selectedCm]);

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
    setSelectedCm(null);
    setSelectedReference('adult');
    setHoveredCm(null);
    lastElevationKey.current = '';
  };

  const referenceMeta =
    FLOOD_REFERENCE_META.find((meta) => meta.id === selectedReference) ?? null;
  const selectedCode = selectedCm != null ? depthCodeFromCm(selectedCm) : null;
  const selectedDepthCategory = selectedCode
    ? depthCategories.find((category) => category.code === selectedCode) ?? null
    : null;

  const setReference = (reference: FloodReference) => {
    setSelectedReference(reference);
    setSelectedCm(null);
    setHoveredCm(null);
  };

  const selectDepth = (cm: number) => {
    setSelectedCm(cm);
  };

  /** Exact-centimeter input: any depth 1–999 cm; readings past the scale's
   * 250 cm top clamp the visual but still map to a category on submit. */
  const handleCustomCmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setCustomCm(raw);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setSelectedCm(Math.min(parsed, 999));
    }
  };

  const handleSubmit = async () => {
    if (!selectedLocation || selectedCm == null || !referenceMeta || selectedCode == null) {
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
        depth: selectedCode,
        depthCm: selectedCm,
        reference: {
          id: selectedReference,
          label: referenceMeta.label,
          landmark: `~${selectedCm} cm`,
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
                          <Loader2 className="w-3 h-3 animate-spin" />
                          ...
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-bold text-slate-900 mt-0.5">
                            {elevation != null
                              ? `${elevation.toFixed(1)} m`
                              : 'No data'}
                          </div>
                          {elevation != null && (
                            <div className="text-[10px] text-slate-400">
                              SRTM 30m
                            </div>
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
                          <Loader2 className="w-3 h-3 animate-spin" />
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
                            <div className="text-[10px] text-slate-400">
                              {rainfallHours}h accum.
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-col items-center text-center px-2">
                      <AlertTriangle className={`w-3.5 h-3.5 mb-1 ${locationRisk?.hazardLevel ? HAZARD_META[locationRisk.hazardLevel].color.replace('text-', 'text-') : 'text-slate-400'}`} />
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
                        Hazard
                      </div>
                      {isCheckingLocation ? (
                        <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          ...
                        </div>
                      ) : (
                        <div className={`text-sm font-bold mt-0.5 ${locationRisk?.hazardLevel ? HAZARD_META[locationRisk.hazardLevel].color : 'text-slate-600'}`}>
                          {HAZARD_META[locationRisk?.hazardLevel ?? 'none'].label}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-sm text-slate-600">
                Confirm this is the flooded location before continuing.
              </p>
            </div>
          )}

          {step === 'depth' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Choose a reference:
                  </h3>
                  <div className="w-40 shrink-0">
                    <FilterDropdown<FloodReference>
                      value={selectedReference}
                      onSelect={(id) => setReference(id)}
                      options={FLOOD_REFERENCE_META.map((meta) => {
                        const Icon = REFERENCE_ICONS[meta.id];
                        return {
                          value: meta.id,
                          label: meta.label,
                          icon: <Icon className="h-3.5 w-3.5 shrink-0" />,
                        };
                      })}
                      triggerIcon={(() => {
                        const Icon = REFERENCE_ICONS[selectedReference];
                        return <Icon className="h-3.5 w-3.5 shrink-0" />;
                      })()}
                      triggerLabel={referenceMeta?.label ?? 'Choose a reference'}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Pick a reference that best matches the flooded area.
                </p>
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">
                    Set the flood depth:
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choose a preset, drag the slider, or input an exact depth.
                  </p>
                </div>
              </div>
              {referenceMeta && (
                <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
                  <div className="flex items-stretch gap-1">
                    <FloodReferenceIllustration
                      reference={referenceMeta.id}
                      depthCm={hoveredCm ?? selectedCm ?? 0}
                      label={referenceMeta.label}
                      className="h-56 min-w-0 flex-1"
                    />
                    <FloodDepthScale
                      value={selectedCm}
                      preview={hoveredCm}
                      onSelect={selectDepth}
                      onPreview={setHoveredCm}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    {DEPTH_PRESETS.map((preset) => {
                      const isSelected = selectedCode === preset.code;
                      const criticality = depthCriticality(preset.cm);

                      return (
                        <button
                          key={preset.code}
                          type="button"
                          onClick={() => selectDepth(preset.cm)}
                          aria-pressed={isSelected}
                          title={`About ${preset.cm} cm — sets the waterline at ${preset.shortLabel.toLowerCase()} level`}
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${isSelected ? CRITICALITY_CHIP_SELECTED[criticality] : PRESET_CHIP_BASE_CLASSES
                            }`}
                        >
                          {preset.shortLabel}
                        </button>
                      );
                    })}
                    <span className="text-xs text-slate-400">or</span>
                    <label className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        inputMode="numeric"
                        value={customCm}
                        onChange={handleCustomCmChange}
                        aria-label="Exact water depth in centimeters"
                        className="w-14 bg-transparent text-xs font-semibold text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-slate-400">cm</span>
                    </label>
                  </div>


                  {selectedCm != null && selectedCode && (
                    <p className="mt-3 text-center text-sm font-semibold text-slate-900">
                      Approx. depth: ~{selectedCm} cm
                      {selectedDepthCategory ? `  (${selectedDepthCategory.label})` : ` (${fallbackCategoryLabel(selectedCode)})`}
                    </p>
                  )}
                </section>
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
                disabled={selectedCm == null || isSubmitting}
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
