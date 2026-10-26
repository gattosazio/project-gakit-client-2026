'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { Droplets } from 'lucide-react';
import { LocationDialog, LOCATION_DIALOG_PRIMARY_BUTTON, LOCATION_DIALOG_SECONDARY_BUTTON } from '@/components/map/LocationDialog';
import { ModalOnboardingTour } from '@/components/onboarding/HazardAssessmentTour';
import { ReportLocationPreview } from '@/components/reporting/ReportLocationPreview';
import { Spinner } from '@/components/ui/Spinner';
import { REPORT_TOUR_STEPS } from '@/lib/onboarding/reportSteps';
import { focusOnboardingTarget } from '@/lib/onboarding/focus';
import {
  getReportGuideSeen,
  getServerModalGuideSeen,
  markModalGuideSeen,
  subscribeToModalGuides,
} from '@/lib/onboarding/storage';
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
import { PhotoCapture } from '@/components/reporting/PhotoCapture';
import type { ObservationMetadata, SelectedLocation } from '@/types/report';
import { reportObservationMetadata } from '@/lib/reports/observationMetadata';
import type { PreparedPhoto } from '@/lib/reports/photoUpload';
import type { FloodDepth } from '@/app/public-view/actions/publicView';
import { isRawCoordinateString, reverseGeocode } from '@/lib/map/geoUtils';

