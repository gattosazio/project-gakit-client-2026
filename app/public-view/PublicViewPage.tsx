'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { PublicHeader } from '@/components/PublicHeader';
import { ReportModal } from '@/components/ReportModal';
import { Building2, Handshake, Loader2, Mail, MapPin } from 'lucide-react';
import { toast } from 'react-toastify';
import { createReport, pingHealth } from './actions/public.view';
import { reverseGeocode } from '@/lib/map/geoUtils';
import type { PublicMapHandle } from '@/components/PublicMap';
import type { CreateReportInput, DepthCategory, FloodReference, Report, ReportStatus } from '@/types/report';
import type { AuthSnapshot } from '@/lib/auth/roles';
import { SectionJumpControls } from './components/SectionJumpControls';
import { LocationSearch } from './components/LocationSearch';
import {
  LocationPromptModal,
  type SelectedLocation,
} from './components/LocationPromptModal';
import {
  SuccessModal,
  type SubmittedReport,
} from './components/SuccessModal';

// Dynamically import the map to avoid window is not defined errors
const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  ssr: false,
});

// Home comes first in the DOM, but the map is scrolled to on load so it opens first
const SECTION_ORDER = ['hazard-map', 'about'] as const;
type SectionId = (typeof SECTION_ORDER)[number];

