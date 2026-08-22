'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CloudRain, Loader2, MapPin, Mountain, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { listDepthCategories } from '@/app/public-view/actions/public.view';
import { getElevation } from '@/lib/map/elevation';
import type { FloodDepth, FloodDepthCategory } from '@/app/public-view/actions/public.view';
import type { LocationRiskInfo } from '@/components/PublicMap';

type ReportStep = 'confirm' | 'depth';

interface DepthChoice {
  id: FloodDepth;
  label: string;
  description: string;
  range: string;
  waterLevel: number;
  selectedColor: string;
  unselectedHoverColor: string;
  textClass: string;
  waterFill: string;
}

// Single source of truth for the depth picker — labels are bilingual
// (Filipino + English) and ranges match the server's depth categories.
const DEPTH_CHOICES: DepthChoice[] = [
  {
    id: 'ankle',
    label: 'Abot-bukong-bukong (Ankle Deep)',
    description: 'Pantay sa bukong-bukong ang tubig.',
    range: '10–20 cm (0′3″–0′7″)',
    waterLevel: 0.1,
    selectedColor: 'border-sky-500 bg-sky-50',
    unselectedHoverColor: 'sky',
    textClass: 'text-sky-600',
    waterFill: '#3b82f6',
  },
  {
    id: 'knee',
    label: 'Abot-tuhod (Knee Deep)',
    description: 'Pantay sa tuhod ang tubig.',
    range: '45–55 cm (1′5″–1′8″)',
    waterLevel: 0.33,
    selectedColor: 'border-cyan-500 bg-cyan-50',
    unselectedHoverColor: 'cyan',
    textClass: 'text-cyan-600',
    waterFill: '#3b82f6',
  },
  {
    id: 'waist',
    label: 'Abot-baywang (Waist Deep)',
    description: 'Pantay sa baywang ang tubig.',
    range: '80–100 cm (2′6″–3′3″)',
    waterLevel: 0.58,
    selectedColor: 'border-amber-500 bg-amber-50',
    unselectedHoverColor: 'amber',
    textClass: 'text-amber-600',
    waterFill: '#3b82f6',
  },
  {
    id: 'head',
    label: 'Abot-ulo (Head Deep)',
    description: 'Pantay sa ulo ang tubig.',
    range: '155–163 cm (5′1″–5′4″)',
    waterLevel: 0.78,
    selectedColor: 'border-orange-500 bg-orange-50',
    unselectedHoverColor: 'orange',
    textClass: 'text-orange-600',
    waterFill: '#3b82f6',
  },
  {
    id: 'overhead',
    label: 'Lampas-tao (Overhead)',
    description: 'Lampas tao ang tubig.',
    range: '164+ cm (5′4″+)',
    waterLevel: 1.0,
    selectedColor: 'border-red-600 bg-red-50',
    unselectedHoverColor: 'red',
    textClass: 'text-red-600',
    waterFill: '#7f1d1d',
  },
];

const HOVER_BORDER: Record<string, string> = {
  sky: 'hover:border-sky-300',
  cyan: 'hover:border-cyan-300',
  amber: 'hover:border-amber-300',
  orange: 'hover:border-orange-300',
  red: 'hover:border-red-300',
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
    lastElevationKey.current = '';
  };

  const handleSubmit = async () => {
    if (!selectedLocation || !selectedDepth) {
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
              {step === 'confirm' ? 'Confirm Location' : 'Flood Depth'}
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
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                Gaano kalalim ang baha sa lokasyong ito?
              </label>
              <div className="space-y-3">
                {DEPTH_CHOICES.map((depth) => {
                  return (
                  <button
                    key={depth.id}
                    onClick={() => setSelectedDepth(depth.id)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left bg-white ${
                      selectedDepth === depth.id
                        ? depth.selectedColor
                        : `border-canvas-grey ${HOVER_BORDER[depth.unselectedHoverColor]}`
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative flex-shrink-0 w-10 h-16">
                        <svg viewBox="0 0 40 64" className="w-full h-full">
                          <circle cx="20" cy="8" r="6" fill="#94a3b8" />
                          <rect x="14" y="16" width="12" height="24" rx="3" fill="#94a3b8" />
                          <rect x="10" y="20" width="6" height="16" rx="2" fill="#94a3b8" />
                          <rect x="24" y="20" width="6" height="16" rx="2" fill="#94a3b8" />
                          <rect x="14" y="40" width="5" height="20" rx="2" fill="#94a3b8" />
                          <rect x="21" y="40" width="5" height="20" rx="2" fill="#94a3b8" />
                          <clipPath id={`water-${depth.id}`}>
                            <rect x="0" y={64 - depth.waterLevel * 64} width="40" height={depth.waterLevel * 64} />
                          </clipPath>
                          <rect
                            x="0"
                            y="0"
                            width="40"
                            height="64"
                            fill={depth.waterFill}
                            opacity="0.4"
                            clipPath={`url(#water-${depth.id})`}
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900">
                          {depth.label}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          {depth.description}
                        </div>
                        <div className={`text-xs font-bold mt-1 ${depth.textClass}`}>
                          {depth.range}
                        </div>
                      </div>
                    </div>
                  </button>
                  );
                })}
              </div>
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
