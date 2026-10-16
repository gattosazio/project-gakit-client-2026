'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import dynamic from 'next/dynamic';
import { Bike, Bus, Car, MapPin, UserRound, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'react-toastify';
import {
  DEPTH_PRESETS,
  FLOOD_REFERENCE_META,
  depthCodeFromCm,
  depthCriticality,
  type DepthCriticality,
  type FloodReference,
} from '@/lib/reports/depthReferences';
import { FloodDepthPicker } from '@/components/reporting/FloodDepthPicker';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { PhotoCapture } from '@/components/reporting/PhotoCapture';
import type { SelectedLocation } from '@/types/report';
import type { PreparedPhoto } from '@/lib/reports/photoUpload';
import type { FloodDepth } from '@/app/public-view/actions/publicView';
import { isRawCoordinateString, reverseGeocode } from '@/lib/map/geoUtils';

const ReportLocationPicker = dynamic(() => import('@/components/reporting/ReportLocationPicker').then(module => module.ReportLocationPicker), { ssr: false });

const REFERENCE_ICONS: Record<FloodReference, typeof Car> = {
  adult: UserRound,
  motorcycle: Bike,
  sedan: Car,
  suv: Car,
  jeepney: Car,
  bus: Bus,
};

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onLocationChange?: (location: SelectedLocation) => Promise<void>;
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
    /** Pre-compressed evidence photo, uploaded after the report is created. */
    photo?: PreparedPhoto;
  }) => Promise<void>;
  /** Server-authoritative geofence result; false disables reporting (courtesy UI only). */
  withinCity?: boolean | null;
}

const PRESET_CHIP_BASE_CLASSES =
  'bg-white text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/90 hover:bg-slate-50 hover:text-slate-900';

const CRITICALITY_CHIP_SELECTED: Record<DepthCriticality, string> = {
  low: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300 font-bold shadow-xs',
  medium: 'bg-amber-50 text-amber-800 ring-1 ring-amber-300 font-bold shadow-xs',
  critical: 'bg-rose-50 text-rose-800 ring-1 ring-rose-300 font-bold shadow-xs',
};

