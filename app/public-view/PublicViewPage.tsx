'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import type { FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { PublicHeader } from '@/components/PublicHeader';
import { ReportModal } from './ReportModal';
import { Building2, CheckCircle2, ChevronDown, ChevronUp, Handshake, Loader2, Mail, MapPin, Navigation, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { createReport, listPublicReports, pingHealth } from './actions/public.view';
import { reverseGeocode, searchLocations } from '@/lib/geoUtils';
import type { LocationSearchResult } from '@/lib/geoUtils';
import type { PublicMapHandle } from '@/components/PublicMap';
import type { CreateReportInput, DepthCategory, MapReportFeature, Report, ReportStatus } from '@/types/report';

// Dynamically import the map to avoid window is not defined errors
const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
  ssr: false,
});

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface SubmittedReport {
  id: string;
  location: SelectedLocation;
  depth: DepthCategory;
  status: ReportStatus;
  submittedAt: string;
}

const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  UNVERIFIED: 'Pending validation',
  VERIFIED: 'Verified',
  ANOMALY: 'Flagged for review',
  REJECTED: 'Rejected',
};

const formatApproximateDepth = (depth: DepthCategory) =>
  depth.code === 'overhead'
    ? `approximately ${depth.approximateCm} cm or deeper`
    : `approximately ${depth.approximateCm} cm`;

const toSubmittedReport = (report: Report): SubmittedReport => ({
  id: report.id,
  location: {
    lat: report.location.latitude,
    lng: report.location.longitude,
    address:
      report.location.address ??
      `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`,
  },
  depth: report.depth,
  status: report.status,
  submittedAt: new Date(report.createdAt).toLocaleString(),
});

const featureToSubmittedReport = (feature: MapReportFeature): SubmittedReport => ({
  id: feature.properties.id,
  location: {
    lat: feature.geometry.coordinates[1],
    lng: feature.geometry.coordinates[0],
    address:
      feature.properties.address ??
      `${feature.geometry.coordinates[1].toFixed(4)}, ${feature.geometry.coordinates[0].toFixed(4)}`,
  },
  depth: feature.properties.depth,
  status: feature.properties.status,
  submittedAt: new Date(feature.properties.createdAt).toLocaleString(),
});

// Home comes first in the DOM, but the map is scrolled to on load so it opens first
const SECTION_ORDER = ['hazard-map', 'about'] as const;
type SectionId = (typeof SECTION_ORDER)[number];