export function PublicViewPage({
  initialAuth,
}: {
  initialAuth?: AuthSnapshot;
} = {}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(false);
  const [isManualLocationMode, setIsManualLocationMode] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('hazard-map');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(
    null
  );
  const [lastSubmittedReport, setLastSubmittedReport] = useState<SubmittedReport | null>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Fetching reports…');
  const mapRef = useRef<PublicMapHandle | null>(null);

  useEffect(() => {
    if (!isLoadingReports) {
      setLoadingMessage('Fetching reports…');
      return;
    }
    const timer = setTimeout(() => setLoadingMessage('Server is starting…'), 5000);
    return () => clearTimeout(timer);
  }, [isLoadingReports]);

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

    scrollToMap();

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, [getSectionFromScroll, scrollToMap]);

  // Keep the free-tier backend warm while this page is open (opt-in).
  // Only active during a dev session, so it never burns idle instance-hours.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_KEEPALIVE !== '1') return;

    void pingHealth().catch(() => {});
    const timer = setInterval(() => {
      void pingHealth().catch(() => {});
    }, 10 * 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  const navigateSections = useCallback((direction: 'previous' | 'next') => {
    const currentSection = activeSection;
    const currentIndex = SECTION_ORDER.indexOf(currentSection);
    const nextIndex = direction === 'previous'
      ? Math.max(currentIndex - 1, 0)
      : Math.min(currentIndex + 1, SECTION_ORDER.length - 1);

    scrollToSection(SECTION_ORDER[nextIndex]);
  }, [activeSection, scrollToSection]);

  const resolveLocation = async (lat: number, lng: number): Promise<SelectedLocation> => {
    const address = await reverseGeocode(lat, lng);
    return { lat, lng, address };
  };

  const handleStartReport = useCallback(() => {
    scrollToMap();
    setIsManualLocationMode(false);
    setIsLocationPromptOpen(true);
  }, [scrollToMap]);

  // Open the location prompt only once the basemap + overlay layers are ready,
  // so it never appears over a still-loading (blank) map.
  const handleMapReady = useCallback(() => {
    setIsLocationPromptOpen(true);
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Location sharing is not supported by this browser.', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    setIsLocationPromptOpen(false);
    setIsManualLocationMode(false);
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      const fallbackLocation = {
        lat: latitude,
        lng: longitude,
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      };

      setSelectedLocation(fallbackLocation);
      setIsModalOpen(true);
      void resolveLocation(latitude, longitude).then(setSelectedLocation);
    }, () => {
      toast.error('Unable to get your location. Please allow location access.', {
        position: 'top-right',
        autoClose: 3000,
      });
    });
  }, []);

  const handleChooseLocation = useCallback(() => {
    setIsLocationPromptOpen(false);
    setIsManualLocationMode(true);
    scrollToMap();
  }, [scrollToMap]);

  const handleLocationSelect = useCallback((location: SelectedLocation) => {
    if (isModalOpen) return;
    setIsLocationPromptOpen(false);
    setSelectedLocation(location);
    setIsModalOpen(true);
  }, [isModalOpen]);

  const handleSearchedLocationSelect = useCallback((location: SelectedLocation) => {
    if (isModalOpen) return;
    setIsLocationPromptOpen(false);
    mapRef.current?.focusLocation(location);
    setSelectedLocation(location);
    setIsModalOpen(true);
  }, [isModalOpen]);

  // Stable identity so the ReportModal hazard-check effect doesn't re-run on
  // every parent re-render while the modal is open.
  const handleCheckLocation = useCallback(
    (location: { lat: number; lng: number }) =>
      mapRef.current?.checkLocation(location) ??
      Promise.resolve({ hazardLevel: null, precipMm: null }),
    []
  );

  const handleReportSubmit = async (data: {
    location: { lat: number; lng: number };
    depth: CreateReportInput['depth'];
    depthCm: number;
    reference: { id: FloodReference; label: string; landmark: string };
  }): Promise<void> => {
    const fallbackAddress = `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`;

    const report: Report = await createReport({
      location: {
        latitude: data.location.lat,
        longitude: data.location.lng,
        address: selectedLocation?.address || fallbackAddress,
      },
      depth: data.depth,
      depthCm: data.depthCm,
      reference: data.reference.id,
    });

    setLastSubmittedReport({
      id: report.id,
      location: {
        lat: report.location.latitude,
        lng: report.location.longitude,
        address: report.location.address || fallbackAddress,
      },
      depth: report.depth,
      reference: data.reference,
      status: report.status,
      submittedAt: new Date(report.createdAt).toLocaleString(),
    });

    mapRef.current?.refreshReports();
  };

  return (
    <div className="min-h-screen bg-canvas-grey">
      <PublicHeader activeSection={activeSection} initialAuth={initialAuth} />
      <SectionJumpControls
        showUp={activeSection !== 'hazard-map'}
        showDown={activeSection !== 'about'}
        onMoveUp={() => navigateSections('previous')}
        onMoveDown={() => navigateSections('next')}
      />

      <main className="pt-16 pb-14 md:pb-0">
        <section id="hazard-map" className="min-h-[calc(100dvh-4rem)] scroll-mt-16">
          <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-white">
            <div className="relative isolate flex-1 w-full h-full min-h-0">
              {isManualLocationMode && (
                <div className="absolute left-14 right-4 top-4 z-[1100] md:right-auto md:w-80">
                  <LocationSearch onSelect={handleSearchedLocationSelect} />
                </div>
              )}
              {isLoadingReports && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 md:top-4 z-[1000] bg-white/95 border border-canvas-grey rounded-lg shadow-lg px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{loadingMessage}</span>
                </div>
              )}
              <PublicMap
                mapApiRef={mapRef}
                onReady={handleMapReady}
                onLoadingChange={setIsLoadingReports}
                onLocationSelect={handleLocationSelect}
                selectedLocation={selectedLocation}
                reportStatusToggleStatuses={['UNVERIFIED', 'VERIFIED']}
                defaultVisibleReportStatuses={{ ANOMALY: false, REJECTED: false }}
                searchOverlayActive={isManualLocationMode}
                weatherExpandedByDefault
              />

              <LocationPromptModal
                isOpen={isLocationPromptOpen}
                onClose={() => setIsLocationPromptOpen(false)}
                onUseCurrentLocation={handleUseCurrentLocation}
                onChooseLocation={handleChooseLocation}
                onSearchLocationSelect={handleSearchedLocationSelect}
              />
            </div>

              <ReportModal
                isOpen={isModalOpen}
                onClose={() => {
                  setIsModalOpen(false);
                  setSelectedLocation(null);
                  setIsManualLocationMode(true);
                }}
              selectedLocation={selectedLocation}
              onSubmit={handleReportSubmit}
              onSuccess={() => setIsSuccessOpen(true)}
              onCheckLocation={handleCheckLocation}
              rainfallHours={mapRef.current?.getRainfallHours?.() ?? 1}
            />
          </div>
        </section>

        <section id="about" className="bg-gakit-maroon scroll-mt-16">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
            <div>
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-maroon-200">
                About Project GAKIT
              </div>
              <h2 className="max-w-2xl text-3xl font-bold leading-tight text-white md:text-4xl">
                Community flood reports help others make safer decisions.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-maroon-100">
                GAKIT combines community observations, geospatial information,
                and environmental data to support local flood awareness in
                Iligan City. Public reports help responders and researchers see
                where flooding is being experienced on the ground.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-5">
                  <MapPin className="h-6 w-6 text-maroon-200" />
                  <h3 className="mt-4 font-semibold text-white">Local reporting</h3>
                  <p className="mt-2 text-sm leading-6 text-maroon-100">
                    Residents can mark a flooded location and share the observed
                    water depth.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-5">
                  <Building2 className="h-6 w-6 text-maroon-200" />
                  <h3 className="mt-4 font-semibold text-white">Decision support</h3>
                  <p className="mt-2 text-sm leading-6 text-maroon-100">
                    Reports complement hazard, rainfall, and terrain data for
                    safer local decisions.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 lg:pt-7">
              <div className="rounded-2xl border border-white/20 bg-white p-6 text-slate-900 shadow-xl shadow-black/10">
                <div className="flex items-center gap-4">
                  <Image
                    src="/images/iit-logo.png"
                    alt="MSU-IIT Logo"
                    width={64}
                    height={64}
                    className="h-16 w-16 object-contain"
                  />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-gakit-maroon">
                      GAKIT is a project of
                    </div>
                    <h3 className="mt-1 text-xl font-bold">
                      Mindanao State University–Iligan Institute of Technology
                    </h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  GAKIT is an applied geohazard research and community-focused
                  flood risk information system developed at MSU-IIT.
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-maroon-800/70 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Contact and collaborate</div>
                    <p className="mt-1 text-sm leading-6 text-maroon-100">
                      For research, data-sharing, community, or deployment
                      partnership inquiries.
                    </p>
                    <a
                      href="mailto:support@gakit.ph?subject=Project%20GAKIT%20Inquiry"
                      className="mt-4 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gakit-maroon transition-colors hover:bg-maroon-50"
                    >
                      support@gakit.ph
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </main>

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

// Re-exported for consumers that previously imported these from this module.
export type { SelectedLocation } from './components/LocationPromptModal';
