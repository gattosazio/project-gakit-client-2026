'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { PublicHeader } from '@/components/PublicHeader';
import { ReportModal } from './ReportModal';
import { CheckCircle2, ChevronDown, ChevronUp, MapPin, Navigation, X } from 'lucide-react';
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

interface SubmittedReport {
  id: string;
  location: SelectedLocation;
  depth: 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
  submittedAt: string;
  hasImage: boolean;
}

const FLOOD_DEPTH_LABELS: Record<SubmittedReport['depth'], string> = {
  ankle: 'Ankle Deep',
  knee: 'Knee Deep',
  waist: 'Waist Deep',
  head: 'Head Deep',
  overhead: 'Overhead',
};

// Home comes first in the DOM, but the map is scrolled to on load so it opens first
const SECTION_ORDER = ['home', 'hazard-map', 'about'] as const;
type SectionId = (typeof SECTION_ORDER)[number];

export function PublicViewPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('hazard-map');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(
    null
  );
  const [submittedReports, setSubmittedReports] = useState<SubmittedReport[]>([]);
  const [lastSubmittedReport, setLastSubmittedReport] = useState<SubmittedReport | null>(null);

  const scrollToMap = useCallback(() => {
    document
      .getElementById('hazard-map')
      ?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToSection = useCallback((sectionId: SectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const getSectionFromScroll = useCallback((scrollPosition: number): SectionId => {
    const adjustedScrollPosition = scrollPosition + 120;
    const documentBottom = window.scrollY + window.innerHeight;
    const pageBottom = document.documentElement.scrollHeight;

    if (documentBottom >= pageBottom - 8) {
      return 'about';
    }

    return [...SECTION_ORDER]
      .reverse()
      .find((sectionId) => {
        const element = document.getElementById(sectionId);
        return element ? element.offsetTop <= adjustedScrollPosition : false;
      }) ?? 'hazard-map';
  }, []);

  useEffect(() => {
    const updateActiveSection = () => {
      setActiveSection(getSectionFromScroll(window.scrollY));
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);

    setIsLocationPromptOpen(true);
    scrollToMap();

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, [getSectionFromScroll, scrollToMap]);

  const navigateSections = useCallback((direction: 'previous' | 'next') => {
    const currentSection = activeSection;
    const currentIndex = SECTION_ORDER.indexOf(currentSection);
    const nextIndex = direction === 'previous'
      ? Math.max(currentIndex - 1, 0)
      : Math.min(currentIndex + 1, SECTION_ORDER.length - 1);

    scrollToSection(SECTION_ORDER[nextIndex]);
  }, [activeSection, scrollToSection]);

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
        const report: SubmittedReport = {
          id: `GAKIT-${Date.now().toString().slice(-6)}`,
          location: selectedLocation || {
            ...data.location,
            address: `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`,
          },
          depth: data.depth,
          submittedAt: new Date().toLocaleString(),
          hasImage: Boolean(data.image),
        };

        setLastSubmittedReport(report);
        setSubmittedReports((currentReports) => [report, ...currentReports]);
        resolve();
      }, 1500);
    });
  };

  return (
    <div className="min-h-screen bg-canvas-grey">
      <PublicHeader />
      <SectionJumpControls
        showUp={activeSection !== 'home'}
        showDown={activeSection !== 'about'}
        onMoveUp={() => navigateSections('previous')}
        onMoveDown={() => navigateSections('next')}
      />

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
                className="mt-8 px-6 py-3 bg-gakit-maroon hover:bg-maroon-800 text-white font-semibold rounded-lg transition-colors"
              >
                Submit A Report
              </button>
            </div>
          </div>
        </section>

        <section id="hazard-map" className="min-h-[calc(100vh-4rem)] scroll-mt-16">
          <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-white">
            <div className="relative flex-1 w-full h-full min-h-0">
              {!isModalOpen && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] max-w-xs bg-white/95 border border-canvas-grey rounded-lg shadow-lg p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Report a flood hazard
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Tap the map or use the location button, then choose the flood depth.
                  </div>
                </div>
              )}
              <Suspense fallback={<div className="w-full h-full bg-canvas-grey" />}>
                <PublicMap
                  onLocationSelect={handleLocationSelect}
                  selectedLocation={selectedLocation}
                  submittedReports={submittedReports}
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
              <div className="text-sm font-semibold text-gakit-maroon mb-3">
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
        report={lastSubmittedReport}
        onClose={() => setIsSuccessOpen(false)}
        onViewMap={() => {
          setIsSuccessOpen(false);
          scrollToMap();
        }}
        onSubmitAnother={() => {
          setIsSuccessOpen(false);
          handleStartReport();
        }}
      />
    </div>
  );
}