export function PublicViewPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(false);
  const [isManualLocationMode, setIsManualLocationMode] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('hazard-map');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(
    null
  );
  const [submittedReports, setSubmittedReports] = useState<SubmittedReport[]>([]);
  const [lastSubmittedReport, setLastSubmittedReport] = useState<SubmittedReport | null>(null);
  const mapRef = useRef<PublicMapHandle | null>(null);

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

  useEffect(() => {
    const abortController = new AbortController();

    void listPublicReports(abortController.signal)
      .then((features) => {
        setSubmittedReports(features.map(featureToSubmittedReport));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        toast.error(
          error instanceof Error
            ? error.message
            : 'Unable to load saved flood reports.',
          { position: 'top-right', autoClose: 3000 }
        );
      });

    return () => abortController.abort();
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

  // Open the location prompt only once the basemap + overlay layers are ready,
  // so it never appears over a still-loading (blank) map.
  const handleMapReady = useCallback(() => {
    setIsLocationPromptOpen(true);
  }, []);

  const handleLocationSelect = useCallback((location: SelectedLocation) => {
    setIsLocationPromptOpen(false);
    setSelectedLocation(location);
    setIsModalOpen(true);
  }, []);

  const handleSearchedLocationSelect = useCallback((location: SelectedLocation) => {
    setIsLocationPromptOpen(false);
    mapRef.current?.focusLocation(location);
    setSelectedLocation(location);
    setIsModalOpen(true);
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
  }): Promise<void> => {
    const fallbackAddress = `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`;

    const report = await createReport({
      location: {
        latitude: data.location.lat,
        longitude: data.location.lng,
        address: selectedLocation?.address || fallbackAddress,
      },
      depth: data.depth,
    });

    const submittedReport: SubmittedReport = {
      id: report.id,
      location: {
        lat: report.location.latitude,
        lng: report.location.longitude,
        address: report.location.address || fallbackAddress,
      },
      depth: report.depth,
      status: report.status,
      submittedAt: new Date(report.createdAt).toLocaleString(),
    };

    setLastSubmittedReport(submittedReport);
    setSubmittedReports((currentReports) => [submittedReport, ...currentReports]);
  };

  return (
    <div className="min-h-screen bg-canvas-grey">
      <PublicHeader activeSection={activeSection} />
      <SectionJumpControls
        showUp={activeSection !== 'hazard-map'}
        showDown={activeSection !== 'about'}
        onMoveUp={() => navigateSections('previous')}
        onMoveDown={() => navigateSections('next')}
      />

      <main className="pt-16 pb-14 md:pb-0">
        <section id="hazard-map" className="min-h-[calc(100dvh-4rem)] scroll-mt-16">
          <div className="h-[calc(100dvh-4rem)] flex overflow-hidden bg-white">
            <div className="relative isolate flex-1 w-full h-full min-h-0">
              {isManualLocationMode ? (
                <div className="absolute left-14 right-4 top-4 z-[1100] md:right-auto md:w-80">
                  <LocationSearch onSelect={handleSearchedLocationSelect} />
                </div>
              ) : !isModalOpen && (
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
                  mapApiRef={mapRef}
                  onReady={handleMapReady}
                  onLocationSelect={handleLocationSelect}
                  selectedLocation={selectedLocation}
                  submittedReports={submittedReports}
                  reportStatusToggleStatuses={['UNVERIFIED', 'VERIFIED']}
                  defaultVisibleReportStatuses={{ ANOMALY: false, REJECTED: false }}
                />
              </Suspense>

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
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon">
                  <Handshake className="h-6 w-6" />
                </div>
                <div className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-gakit-maroon">
                  Academic partnership
                </div>
                <h3 className="mt-2 text-xl font-bold">
                  Mindanao State University–Iligan Institute of Technology
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Project GAKIT is developed in partnership with MSU-IIT to
                  strengthen applied geohazard research and community-focused
                  flood risk information.
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

            <div className="mt-10 flex lg:justify-start">
              <button
                type="button"
                onClick={scrollToMap}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-gakit-maroon shadow-lg transition-colors hover:bg-maroon-50"
              >
                <MapPin className="h-4 w-4" />
                Back to hazard map
              </button>
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
          className="fixed left-1/2 top-20 z-[1100] flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-slate-500/50 bg-slate-700/30 text-white shadow-lg backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:bg-slate-700/50"
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

function LocationSearch({
  onSelect,
}: {
  onSelect: (location: SelectedLocation) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => searchAbortRef.current?.abort();
  }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError('Enter at least 2 characters.');
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const results = await searchLocations(query, controller.signal);
      if (controller.signal.aborted) return;

      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No matching locations found within Iligan City.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setSearchError(
        error instanceof Error
          ? error.message
          : 'Unable to search for that location.'
      );
    } finally {
      if (searchAbortRef.current === controller) {
        setIsSearching(false);
      }
    }
  };

  return (
    <div className="rounded-xl bg-white/90 p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur-sm">
      <form onSubmit={handleSearch} className="flex items-center gap-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 transition-shadow focus-within:ring-2 focus-within:ring-gakit-maroon/40">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchResults([]);
              setSearchError(null);
            }}
            placeholder="Search street, barangay, or landmark"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Search for a location in Iligan City"
          />
          {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gakit-maroon" />}
        </label>
        <button
          type="submit"
          disabled={isSearching}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gakit-maroon text-white shadow-sm transition-colors hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Search location"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>

      {searchError && (
        <p className="px-3 pb-1 pt-1.5 text-xs text-red-600" role="status">
          {searchError}
        </p>
      )}

      {searchResults.length > 0 && (
        <div className="mt-1.5 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          {searchResults.map((result) => (
            <button
              key={`${result.lat}-${result.lng}`}
              type="button"
              onClick={() =>
                onSelect({
                  lat: result.lat,
                  lng: result.lng,
                  address: result.displayName,
                })
              }
              className="flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-maroon-50"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gakit-maroon" />
              <span className="text-sm text-slate-700">
                {result.displayName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LocationPromptModal({
  isOpen,
  onClose,
  onUseCurrentLocation,
  onChooseLocation,
  onSearchLocationSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onChooseLocation: () => void;
  onSearchLocationSelect: (location: SelectedLocation) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[1300] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="p-5 space-y-3">
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-900">
              Search for a location
            </div>
            <LocationSearch onSelect={onSearchLocationSelect} />
          </div>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-canvas-grey" />
            <span className="text-xs font-medium text-slate-500">
              or choose another way
            </span>
            <div className="h-px flex-1 bg-canvas-grey" />
          </div>

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
                <div className="text-sm text-slate-900">
                  {report.depth.label} ({formatApproximateDepth(report.depth)})
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Status</div>
                <div className="text-sm font-semibold text-hazard-pending">
                  {REPORT_STATUS_LABELS[report.status]}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Submitted</div>
              <div className="text-sm text-slate-900">{report.submittedAt}</div>
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
