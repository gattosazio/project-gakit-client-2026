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
  const [rainfallHours, setRainfallHours] = useState(1);
  const mapRef = useRef<PublicMapHandle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLoadingReports) return;
    const timer = setTimeout(() => setLoadingMessage('Server is starting…'), 5000);
    return () => clearTimeout(timer);
  }, [isLoadingReports]);

  // Reset the loading message whenever reports are not loading (guarded so it
  // only adjusts state during render when the value actually differs).
  if (!isLoadingReports && loadingMessage !== 'Fetching reports…') {
    setLoadingMessage('Fetching reports…');
  }

  const smoothScrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToMap = useCallback(() => {
    smoothScrollTo('hazard-map');
  }, [smoothScrollTo]);

  const scrollToSection = useCallback((sectionId: SectionId) => {
    smoothScrollTo(sectionId);
  }, [smoothScrollTo]);

  // Track which section is in view using IntersectionObserver + rAF top/bottom checks.
  useEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;

    const sections = SECTION_ORDER.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const targetId = entry.target.id as SectionId;
            if (SECTION_ORDER.includes(targetId)) {
              setActiveSection(targetId);
            }
          }
        });
      },
      {
        root: scroller,
        rootMargin: '-20% 0px -40% 0px',
        threshold: 0,
      }
    );

    sections.forEach((el) => observer.observe(el));

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!scroller) return;
        if (scroller.scrollTop < 80) {
          setActiveSection('hazard-map');
        } else if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 60) {
          setActiveSection('about');
        }
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Open on the map: scroll it into view after mount (snap settles it cleanly).
  useEffect(() => {
    scrollToMap();
  }, [scrollToMap]);

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

  const hasOpenedPromptRef = useRef(false);

  // Open the location prompt only once on first load when the map is ready
  const handleMapReady = useCallback(() => {
    if (!hasOpenedPromptRef.current) {
      hasOpenedPromptRef.current = true;
      try {
        const alreadyShown = sessionStorage.getItem('gakit:location-prompt-shown');
        if (!alreadyShown) {
          setIsLocationPromptOpen(true);
          sessionStorage.setItem('gakit:location-prompt-shown', 'true');
        }
      } catch {
        setIsLocationPromptOpen(true);
      }
    }
    setRainfallHours(mapRef.current?.getRainfallHours?.() ?? 1);
  }, [setRainfallHours]);

  const handleUseCurrentLocation = useCallback(() => {
    const attempt = (canRetry: boolean) => {
      if (!navigator.geolocation) {
        toast.error('Location sharing is not supported by this browser.', {
          position: 'top-right',
          autoClose: 3000,
        });
        return;
      }

      setIsLocationPromptOpen(false);
      setIsManualLocationMode(false);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const fallbackLocation = {
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          };

          setSelectedLocation(fallbackLocation);
          setIsModalOpen(true);
          void resolveLocation(latitude, longitude).then(setSelectedLocation);
        },
        (error) => {
          if (canRetry && error.code !== 1) {
            attempt(false);
            return;
          }
          if (error.code === 1) {
            toast.error('To use your location, allow location access for this site.', {
              position: 'top-right',
              autoClose: 4000,
            });
          } else if (error.code === 3) {
            toast.error('Location request timed out. Please try again.', {
              position: 'top-right',
              autoClose: 4000,
            });
          } else {
            toast.error("Couldn't get your location. Please try again.", {
              position: 'top-right',
              autoClose: 4000,
            });
          }
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
      );
    };
    attempt(true);
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
    <div
      ref={scrollContainerRef}
      className="h-[100dvh] overflow-y-auto bg-canvas-grey overscroll-y-contain [-webkit-overflow-scrolling:touch] md:snap-y md:snap-proximity"
    >
      <PublicHeader
        activeSection={activeSection}
        initialAuth={initialAuth}
        onNavigateSection={scrollToSection}
      />
      <SectionJumpControls
        showUp={activeSection !== 'hazard-map'}
        showDown={activeSection !== 'about'}
        onMoveUp={() => scrollToSection('hazard-map')}
        onMoveDown={() => scrollToSection('about')}
      />

      <main className="pb-14 md:pb-0">
        <section id="hazard-map" className="min-h-[100dvh] snap-start transform-gpu">
          <div className="flex h-[100dvh] overflow-hidden bg-white">
            <div className="relative isolate flex-1 w-full h-full min-h-0 transform-gpu">
              <div className="absolute top-18 left-1/2 -translate-x-1/2 md:top-22 md:left-6 md:translate-x-0 z-[1100] w-[calc(100%-2rem)] max-w-[310px] md:w-72 md:max-w-none">
                <LocationSearch
                  onSelect={handleSearchedLocationSelect}
                  onLocate={async () => {
                    await mapRef.current?.shareMyLocation();
                  }}
                />
              </div>
              {isLoadingReports && (
                <div className="absolute top-34 left-1/2 -translate-x-1/2 md:top-22 md:left-84 z-[1000] bg-white/90 backdrop-blur-xl border border-white/80 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{loadingMessage}</span>
                </div>
              )}
              <PublicMap
                mapApiRef={mapRef}
                onReady={handleMapReady}
                onRainfallHoursChange={setRainfallHours}
                onLoadingChange={setIsLoadingReports}
                onLocationSelect={handleLocationSelect}
                selectedLocation={selectedLocation}
                reportStatusToggleStatuses={['UNVERIFIED', 'VERIFIED']}
                defaultVisibleReportStatuses={{ ANOMALY: false, REJECTED: false }}
                searchOverlayActive={isManualLocationMode}
                weatherExpandedByDefault
                fullScreen
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
              onSuccess={() => {
                setIsSuccessOpen(true);
              }}
              onCheckLocation={handleCheckLocation}
              rainfallHours={rainfallHours}
            />
          </div>
        </section>

        <section id="about" className="border-t border-maroon-900/40 bg-gakit-maroon scroll-mt-16 snap-start [content-visibility:auto] [contain-intrinsic-size:700px] transform-gpu">
          <div className="mx-auto grid w-full max-w-6xl gap-3.5 px-4 py-8 sm:gap-6 sm:px-6 md:gap-10 md:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
            <div>
              <div className="mb-2 font-heading text-xs font-bold uppercase tracking-[0.18em] text-rose-200 md:mb-3">
                About Project GAKIT
              </div>
              <h2 className="max-w-2xl font-heading text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
                Community flood reports help others make safer decisions.
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-rose-100/90 sm:text-base sm:leading-7 md:mt-5">
                GAKIT combines community observations, geospatial information,
                and environmental data to support local flood awareness in
                Iligan City. Public reports help responders and researchers see
                where flooding is being experienced on the ground.
              </p>

              <div className="mt-5 grid gap-3.5 sm:mt-8 sm:grid-cols-2 sm:gap-5">
                <div className="group rounded-2xl bg-white p-4 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/90 md:transition-all md:duration-200 md:hover:-translate-y-1 sm:rounded-3xl sm:p-6 sm:shadow-2xl">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon shadow-xs ring-1 ring-maroon-200/80 sm:h-12 sm:w-12 sm:rounded-2xl">
                      <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-base font-bold tracking-tight text-slate-900 sm:text-lg">Local reporting</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:mt-1.5 sm:text-sm sm:leading-6">
                        Residents can mark a flooded location and share the observed
                        water depth.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="group rounded-2xl bg-white p-4 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/90 md:transition-all md:duration-200 md:hover:-translate-y-1 sm:rounded-3xl sm:p-6 sm:shadow-2xl">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon shadow-xs ring-1 ring-maroon-200/80 sm:h-12 sm:w-12 sm:rounded-2xl">
                      <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-base font-bold tracking-tight text-slate-900 sm:text-lg">Decision support</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:mt-1.5 sm:text-sm sm:leading-6">
                        Reports complement hazard, rainfall, and terrain data for
                        safer local decisions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3.5 sm:space-y-5 lg:space-y-6 lg:pt-7">
              <div className="group rounded-2xl bg-white p-4 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/90 md:transition-all md:duration-200 md:hover:-translate-y-1 sm:rounded-3xl sm:p-7 sm:shadow-2xl">
                <div className="flex items-center gap-3 sm:gap-4">
                  <a
                    href="https://www.msuiit.edu.ph"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 rounded-lg"
                    aria-label="Visit MSU-IIT official website"
                  >
                    <Image
                      src="/images/iit-logo.png"
                      alt="MSU-IIT Logo"
                      width={56}
                      height={56}
                      className="h-full w-full object-contain"
                    />
                  </a>
                  <div>
                    <div className="font-heading text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gakit-maroon">
                      A project of
                    </div>
                    <h3 className="mt-0.5 font-heading text-base font-bold leading-snug text-slate-900 sm:text-lg md:text-xl">
                      <a
                        href="https://www.msuiit.edu.ph"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-gakit-maroon"
                      >
                        Mindanao State University–Iligan Institute of Technology
                      </a>
                    </h3>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600 sm:mt-4 sm:text-sm sm:leading-6">
                  GAKIT is an applied geohazard research and community-focused
                  flood risk information system developed at MSU-IIT.
                </p>
              </div>

              <div className="group rounded-2xl bg-white p-4 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/90 md:transition-all md:duration-200 md:hover:-translate-y-1 sm:rounded-3xl sm:p-7 sm:shadow-2xl">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon shadow-xs ring-1 ring-maroon-200/80 sm:h-12 sm:w-12 sm:rounded-2xl">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading text-base font-bold tracking-tight text-slate-900 sm:text-lg">Contact and collaborate</div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm sm:leading-6">
                      For research, data-sharing, community, or deployment
                      partnership inquiries.
                    </p>
                    <a
                      href="mailto:support@gakit.ph?subject=Project%20GAKIT%20Inquiry"
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gakit-maroon px-4 py-2 font-heading text-xs font-bold text-white shadow-md shadow-maroon-950/30 transition-all duration-150 hover:bg-maroon-800 active:scale-95 sm:mt-4 sm:px-5 sm:py-2.5 sm:text-sm"
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
