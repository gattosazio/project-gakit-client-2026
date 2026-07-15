'use client';

import { useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { PublicHeader } from '@/components/PublicHeader';
import { ReportModal } from './ReportModal';
import { CheckCircle2, MapPin, Navigation, X } from 'lucide-react';
import { toast } from 'react-toastify';

// Dynamically import the map to avoid window is not defined errors
const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
  ssr: false,
});

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
  elevation?: number;
}

export function PublicViewPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(
    null
  );

  const scrollToMap = useCallback(() => {
    document
      .getElementById('hazard-map')
      ?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const resolveLocation = async (lat: number, lng: number): Promise<SelectedLocation> => {
    try {
      const addressResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const addressData = await addressResponse.json();
      const address = addressData.address?.road || addressData.address?.village || addressData.address?.city ||
                     addressData.address?.town || addressData.display_name?.split(',')[0] ||
                     `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      return {
        lat,
        lng,
        address: address.trim(),
      };
    } catch {
      return {
        lat,
        lng,
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      };
    }
  };

  const handleStartReport = useCallback(() => {
    scrollToMap();
    setIsLocationPromptOpen(true);
  }, [scrollToMap]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Location sharing is not supported by this browser.', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    setIsLocationPromptOpen(false);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const fallbackLocation = {
        lat: latitude,
        lng: longitude,
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      };

      setSelectedLocation(fallbackLocation);
      setIsModalOpen(true);
      setSelectedLocation(await resolveLocation(latitude, longitude));
    }, () => {
      toast.error('Unable to get your location. Please allow location access.', {
        position: 'top-right',
        autoClose: 3000,
      });
    });
  }, []);

  const handleChooseLocation = useCallback(() => {
    setIsLocationPromptOpen(false);
    scrollToMap();
  }, [scrollToMap]);

  const handleLocationSelect = useCallback((location: SelectedLocation) => {
    setIsLocationPromptOpen(false);
    setSelectedLocation(location);
    setIsModalOpen(true);
  }, []);

  const handleReportSubmit = async (data: {
    location: { lat: number; lng: number; elevation?: number };
    depth: 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
    image?: File;
  }): Promise<void> => {
    // Optimistic response pattern - simulate submission
    console.log('Report submitted:', data);
    if (data.image) {
      console.log('Image attached:', data.image.name, data.image.size, 'bytes');
    }

    // Simulate API call
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // In a real app, this would call your backend API with FormData
        // to handle both the JSON data and the image file
        console.log('Report confirmed by backend');
        resolve();
      }, 1500);
    });
  };

  return (
    <div className="min-h-screen bg-canvas-grey">
      <PublicHeader />

      <main className="pt-16 pb-14 md:pb-0">
        <section
          id="home"
          className="relative min-h-[calc(100vh-4rem)] bg-cover bg-center flex items-center"
          style={{ backgroundImage: "url('/images/flooded-image1.jpg')" }}
        >
          <div className="absolute inset-0 bg-black/55" />
          <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-16">
            <div className="max-w-2xl">
              <div className="text-sm font-semibold text-white/85 mb-3">
                Project GAKIT Flood Assessment Reporting
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                Do you want to submit a flood report?
              </h1>
              <p className="text-lg text-white/85 mt-5">
                Help the community by sharing where flooding is happening and how deep the water is.
              </p>
              <button
                onClick={handleStartReport}
                className="mt-8 px-6 py-3 bg-[#004aad] hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors"
              >
                Submit A Report
              </button>
            </div>
          </div>
        </section>

        <section id="hazard-map" className="min-h-[calc(100vh-4rem)] scroll-mt-16">
          <div className="h-[calc(100vh-4rem)] flex overflow-hidden border-y-4 border-[#004aad] bg-white">
            <div className="relative flex-1 w-full h-full min-h-0 border-x border-[#004aad]/30">
              <div
                className={`absolute top-4 right-4 z-[1000] max-w-xs bg-white/95 border border-canvas-grey rounded-lg shadow-lg p-4 transition-all duration-200 ${
                  isModalOpen ? 'md:right-[25rem]' : 'md:right-4'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  Report a flood hazard
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Tap the map or use the location button, then choose the flood depth.
                </div>
              </div>
              <Suspense fallback={<div className="w-full h-full bg-canvas-grey" />}>
                <PublicMap
                  onLocationSelect={handleLocationSelect}
                  selectedLocation={selectedLocation}
                />
              </Suspense>
            </div>

            <ReportModal
              isOpen={isModalOpen}
              onClose={() => {
                setIsModalOpen(false);
                setSelectedLocation(null);
              }}
              selectedLocation={selectedLocation}
              onSubmit={handleReportSubmit}
              onSuccess={() => setIsSuccessOpen(true)}
            />
          </div>
        </section>

        <section id="about" className="bg-canvas-grey scroll-mt-16">
          <div className="w-full max-w-5xl mx-auto px-6 py-16">
            <div className="max-w-3xl">
              <div className="text-sm font-semibold text-[#004aad] mb-3">
                About Project GAKIT
              </div>
              <h2 className="text-3xl font-bold text-slate-900">
                Community flood reports help others make safer decisions.
              </h2>
              <p className="text-slate-600 mt-4">
                Use the public map to mark a flooded location, share your current location, and submit the observed flood depth.
              </p>
            </div>
          </div>
        </section>
      </main>

      <LocationPromptModal
        isOpen={isLocationPromptOpen}
        onClose={() => setIsLocationPromptOpen(false)}
        onUseCurrentLocation={handleUseCurrentLocation}
        onChooseLocation={handleChooseLocation}
      />

      <SuccessModal
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
      />
    </div>
  );
}

function LocationPromptModal({
  isOpen,
  onClose,
  onUseCurrentLocation,
  onChooseLocation,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onChooseLocation: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1300] bg-black/40 flex items-end md:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-canvas-grey">
          <h2 className="text-lg font-bold text-slate-900">Choose report location</h2>
          <button onClick={onClose} className="p-1 hover:bg-canvas-light rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <button
            onClick={onUseCurrentLocation}
            className="w-full p-4 rounded-lg border-2 border-[#004aad] bg-blue-50 text-left hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Navigation className="w-5 h-5 text-[#004aad]" />
              <div>
                <div className="font-semibold text-slate-900">Use my current location</div>
                <div className="text-xs text-slate-600">Turn on location access and continue.</div>
              </div>
            </div>
          </button>

          <button
            onClick={onChooseLocation}
            className="w-full p-4 rounded-lg border-2 border-canvas-grey text-left hover:border-[#004aad] hover:bg-blue-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-[#004aad]" />
              <div>
                <div className="font-semibold text-slate-900">Choose on the map</div>
                <div className="text-xs text-slate-600">Tap the flooded location manually.</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1300] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mt-4">Report submitted</h2>
        <p className="text-sm text-slate-600 mt-2">
          Thank you. Your flood report was received and will help update the hazard map.
        </p>
        <button
          onClick={onClose}
          className="w-full mt-6 py-3 px-6 rounded-lg font-semibold bg-[#004aad] hover:bg-blue-800 text-white transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