export function ReportModal({
  isOpen,
  onClose,
  onSuccess,
  onLocationChange,
  selectedLocation,
  onSubmit,
  withinCity,
}: ReportModalProps) {
  const titleId = useId();
  const [adjustingLocation, setAdjustingLocation] = useState(false);
  const panelRef = useModalA11y<HTMLDivElement>({ enabled: isOpen && !adjustingLocation });
  const [selectedCm, setSelectedCm] = useState<number | null>(null);
  const [customCm, setCustomCm] = useState('');
  const [selectedReference, setSelectedReference] = useState<FloodReference>('adult');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [displayAddress, setDisplayAddress] = useState(selectedLocation?.address || '');

  useEffect(() => {
    if (!selectedLocation) {
      setDisplayAddress('');
      return;
    }
    setDisplayAddress(selectedLocation.address);
    if (isRawCoordinateString(selectedLocation.address)) {
      let cancelled = false;
      void reverseGeocode(selectedLocation.lat, selectedLocation.lng).then((resolved) => {
        if (!cancelled && resolved && !isRawCoordinateString(resolved)) {
          setDisplayAddress(resolved);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [selectedLocation]);

  const resetForm = () => {
    setAdjustingLocation(false);
    setSelectedCm(null);
    setCustomCm('');
    setSelectedReference('adult');
    setPhoto(null);
  };

  // Reset transient form state when the modal opens/closes.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (!isOpen) {
        setCustomCm('');
        setSelectedCm(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (adjustingLocation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        resetForm();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isSubmitting, adjustingLocation]);

  const referenceMeta =
    FLOOD_REFERENCE_META.find((meta) => meta.id === selectedReference) ?? null;
  const selectedCode = selectedCm != null ? depthCodeFromCm(selectedCm) : null;

  const setReference = (reference: FloodReference) => {
    setSelectedReference(reference);
  };

  const selectDepth = useCallback((cm: number) => {
    setSelectedCm(cm);
    setCustomCm(String(cm));
  }, []);

  const handleCustomCmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/\D/g, '').slice(0, 3);
    setCustomCm(raw);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setSelectedCm(Math.min(parsed, 999));
    } else {
      setSelectedCm(null);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (withinCity === false || !selectedLocation || selectedCm == null || selectedCm < 1 || !referenceMeta || selectedCode == null) {
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
        photo: photo ?? undefined,
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
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <div style={adjustingLocation ? { display: 'none' } : undefined} className="fixed inset-0 z-[1400] flex items-end justify-center pointer-events-none md:items-center md:justify-end md:p-6">
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs pointer-events-auto md:hidden"
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 bg-white rounded-t-3xl shadow-2xl w-full max-h-[90dvh] flex flex-col pointer-events-auto md:rounded-2xl md:max-h-[90dvh] md:h-auto md:max-w-[28rem] border border-slate-200/90 ring-1 ring-slate-900/5 outline-none"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-canvas-grey">
          <div>
            <h2 id={titleId} className="text-base font-bold text-slate-900 font-heading">
              Report Flooding
            </h2>
            <div className="text-xs text-slate-500 mt-1">
              Share the location and estimated water depth
            </div>
          </div>
          <button
            onClick={handleClose}
                disabled={isSubmitting}
            aria-label="Close report modal"
            className="p-1.5 hover:bg-canvas-light text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
          {selectedLocation && (
            <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 mb-1">
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gakit-maroon shrink-0" />
                Flooded location</span>
                {onLocationChange && <button type="button" onClick={() => setAdjustingLocation(true)} disabled={isSubmitting}
                  className="rounded px-1 py-0.5 text-[10px] font-semibold text-gakit-maroon hover:bg-maroon-50 focus-visible:outline-gakit-maroon disabled:opacity-50">Adjust location</button>}
              </div>
              <div className="text-xs font-semibold leading-4 text-slate-900 line-clamp-2">
                {displayAddress || selectedLocation.address}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
              </div>
            </div>
          )}

          {withinCity === false ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <div className="font-semibold mb-1">Outside Iligan City</div>
              Flood reports can only be submitted within Iligan City boundaries.
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-800">Water depth</h3>
                <span className="text-[10px] text-slate-400">Drag, choose a level, or enter cm</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEPTH_PRESETS.map(preset => {
                  const selected = selectedCode === preset.code;
                  return <button key={preset.code} type="button" onClick={() => selectDepth(preset.cm)} disabled={isSubmitting}
                    aria-pressed={selected} title={`About ${preset.cm} cm — ${preset.shortLabel}`}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors disabled:opacity-60 ${selected ? CRITICALITY_CHIP_SELECTED[depthCriticality(preset.cm)] : PRESET_CHIP_BASE_CLASSES}`}>
                    <span className="whitespace-nowrap text-[11px] font-semibold">{preset.shortLabel}</span>
                    <span className="text-[9px] opacity-65">{preset.cm}</span>
                  </button>;
                })}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2">
                <label htmlFor={`${titleId}-depth`} className="text-[11px] font-medium text-slate-600">Exact depth <span className="font-normal text-slate-400">(optional)</span></label>
                <div className="flex items-center gap-1.5">
                  <input id={`${titleId}-depth`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3}
                    value={customCm} onChange={handleCustomCmChange} disabled={isSubmitting} placeholder="e.g. 45"
                    aria-label="Exact water depth in centimeters"
                    className="h-8 w-16 rounded-md border border-slate-200 bg-slate-50 px-2 text-center text-xs font-semibold tabular-nums text-slate-800 outline-none focus:border-gakit-maroon" />
                  <span className="text-[11px] text-slate-400">cm</span>
                </div>
              </div>
              {referenceMeta && <section className="my-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold text-slate-500">Visual reference</div>
                  <FilterDropdown<FloodReference> value={selectedReference} onSelect={setReference} size="sm"
                    triggerIcon={(() => { const Icon = REFERENCE_ICONS[selectedReference]; return <Icon className="h-3.5 w-3.5 shrink-0" />; })()}
                    options={FLOOD_REFERENCE_META.map(meta => { const Icon = REFERENCE_ICONS[meta.id]; return { value: meta.id, label: meta.label, icon: <Icon className="h-3.5 w-3.5 shrink-0" /> }; })}
                    triggerLabel={referenceMeta.label} />
                </div>
                <FloodDepthPicker key={referenceMeta.id} reference={referenceMeta.id} label={referenceMeta.label} value={selectedCm} onSelect={selectDepth} disabled={isSubmitting} />
              </section>}

              <section>
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Photo evidence
                </h3>
                <PhotoCapture photo={photo} onChange={setPhoto} disabled={isSubmitting} />
              </section>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {withinCity === false ? (
            <button
              type="button"
              onClick={handleClose}
                disabled={isSubmitting}
              className="w-full py-2.5 px-6 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors text-xs"
            >
              Close
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="h-9 px-3 rounded-lg font-semibold text-slate-700 bg-canvas-grey hover:bg-slate-300 transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={selectedCm == null || !selectedLocation || isSubmitting}
                className="h-9 px-3 rounded-lg font-semibold transition-all duration-150 bg-gakit-maroon hover:bg-maroon-800 text-white disabled:bg-canvas-grey disabled:text-slate-400 disabled:cursor-not-allowed text-xs"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" iconClassName="bg-white" />
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
    {adjustingLocation && selectedLocation && onLocationChange && <ReportLocationPicker initialLocation={selectedLocation}
      onClose={() => setAdjustingLocation(false)} onConfirm={async location => {
        await onLocationChange(location);
        setAdjustingLocation(false);
      }} />}
    </>
  );
}
