'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Camera, Upload } from 'lucide-react';
import { toast } from 'react-toastify';

type FloodDepth = 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
type ReportStep = 'confirm' | 'depth' | 'photo';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedLocation: { lat: number; lng: number; address: string; elevation?: number } | null;
  onSubmit: (data: {
    location: { lat: number; lng: number; elevation?: number };
    depth: FloodDepth;
    image?: File;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
    }
  }, [isOpen]);

  const resetForm = () => {
    setStep('confirm');
    setSelectedDepth(null);
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
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
        image: selectedImage || undefined,
      });
      resetForm();
      onClose();
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit report. Please try again.',
        {
          position: 'top-right',
          autoClose: 3000,
        }
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

  const title = step === 'confirm'
    ? 'Confirm Location'
    : step === 'depth'
      ? 'Flood Depth'
      : 'Add Photo';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1300] flex items-end md:fixed md:right-0 md:top-0 md:bottom-0 md:items-center md:justify-end md:w-auto md:pointer-events-none">
      <div className="bg-white rounded-t-2xl shadow-2xl w-full max-h-[78vh] flex flex-col md:rounded-2xl md:max-h-[calc(100vh-12rem)] md:h-auto md:max-w-96 md:mr-6 md:pointer-events-auto">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-canvas-grey">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <div className="text-xs text-slate-500 mt-1">
              Step {step === 'confirm' ? '1' : step === 'depth' ? '2' : '3'} of 3
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
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
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
              <div className="space-y-3">
                {[
                  {
                    id: 'ankle',
                    label: 'Abot-bukong-bukong (Ankle Deep)',
                    description: 'Pantay sa bukong-bukong ang tubig.',
                    depth: '10–20 cm (0′3″–0′7″)',
                    waterLevel: 0.1,
                  },
                  {
                    id: 'knee',
                    label: 'Abot-tuhod (Knee Deep)',
                    description: 'Pantay sa tuhod ang tubig.',
                    depth: '45–55 cm (1′5″–1′8″)',
                    waterLevel: 0.33,
                  },
                  {
                    id: 'waist',
                    label: 'Abot-baywang (Waist Deep)',
                    description: 'Pantay sa baywang ang tubig.',
                    depth: '80–100 cm (2′6″–3′3″)',
                    waterLevel: 0.58,
                  },
                  {
                    id: 'head',
                    label: 'Abot-ulo (Head Deep)',
                    description: 'Pantay sa ulo ang tubig.',
                    depth: '155–163 cm (5′1″–5′4″)',
                    waterLevel: 0.78,
                  },
                  {
                    id: 'overhead',
                    label: 'Lampas-tao (Overhead)',
                    description: 'Lampas tao ang tubig.',
                    depth: '164+ cm (5′4″+)',
                    waterLevel: 1.0,
                  },
                ].map((depth) => (
                  <button
                    key={depth.id}
                    onClick={() => setSelectedDepth(depth.id as FloodDepth)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedDepth === depth.id
                        ? depth.id === 'overhead'
                          ? 'border-hazard-critical bg-red-50'
                          : 'border-gakit-maroon bg-slate-50'
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
                          <clipPath id={`water-${depth.id}`}>
                            <rect x="0" y={64 - depth.waterLevel * 64} width="40" height={depth.waterLevel * 64} />
                          </clipPath>
                          <rect
                            x="0"
                            y="0"
                            width="40"
                            height="64"
                            fill={depth.id === 'overhead' ? '#7f1d1d' : '#3b82f6'}
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
                        <div className={`text-xs font-bold mt-1 ${depth.id === 'overhead' ? 'text-red-600' : 'text-gakit-maroon'}`}>
                          {depth.depth}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'photo' && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                Photo or Image (Optional)
              </label>

              {previewUrl ? (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-canvas-light border-2 border-gakit-maroon">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-auto max-h-48 object-cover"
                    />
                  </div>
                  <button
                    onClick={removeImage}
                    className="w-full py-2 px-4 rounded-lg text-sm font-medium text-slate-700 bg-canvas-grey hover:bg-canvas-grey/80 transition-colors"
                  >
                    Remove Image
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full p-4 rounded-lg border-2 border-dashed border-canvas-grey hover:border-gakit-maroon hover:bg-maroon-50 transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-gakit-maroon"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-sm font-medium">Take a Photo</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 rounded-lg border-2 border-dashed border-canvas-grey hover:border-gakit-maroon hover:bg-maroon-50 transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-gakit-maroon"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-medium">Upload Image</span>
                  </button>

                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 border-t border-canvas-grey bg-canvas-light/50">
          {step === 'confirm' && (
            <button
              onClick={() => setStep('depth')}
              disabled={!selectedLocation}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-gakit-maroon hover:bg-maroon-800 text-white disabled:bg-canvas-grey disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              Confirm location
            </button>
          )}

          {step === 'depth' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep('confirm')}
                className="py-3 px-6 rounded-lg font-semibold text-slate-700 bg-canvas-grey hover:bg-canvas-grey/80 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('photo')}
                disabled={!selectedDepth}
                className="py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-gakit-maroon hover:bg-maroon-800 text-white disabled:bg-canvas-grey disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'photo' && (
            <div className="space-y-3">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-gakit-maroon hover:bg-maroon-800 text-white disabled:bg-canvas-grey disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </div>
                ) : (
                  'Submit report'
                )}
              </button>
              <button
                onClick={() => setStep('depth')}
                className="w-full py-2 px-6 rounded-lg font-medium text-slate-700 hover:bg-canvas-grey transition-colors"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
