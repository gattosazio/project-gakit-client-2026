'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { PublicHeader } from '@/components/PublicHeader';
import { ReportModal } from '@/components/ReportModal';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'react-toastify';
import { createReport, pingHealth } from './actions/publicView';
import { reverseGeocode } from '@/lib/map/geoUtils';
import type { PublicMapHandle } from '@/components/PublicMap';
import type { CreateReportInput, DepthCategory, FloodReference, Report, ReportStatus } from '@/types/report';
import type { AuthSnapshot } from '@/lib/auth/roles';
import { SectionJumpControls } from './components/SectionJumpControls';
import { AboutSection } from './components/AboutSection';
import { DataPrivacySection } from './components/DataPrivacySection';
import {
  LocationPromptModal,
  type SelectedLocation,
} from './components/LocationPromptModal';
import {
  SuccessModal,
  type SubmittedReport,
} from './components/SuccessModal';
import { TopoBackground } from './components/TopoBackground';

// Dynamically import the map to avoid window is not defined errors
const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <Spinner size="lg" />
    </div>
  ),
  ssr: false,
});

// Home comes first in the DOM, but the map is scrolled to on load so it opens first
const SECTION_ORDER = ['hazard-map', 'about'] as const;
type SectionId = (typeof SECTION_ORDER)[number];

const REPORT_STATUS_TOGGLE_STATUSES: ReportStatus[] = ['UNVERIFIED', 'VERIFIED'];
const DEFAULT_VISIBLE_REPORT_STATUSES: Partial<Record<ReportStatus, boolean>> = {
  ANOMALY: false,
  REJECTED: false,
};

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
  const [aboutTab, setAboutTab] = useState<'about' | 'privacy'>('about');
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

  const handleLocate = useCallback(async () => {
    await mapRef.current?.shareMyLocation();
  }, []);

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
    <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas-grey">
      <PublicHeader
        activeSection={activeSection}
        initialAuth={initialAuth}
        onNavigateSection={scrollToSection}
        onSearchSelect={handleSearchedLocationSelect}
        onLocate={handleLocate}
      />
      <SectionJumpControls
        showUp={activeSection !== 'hazard-map'}
        showDown={activeSection !== 'about'}
        onMoveUp={() => scrollToSection('hazard-map')}
        onMoveDown={() => scrollToSection('about')}
      />

      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] md:snap-y md:snap-proximity"
      >
        <main className="pb-14 md:pb-0">
          <section id="hazard-map" className="min-h-[100dvh] snap-start">
            <div className="flex h-[100dvh] overflow-hidden bg-white">
              <div className="relative isolate flex-1 w-full h-full min-h-0">
                {isLoadingReports && (
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] hud-pill px-4 py-2 flex items-center gap-2">
                    <Spinner size="sm" iconClassName="bg-slate-500" />
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
                  reportStatusToggleStatuses={REPORT_STATUS_TOGGLE_STATUSES}
                  defaultVisibleReportStatuses={DEFAULT_VISIBLE_REPORT_STATUSES}
                  searchOverlayActive={isManualLocationMode}
                  weatherExpandedByDefault
                  fullScreen
                />
              </div>
            </div>
          </section>

          <section id="about" className="relative min-h-screen overflow-hidden border-t border-maroon-900/30 bg-gakit-maroon scroll-mt-16 snap-start">
            <TopoBackground className="opacity-[0.55]" />
            {/* vignette pinned to screen height so topo stays uniform across About / Data & Privacy */}
            <div aria-hidden className="pointer-events-none absolute top-0 inset-x-0 h-screen bg-gradient-to-b from-black/[0.06] via-transparent to-black/[0.10]" />
            <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-16 pb-24 sm:px-8 sm:pt-20 sm:pb-28 lg:px-8 lg:pt-20 lg:pb-28">
              {/* ── Tab header — airy, 44px+ ergonomic targets ── */}
              <div className="flex flex-col gap-5 border-b border-white/[0.10] pb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-7">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-maroon-950/35 p-1 sm:p-1.5 ring-1 ring-white/10 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setAboutTab('about')}
                      className={`min-h-[40px] sm:min-h-[42px] rounded-full px-6 font-heading text-[13px] font-bold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gakit-maroon ${
                        aboutTab === 'about'
                          ? 'bg-white text-gakit-maroon shadow-[0_4px_16px_rgba(0,0,0,0.18)]'
                          : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      About
                    </button>
                    <button
                      type="button"
                      onClick={() => setAboutTab('privacy')}
                      className={`min-h-[40px] sm:min-h-[42px] rounded-full px-5 sm:px-6 font-heading text-[13px] font-bold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gakit-maroon ${
                        aboutTab === 'privacy'
                          ? 'bg-white text-gakit-maroon shadow-[0_4px_16px_rgba(0,0,0,0.18)]'
                          : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      Data &amp; Privacy
                    </button>
                  </div>
                  <span className="hidden h-7 w-px bg-white/10 sm:block" aria-hidden />
                  <span className="hidden font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:block">
                    {aboutTab === 'about' ? 'Project Overview' : 'Data Policy & Attribution'}
                  </span>
                </div>
                <div className="hidden items-center gap-2 text-white/45 lg:flex">
                  <span className="h-px w-6 bg-white/15" aria-hidden />
                  <span className="font-heading text-[10px] font-bold uppercase tracking-[0.2em]">Iligan City · MSU-IIT</span>
                </div>
              </div>

              {aboutTab === 'about' ? <AboutSection /> : <DataPrivacySection />}
            </div>
          </section>
      </main>
      </div>

      <LocationPromptModal
        isOpen={isLocationPromptOpen}
        onClose={() => setIsLocationPromptOpen(false)}
        onUseCurrentLocation={handleUseCurrentLocation}
        onChooseLocation={handleChooseLocation}
        onSearchLocationSelect={handleSearchedLocationSelect}
      />

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

      <SuccessModal
        isOpen={isSuccessOpen}
        report={lastSubmittedReport}
        onClose={() => setIsSuccessOpen(false)}
        onViewMap={() => {
          setIsSuccessOpen(false);
          scrollToMap();
        }}
      />
    </div>
  );
}

// Re-exported for consumers that previously imported these from this module.
export type { SelectedLocation } from './components/LocationPromptModal';