function SectionJumpControls({
  showUp,
  showDown,
  onMoveUp,
  onMoveDown,
}: {
  showUp: boolean;
  showDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <>
      {showUp && (
        <button
          type="button"
          onClick={onMoveUp}
          className="fixed left-1/2 top-4 z-[1250] hidden h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-slate-500/50 bg-slate-700/30 text-white shadow-lg backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:bg-slate-700/50 md:flex"
          aria-label="Move to previous section"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      {showDown && (
        <button
          type="button"
          onClick={onMoveDown}
          className="fixed left-1/2 bottom-4 z-[1250] hidden h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-slate-500/50 bg-slate-700/30 text-white shadow-lg backdrop-blur-sm transition-transform hover:translate-y-0.5 hover:bg-slate-700/50 md:flex"
          aria-label="Move to next section"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
    </>
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
          <h2 className="text-lg font-bold text-slate-900">Submit a flood report</h2>
          <button onClick={onClose} className="p-1 hover:bg-canvas-light rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <button
            onClick={onUseCurrentLocation}
            className="w-full p-4 rounded-lg border-2 border-gakit-maroon bg-maroon-50 text-left hover:bg-maroon-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Navigation className="w-5 h-5 text-gakit-maroon" />
              <div>
                <div className="font-semibold text-slate-900">Use my current location</div>
                <div className="text-xs text-slate-600">Turn on location access and continue.</div>
              </div>
            </div>
          </button>

          <button
            onClick={onChooseLocation}
            className="w-full p-4 rounded-lg border-2 border-canvas-grey text-left hover:border-gakit-maroon hover:bg-maroon-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gakit-maroon" />
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
  report,
  onClose,
  onViewMap,
  onSubmitAnother,
}: {
  isOpen: boolean;
  report: SubmittedReport | null;
  onClose: () => void;
  onViewMap: () => void;
  onSubmitAnother: () => void;
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
          Thank you. Your report has been added as unverified and will be reviewed with other flood data.
        </p>

        {report && (
          <div className="mt-5 text-left rounded-lg border border-canvas-grey bg-canvas-light p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">Reference ID</div>
              <div className="text-sm font-semibold text-slate-900">{report.id}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Location</div>
              <div className="text-sm text-slate-900">{report.location.address}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">Flood depth</div>
                <div className="text-sm text-slate-900">{FLOOD_DEPTH_LABELS[report.depth]}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Status</div>
                <div className="text-sm font-semibold text-hazard-pending">Pending validation</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">Photo</div>
                <div className="text-sm text-slate-900">{report.hasImage ? 'Attached' : 'None'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Submitted</div>
                <div className="text-sm text-slate-900">{report.submittedAt}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onViewMap}
            className="py-3 px-4 rounded-lg font-semibold bg-gakit-maroon hover:bg-maroon-800 text-white transition-colors"
          >
            View on Map
          </button>
          <button
            onClick={onSubmitAnother}
            className="py-3 px-4 rounded-lg font-semibold border border-canvas-grey text-slate-700 hover:bg-canvas-light transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    </div>
  );
}
