'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bike, Bus, Car, Loader2, MapPin, UserRound, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { listDepthCategories } from '@/app/public-view/actions/publicView';
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
import { SiteConditionsCard } from '@/components/reporting/SiteConditionsCard';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import type { FloodDepth, FloodDepthCategory } from '@/app/public-view/actions/publicView';
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

const PRESET_CHIP_BASE_CLASSES =
  'bg-white text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/90 hover:bg-slate-50 hover:text-slate-900 active:scale-95';

const CRITICALITY_CHIP_SELECTED: Record<DepthCriticality, string> = {
  low: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300 font-bold shadow-xs',
  medium: 'bg-amber-50 text-amber-800 ring-1 ring-amber-300 font-bold shadow-xs',
  critical: 'bg-rose-50 text-rose-800 ring-1 ring-rose-300 font-bold shadow-xs',
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

  const resetForm = useCallback(() => {
    setStep('confirm');
    setSelectedCm(null);
    setCustomCm('');
    setSelectedReference('adult');
    setHoveredCm(null);
    lastElevationKey.current = '';
  }, []);

  // Reset transient form state when the modal opens/closes.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (isOpen) setStep('confirm');
      else setCustomCm('');
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetForm();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, resetForm]);

  useEffect(() => {
    if (!isOpen || step !== 'confirm' || !selectedLocation) return;
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
  }, [isOpen, step, selectedLocation, elevation]);

  useEffect(() => {
    if (!isOpen || step !== 'confirm' || !selectedLocation || !onCheckLocation) {
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
        if (!cancelled) setLocationRisk({ hazardLevel: null, precipMm: null });
      } finally {
        if (!cancelled) setIsCheckingLocation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, step, selectedLocation, rainfallHours, onCheckLocation]);

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

  const referenceMeta =
    FLOOD_REFERENCE_META.find((meta) => meta.id === selectedReference) ?? null;
  const selectedCode = selectedCm != null ? depthCodeFromCm(selectedCm) : null;
  const selectedDepthCategory = selectedCode
    ? depthCategories.find((category) => category.code === selectedCode) ?? null
    : null;

  const setReference = (reference: FloodReference) => {
    setSelectedReference(reference);
    setSelectedCm(null);
    setCustomCm('');
    setHoveredCm(null);
  };

  const selectDepth = (cm: number) => {
    setSelectedCm(cm);
    setCustomCm(String(cm));
  };

  /** Exact-centimeter input: any depth 1–999 cm; readings past the scale's
   * 250 cm top clamp the visual but still map to a category on submit. */
  const handleCustomCmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/\D/g, '').slice(0, 3);
    setCustomCm(raw);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setSelectedCm(Math.min(parsed, 999));
    } else if (raw === '') {
      setSelectedCm(null);
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
          landmark: `${selectedCm} cm`,
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
    <div className="fixed inset-0 z-[1400] flex items-end justify-center pointer-events-none md:items-center md:justify-end md:p-6">
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs pointer-events-auto md:hidden"
        onClick={handleClose}
      />
      <div className="relative z-10 bg-white rounded-t-3xl shadow-2xl w-full max-h-[82vh] flex flex-col pointer-events-auto md:rounded-2xl md:max-h-[calc(100vh-8rem)] md:h-auto md:max-w-96 border border-slate-200/90 ring-1 ring-slate-900/5">
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
            aria-label="Close report modal"
            className="p-1.5 hover:bg-canvas-light text-slate-400 hover:text-slate-700 rounded-xl transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
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
                <SiteConditionsCard
                  elevation={elevation}
                  isCheckingElevation={isCheckingElevation}
                  locationRisk={locationRisk}
                  isCheckingLocation={isCheckingLocation}
                  rainfallHours={rainfallHours}
                />
              )}

              <p className="text-sm text-slate-600">
                Confirm this is the flooded location before continuing.
              </p>
            </div>
          )}

          {step === 'depth' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="shrink-0 whitespace-nowrap text-sm font-semibold text-slate-900">
                    Choose a reference:
                  </h3>
                  <div className="w-40 sm:w-44 shrink-0">
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
                      size="sm"
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
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                            isSelected
                              ? CRITICALITY_CHIP_SELECTED[criticality]
                              : PRESET_CHIP_BASE_CLASSES
                          }`}
                        >
                          {preset.shortLabel}
                        </button>
                      );
                    })}
                    <span className="text-xs font-medium text-slate-400">or</span>
                    <label className="flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/90 transition-all duration-150 focus-within:ring-2 focus-within:ring-gakit-maroon">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={3}
                        value={customCm}
                        onChange={handleCustomCmChange}
                        onKeyDown={(event) => {
                          if (['e', 'E', '+', '-', '.', ','].includes(event.key)) {
                            event.preventDefault();
                          }
                        }}
                        aria-label="Exact water depth in centimeters"
                        placeholder="0"
                        className="w-8 bg-transparent text-center text-xs font-bold text-slate-800 outline-none [appearance:textfield]"
                      />
                      <span className="text-[11px] font-medium text-slate-400">cm</span>
                    </label>
                  </div>
                </section>
              )}
            </div>
          )}

        </div>

        <div className="p-4 pb-8 sm:pb-4 md:p-6 border-t border-canvas-grey bg-canvas-light/50">
          {step === 'confirm' ? (
            <button
              onClick={() => setStep('depth')}
              disabled={!selectedLocation}
              className="w-full py-3 px-6 rounded-xl font-semibold transition-all duration-150 bg-gakit-maroon hover:bg-maroon-800 active:scale-[0.98] text-white disabled:bg-canvas-grey disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              Confirm location
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep('confirm')}
                className="py-3 px-6 rounded-xl font-semibold text-slate-700 bg-canvas-grey hover:bg-slate-300 active:scale-[0.98] transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={selectedCm == null || isSubmitting}
                className="py-3 px-6 rounded-xl font-semibold transition-all duration-150 bg-gakit-maroon hover:bg-maroon-800 active:scale-[0.98] text-white disabled:bg-canvas-grey disabled:text-slate-400 disabled:cursor-not-allowed"
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
