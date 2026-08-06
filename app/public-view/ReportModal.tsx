'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { listDepthCategories } from './actions/public.view';
import type { FloodDepth, FloodDepthCategory } from './actions/public.view';

type ReportStep = 'confirm' | 'depth';

const DEPTH_PRESENTATION: Record<
  FloodDepth,
  { localLabel: string; description: string; waterLevel: number }
> = {
  ankle: {
    localLabel: 'Abot-bukong-bukong',
    description: 'Pantay sa bukong-bukong ang tubig.',
    waterLevel: 0.1,
  },
  knee: {
    localLabel: 'Abot-tuhod',
    description: 'Pantay sa tuhod ang tubig.',
    waterLevel: 0.33,
  },
  waist: {
    localLabel: 'Abot-baywang',
    description: 'Pantay sa baywang ang tubig.',
    waterLevel: 0.58,
  },
  head: {
    localLabel: 'Abot-ulo',
    description: 'Pantay sa ulo ang tubig.',
    waterLevel: 0.78,
  },
  overhead: {
    localLabel: 'Lampas-tao',
    description: 'Lampas tao ang tubig.',
    waterLevel: 1,
  },
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
}

export function ReportModal({
  isOpen,
  onClose,
  onSuccess,
  selectedLocation,
  onSubmit,
}: ReportModalProps) {
  const [step, setStep] = useState<ReportStep>('confirm');
  const [selectedDepth, setSelectedDepth] = useState<FloodDepth | null>(null);
  const [depthCategories, setDepthCategories] = useState<FloodDepthCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setStep('confirm');
  }, [isOpen]);

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
    <div className="fixed inset-x-0 bottom-0 z-[1300] flex items-end md:static md:flex md:items-stretch md:justify-end md:w-96">
      <div className="bg-white rounded-t-2xl shadow-2xl w-full max-h-[78vh] flex flex-col md:max-h-none md:rounded-l-2xl md:rounded-r-none md:h-full md:max-w-96">
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
              <div className="bg-maroon-50 rounded-lg p-4 border border-gakit-maroon/20">
                <div className="text-sm font-medium text-slate-600 mb-1">
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
              {depthCategories.length === 0 ? (
                <div className="rounded-lg border border-canvas-grey bg-canvas-light p-4 text-sm text-slate-600">
                  Loading depth choices...
                </div>
              ) : (
                <div className="space-y-3">
                  {depthCategories.map((category) => {
                    const presentation = DEPTH_PRESENTATION[category.code];
                    const approximateDepth = category.code === 'overhead'
                      ? `Approximately ${category.approximateCm} cm or deeper`
                      : `Approximately ${category.approximateCm} cm`;

                    return (
                      <button
                        key={category.code}
                        onClick={() => setSelectedDepth(category.code)}
                        className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                          selectedDepth === category.code
                            ? category.code === 'overhead'
                              ? 'border-hazard-critical bg-red-50'
                              : 'border-gakit-maroon bg-maroon-50'
                            : 'border-canvas-grey hover:border-canvas-grey/70 bg-white'
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
                              <clipPath id={`water-${category.code}`}>
                                <rect
                                  x="0"
                                  y={64 - presentation.waterLevel * 64}
                                  width="40"
                                  height={presentation.waterLevel * 64}
                                />
                              </clipPath>
                              <rect
                                x="0"
                                y="0"
                                width="40"
                                height="64"
                                fill={category.code === 'overhead' ? '#ef4444' : '#3b82f6'}
                                opacity="0.4"
                                clipPath={`url(#water-${category.code})`}
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900">
                              {presentation.localLabel} ({category.label})
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              {presentation.description}
                            </div>
                            <div
                              className={`text-xs font-bold mt-1 ${
                                category.code === 'overhead'
                                  ? 'text-red-600'
                                  : 'text-gakit-maroon'
                              }`}
                            >
                              {approximateDepth}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
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
