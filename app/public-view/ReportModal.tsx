'use client';

import { useState, useRef } from 'react';
import { X, Loader2, Camera, Upload } from 'lucide-react';
import { toast } from 'react-toastify';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: { lat: number; lng: number; address: string; elevation?: number } | null;
  onSubmit: (data: {
    location: { lat: number; lng: number; elevation?: number };
    depth: 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
    image?: File;
  }) => Promise<void>;
}

export function ReportModal({
  isOpen,
  onClose,
  selectedLocation,
  onSubmit,
}: ReportModalProps) {
  const [selectedDepth, setSelectedDepth] = useState<
    'ankle' | 'knee' | 'waist' | 'head' | 'overhead' | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!selectedLocation || !selectedDepth) {
      toast.error('Please select both location and water depth', {
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
      toast.success('Report submitted successfully! Thank you for your report.', {
        position: 'top-right',
        autoClose: 3000,
      });
      setSelectedDepth(null);
      removeImage();
      onClose();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center md:static md:bg-transparent md:flex md:items-stretch md:justify-end md:w-96">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm md:max-w-none md:rounded-l-2xl md:rounded-r-none md:h-full md:flex md:flex-col md:max-w-96">
        <div className="flex items-center justify-between p-6 border-b border-canvas-grey">
          <h2 className="text-xl font-bold text-slate-900">Report Flood Hazard</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-canvas-light rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {selectedLocation ? (
            <div className="bg-blue-50 rounded-lg p-4 border border-gakit-blue/20">
              <div className="text-sm font-medium text-slate-600 mb-1">
                Imong napiling lokasyon (Selected Location):
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {selectedLocation.address}
              </div>
              {selectedLocation.elevation !== undefined && (
                <div className="text-xs text-slate-600 mt-2">
                  Elevation: {selectedLocation.elevation.toFixed(1)}m
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-hazard-pending rounded-lg p-4">
              <div className="text-sm text-slate-700">
                Click on the map to select a location
              </div>
            </div>
          )}

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
                },
                {
                  id: 'knee',
                  label: 'Abot-tuhod (Knee Deep)',
                  description: 'Pantay sa tuhod ang tubig.',
                  color: 'hazard-critical',
                },
                {
                  id: 'waist',
                  label: 'Abot-baywang (Waist Deep)',
                  description: 'Pantay sa baywang ang tubig.',
                  color: 'hazard-critical',
                },
                {
                  id: 'head',
                  label: 'Abot-ulo (Head Deep)',
                  description: 'Pantay sa ulo ang tubig.',
                  color: 'hazard-critical',
                },
                {
                  id: 'overhead',
                  label: 'Lampas-tao (Overhead)',
                  description: 'Lampas tao ang tubig.',
                  color: 'hazard-critical',
                },
              ].map((depth) => (
                <button
                  key={depth.id}
                  onClick={() =>
                    setSelectedDepth(
                      depth.id as 'ankle' | 'knee' | 'waist' | 'head' | 'overhead'
                    )
                  }
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedDepth === depth.id
                      ? depth.id === 'overhead'
                        ? 'border-hazard-critical bg-red-50'
                        : 'border-gakit-blue bg-blue-50'
                      : 'border-canvas-grey hover:border-canvas-grey/70 bg-white'
                  }`}
                >
                  <div className="font-semibold text-slate-900">
                    {depth.label}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {depth.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-3">
              Photo or Image (Optional)
            </label>
            
            {previewUrl ? (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-canvas-light border-2 border-gakit-blue">
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
                  className="w-full p-4 rounded-lg border-2 border-dashed border-canvas-grey hover:border-gakit-blue hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-gakit-blue"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-sm font-medium">Take a Photo</span>
                </button>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 rounded-lg border-2 border-dashed border-canvas-grey hover:border-gakit-blue hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-gakit-blue"
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
        </div>

        <div className="p-6 border-t border-canvas-grey bg-canvas-light/50">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedLocation || !selectedDepth}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
              isSubmitting || !selectedLocation || !selectedDepth
                ? 'bg-canvas-grey text-slate-400 cursor-not-allowed'
                : selectedDepth === 'overhead'
                  ? 'bg-hazard-critical hover:bg-red-600 text-white'
                  : 'bg-gakit-blue hover:bg-blue-700 text-white'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </div>
            ) : (
              'Submit this report'
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 px-6 rounded-lg font-medium text-slate-700 hover:bg-canvas-grey transition-colors mt-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