const ReportLocationPicker = dynamic(() => import('@/components/reporting/ReportLocationPicker').then(module => module.ReportLocationPicker), { ssr: false });

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onLocationChange?: (location: SelectedLocation) => Promise<void>;
  selectedLocation: SelectedLocation | null;
  onSubmit: (data: {
    location: SelectedLocation;
    depth: FloodDepth;
    depthCm: number;
    observation: ObservationMetadata;
    observedAt: string;
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
  const [selectedCm, setSelectedCm] = useState<number | null>(null);
  const [customCm, setCustomCm] = useState('');
  const [observationTime, setObservationTime] = useState('');
  const [observedEarlier, setObservedEarlier] = useState(false);
  const [selectedReference, setSelectedReference] = useState<FloodReference>('adult');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState<SelectedLocation | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const guideSeen = useSyncExternalStore(
    subscribeToModalGuides,
    getReportGuideSeen,
    getServerModalGuideSeen
  );
  const tourAutoStartedRef = useRef(false);
  const depthHeadingRef = useRef<HTMLHeadingElement>(null);
  const displayAddress = selectedLocation && isRawCoordinateString(selectedLocation.address)
    && resolvedLocation?.lat === selectedLocation.lat && resolvedLocation.lng === selectedLocation.lng
    ? resolvedLocation.address : selectedLocation?.address;

  useEffect(() => {
    if (!isOpen || !selectedLocation) {
      tourAutoStartedRef.current = false;
      return;
    }
    if (withinCity === false || guideSeen || tourAutoStartedRef.current || adjustingLocation) return;
    tourAutoStartedRef.current = true;
    setTourStepIndex(0);
    setTourActive(true);
  }, [isOpen, selectedLocation, withinCity, guideSeen, adjustingLocation]);

  useEffect(() => {
    if (selectedLocation && isRawCoordinateString(selectedLocation.address)) {
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
  }, [selectedLocation]);

  const resetForm = () => {
    setAdjustingLocation(false);
    setSelectedCm(null);
    setCustomCm('');
    setObservationTime('');
    setObservedEarlier(false);
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

  const handleTourEnd = () => {
    markModalGuideSeen('report');
    setTourActive(false);
    setTourStepIndex(0);
    window.requestAnimationFrame(() => focusOnboardingTarget(depthHeadingRef.current));
  };

  const startTour = () => {
    setTourStepIndex(0);
    setTourActive(true);
  };

  const referenceMeta =
    FLOOD_REFERENCE_META.find((meta) => meta.id === selectedReference) ?? null;
  const selectedCode = selectedCm != null ? depthCodeFromCm(selectedCm) : null;

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
    const observed = observedEarlier ? new Date(observationTime) : new Date();
    if (!Number.isFinite(observed.getTime()) || observed.getTime() > Date.now() + 300000) {
      toast.error('Choose a valid observation time that is not in the future.');
      return;
    }
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
        observation: reportObservationMetadata(selectedLocation, 'estimated'),
        observedAt: observed.toISOString(),
        reference: {
          id: selectedReference,
          label: referenceMeta.label,
          landmark: `${selectedCm} cm`,
        },
        photo: photo ?? undefined,
      });
      markModalGuideSeen('report');
      setTourActive(false);
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
    if (tourActive) markModalGuideSeen('report');
    setTourActive(false);
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <LocationDialog isOpen={isOpen} onClose={handleClose} title="Report flooding"
      subtitle="Share what you observed" icon={Droplets} closeLabel="Close report modal"
      busy={isSubmitting} suspended={adjustingLocation}
      tour={tourActive ? (
        <ModalOnboardingTour
          isActive
          stepIndex={tourStepIndex}
          onStepChange={setTourStepIndex}
          onClose={handleTourEnd}
          onFinish={handleTourEnd}
          steps={REPORT_TOUR_STEPS}
          tourTitle="Report tour"
        />
      ) : undefined}
      helpCta={selectedLocation && withinCity !== false ? (
        <button type="button" onClick={startTour} disabled={isSubmitting}
          className="min-h-9 rounded px-2 text-[11px] font-semibold text-slate-500 underline-offset-2 transition-colors hover:text-slate-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 disabled:opacity-50">
          Need help?
        </button>
      ) : undefined}
      footer={withinCity === false
        ? <button type="button" onClick={handleClose} className={LOCATION_DIALOG_PRIMARY_BUTTON}>Back to map</button>
        : <>
          <button type="button" onClick={handleClose} disabled={isSubmitting} className={LOCATION_DIALOG_SECONDARY_BUTTON}>Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={selectedCm == null || !selectedLocation || isSubmitting}
            className={LOCATION_DIALOG_PRIMARY_BUTTON}>
            {isSubmitting ? <><Spinner size="sm" />Submitting…</> : 'Submit report'}
          </button>
        </>}>
          {selectedLocation && <ReportLocationPreview location={selectedLocation} address={displayAddress} disabled={isSubmitting}
            onAdjust={onLocationChange ? () => setAdjustingLocation(true) : undefined} />}

          {withinCity === false ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <div className="font-semibold mb-1">Outside Iligan City</div>
              Choose a location within Iligan City to report.
            </div>
          ) : (
            <div className="space-y-3">
              <section data-tour="report-depth" aria-labelledby={`${titleId}-depth-heading`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 ref={depthHeadingRef} id={`${titleId}-depth-heading`} tabIndex={-1}
                    className="rounded text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2">
                    Estimated water depth
                  </h3>
                </div>
                <div className="mb-3 grid grid-cols-5 gap-1.5" aria-label="Depth categories">
                  {DEPTH_PRESETS.map(preset => {
                    const selected = selectedCode === preset.code;
                    return <button key={preset.code} type="button" onClick={() => selectDepth(preset.cm)} disabled={isSubmitting}
                      aria-pressed={selected} title={`About ${preset.cm} cm — ${preset.shortLabel}`}
                      className={`min-h-10 rounded-lg px-0.5 py-2 text-[11px] font-semibold transition-colors disabled:opacity-60 sm:text-xs ${selected ? CRITICALITY_CHIP_SELECTED[depthCriticality(preset.cm)] : PRESET_CHIP_BASE_CLASSES}`}>
                      {preset.shortLabel}
                    </button>;
                  })}
                </div>
                {referenceMeta && <FloodDepthPicker key={referenceMeta.id} reference={referenceMeta.id}
                  label={referenceMeta.label} value={selectedCm} onSelect={selectDepth} disabled={isSubmitting}
                  referenceControl={<select aria-label="Visual reference" value={selectedReference}
                    onChange={event => setSelectedReference(event.target.value as FloodReference)} disabled={isSubmitting}
                    className="h-8 min-w-0 max-w-[55%] rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-gakit-maroon">
                    {FLOOD_REFERENCE_META.map(meta => <option key={meta.id} value={meta.id}>{meta.label}</option>)}
                  </select>} />}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label htmlFor={`${titleId}-depth`} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
                    <input id={`${titleId}-depth`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3}
                      value={customCm} onChange={handleCustomCmChange} disabled={isSubmitting} placeholder="Depth in cm"
                      aria-label="Reported water depth in centimeters"
                      className="h-8 w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon" />
                    <span className="text-xs text-slate-500">cm</span>
                  </label>
                  <label className="flex h-10 items-center text-xs text-slate-600">
                    <span className="sr-only">Observed</span>
                    <select value={observedEarlier ? 'earlier' : 'now'} onChange={event => setObservedEarlier(event.target.value === 'earlier')}
                      disabled={isSubmitting} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-gakit-maroon">
                      <option value="now">Observed just now</option><option value="earlier">Observed earlier</option>
                    </select>
                  </label>
                </div>
              </section>
              <PhotoCapture compact photo={photo} onChange={setPhoto} disabled={isSubmitting} />
              {observedEarlier && <label className="block text-xs text-slate-600">
                Date and time
                <input type="datetime-local" value={observationTime} onChange={event => setObservationTime(event.target.value)}
                  disabled={isSubmitting} className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-xs" />
              </label>}
            </div>
          )}
    </LocationDialog>
    {adjustingLocation && selectedLocation && onLocationChange && <ReportLocationPicker initialLocation={selectedLocation}
      onClose={() => setAdjustingLocation(false)} onConfirm={async location => {
        await onLocationChange(location);
        setAdjustingLocation(false);
      }} />}
    </>
  );
}
