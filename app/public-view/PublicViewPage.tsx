'use client';

import { locationFromGps } from '@/lib/reports/observationMetadata';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { PublicHeader } from '@/components/PublicHeader';
import { HazardAssessmentModal } from '@/components/HazardAssessmentModal';
import { ReportModal } from '@/components/ReportModal';
import { MapPin, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { PageLoader } from '@/components/ui/LoadingState';
import { toast } from 'react-toastify';
import { createReport, pingHealth, uploadReportPhoto } from './actions/publicView';
import type { PreparedPhoto } from '@/lib/reports/photoUpload';
import { isRawCoordinateString, isWithinIligan, preloadGeoData, reverseGeocode } from '@/lib/map/geoUtils';
import type { PublicMapHandle } from '@/components/PublicMap';
import { MapDisplayPopover, type MapDisplaySettings } from '@/components/header/MapDisplayPopover';
import type { CreateReportInput, DepthCategory, FloodReference, Report, ReportStatus } from '@/types/report';
import type { AuthSnapshot } from '@/lib/auth/roles';
import { AboutSection } from './components/AboutSection';
import { SectionJumpControls } from './components/SectionJumpControls';
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
import {
  OnboardingWelcome,
  type OnboardingLocationStatus,
} from '@/components/onboarding/OnboardingWelcome';
import { MapTour } from '@/components/onboarding/MapTour';
import { TOUR_STEPS } from '@/lib/onboarding/steps';
import {
  getGeolocationPermission,
  requestCurrentPosition,
} from '@/lib/map/geolocation';
import {
  isOnboardingComplete,
  markAutoLocatedThisSession,
  readOnboardingRecord,
  saveOnboardingChoice,
  wasAutoLocatedThisSession,
  type OnboardingLocationChoice,
} from '@/lib/onboarding/storage';

// Dynamically import the map to avoid window is not defined errors
const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <PageLoader />,
  ssr: false,
});

// Home comes first in the DOM, but the map is scrolled to on load so it opens first
const SECTION_ORDER = ['hazard-map', 'about'] as const;
type SectionId = (typeof SECTION_ORDER)[number];
type OnboardingStage = 'closed' | 'welcome' | 'picking' | 'tour';

const REPORT_STATUS_TOGGLE_STATUSES: ReportStatus[] = ['VERIFIED'];
const DEFAULT_VISIBLE_REPORT_STATUSES: Partial<Record<ReportStatus, boolean>> = {
  UNVERIFIED: false,
  ANOMALY: false,
  REJECTED: false,
};

export function PublicViewPage({
  initialAuth,
}: {
  initialAuth?: AuthSnapshot;
} = {}) {
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(false);
  const [locationPromptMode, setLocationPromptMode] = useState<'assessment' | 'report'>('assessment');
  const [isManualLocationMode, setIsManualLocationMode] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [mapDisplay, setMapDisplay] = useState<MapDisplaySettings & { showBarangayBoundaries: boolean; ready: boolean }>({ basemap: 'light', mode: '2d', showBuildings: true, showRoads: false, showBarangayBoundaries: false, ready: false });
  const [isLocating, setIsLocating] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [withinCity, setWithinCity] = useState<boolean | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('hazard-map');
  const [aboutTab, setAboutTab] = useState<'about' | 'privacy'>('about');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(
    null
  );
  const [lastSubmittedReport, setLastSubmittedReport] = useState<SubmittedReport | null>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [rainfallHours, setRainfallHours] = useState(1);
  const [isMapReady, setIsMapReady] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>('closed');
  const [onboardingLocationStatus, setOnboardingLocationStatus] =
    useState<OnboardingLocationStatus>('checking');
  const [onboardingAddress, setOnboardingAddress] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const mapRef = useRef<PublicMapHandle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const onboardingStageRef = useRef<OnboardingStage>('closed');
  const onboardingChoiceRef = useRef<OnboardingLocationChoice | null>(null);
  const onboardingInitializedRef = useRef(false);
  const onboardingRequestRef = useRef(0);
  const lastOnboardingPickRef = useRef<{ key: string; at: number } | null>(null);

  const updateOnboardingStage = useCallback((stage: OnboardingStage) => {
    onboardingStageRef.current = stage;
    setOnboardingStage(stage);
  }, []);

  const smoothScrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToMap = useCallback(() => {
    smoothScrollTo('hazard-map');
  }, [smoothScrollTo]);

  const scrollToSection = useCallback((sectionId: SectionId) => {
    smoothScrollTo(sectionId);
    if (typeof window !== 'undefined') {
      if (sectionId === 'hazard-map' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      } else if (sectionId === 'about' && window.location.hash !== '#about') {
        window.history.replaceState(null, '', `${window.location.pathname}#about`);
      }
    }
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
          if (typeof window !== 'undefined' && window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 60) {
          setActiveSection('about');
          if (typeof window !== 'undefined' && window.location.hash !== '#about') {
            window.history.replaceState(null, '', `${window.location.pathname}#about`);
          }
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

  // Open on the map (or about if specified by URL hash): scroll it into view after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      if (window.location.hash === '#about') {
        smoothScrollTo('about');
      } else {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
        scrollToMap();
      }
    }
  }, [scrollToMap, smoothScrollTo]);

  // Pre-warm local barangay boundaries & Overture landmark dataset in memory
  useEffect(() => {
    preloadGeoData();
  }, []);

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

  // Map clicks deliver a coordinate pair twice: once immediately with raw
  // coords and again ~500ms later with the reverse-geocoded address. Dedupe
  // same-point decisions within the geocode debounce window so the modal isn't
  // re-evaluated; the duplicate call only refines the address in place.
  const lastAssessmentDecision = useRef<{ key: string; at: number } | null>(null);

  // Visible feedback while the geofence check runs before a modal opens.
  // Held for a minimum of 400ms so a cached/fast response doesn't flash it.
  const withPreparing = useCallback(async <T,>(work: Promise<T>): Promise<T> => {
    const started = Date.now();
    setIsPreparing(true);
    try {
      return await work;
    } finally {
      const remaining = 400 - (Date.now() - started);
      if (remaining > 0) {
        setTimeout(() => setIsPreparing(false), remaining);
      } else {
        setIsPreparing(false);
      }
    }
  }, []);

  // Opens the assessment modal for any location, inside or outside Iligan City.
  // The server is the authoritative geofence; withinCity only drives courtesy UI
  // (report CTA enabled vs. outside-city notice).
  const openAssessmentModalFor = useCallback(
    async (location: SelectedLocation) => {
      const key = `${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
      const lastDecision = lastAssessmentDecision.current;
      if (lastDecision && lastDecision.key === key && Date.now() - lastDecision.at < 2000) {
        if (!isRawCoordinateString(location.address)) {
          setSelectedLocation(location);
        }
        return;
      }
      lastAssessmentDecision.current = { key, at: Date.now() };

      let within: boolean | null = null;
      let finalAddress = location.address;
      try {
        const [withinRes, resolvedAddress] = await withPreparing(
          Promise.all([
            isWithinIligan(location.lat, location.lng),
            isRawCoordinateString(location.address)
              ? reverseGeocode(location.lat, location.lng)
              : Promise.resolve(location.address),
          ])
        );
        within = withinRes;
        finalAddress = resolvedAddress;
      } catch {
        within = null;
      }

      setWithinCity(within);
      setSelectedLocation({ ...location, address: finalAddress });
      setIsReportModalOpen(false);
      setIsAssessmentOpen(true);
    },
    [withPreparing]
  );

  const openReportModalFor = useCallback(
    async (location: SelectedLocation) => {
      let within: boolean | null = null;
      let finalAddress = location.address;
      try {
        const [withinRes, resolvedAddress] = await withPreparing(
          Promise.all([
            isWithinIligan(location.lat, location.lng),
            isRawCoordinateString(location.address)
              ? reverseGeocode(location.lat, location.lng)
              : Promise.resolve(location.address),
          ])
        );
        within = withinRes;
        finalAddress = resolvedAddress;
      } catch {
        within = null;
      }

      setWithinCity(within);
      setSelectedLocation({ ...location, address: finalAddress });
      setIsAssessmentOpen(false);
      setIsReportModalOpen(true);
    },
    [withPreparing]
  );

  const abandonOnboardingPickForReport = useCallback(() => {
    if (onboardingStageRef.current !== 'picking') return;
    const choice =
      readOnboardingRecord()?.locationChoice ?? onboardingChoiceRef.current ?? 'skipped';
    onboardingChoiceRef.current = choice;
    saveOnboardingChoice(choice);
    setIsManualLocationMode(false);
    updateOnboardingStage('closed');
  }, [updateOnboardingStage]);

  const handleStartReport = useCallback(() => {
    abandonOnboardingPickForReport();
    scrollToMap();
    if (selectedLocation) {
      void openReportModalFor(selectedLocation);
      return;
    }
    setLocationPromptMode('report');
    setIsManualLocationMode(false);
    setIsLocationPromptOpen(true);
  }, [abandonOnboardingPickForReport, openReportModalFor, scrollToMap, selectedLocation]);

  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    setRainfallHours(mapRef.current?.getRainfallHours?.() ?? 1);
  }, []);

  const rememberOnboardingChoice = useCallback((choice: OnboardingLocationChoice) => {
    onboardingChoiceRef.current = choice;
    saveOnboardingChoice(choice);
  }, []);

  const beginOnboardingTour = useCallback(() => {
    setTourStepIndex(0);
    updateOnboardingStage('tour');
  }, [updateOnboardingStage]);

  const finishOnboarding = useCallback(() => {
    const choice =
      readOnboardingRecord()?.locationChoice ?? onboardingChoiceRef.current ?? 'skipped';
    rememberOnboardingChoice(choice);
    lastOnboardingPickRef.current = null;
    updateOnboardingStage('closed');
  }, [rememberOnboardingChoice, updateOnboardingStage]);

  const handleOnboardingUseLocation = useCallback(async () => {
    // A permission check started before the visitor dismissed the welcome card
    // must not reopen it after they have moved on.
    if (onboardingStageRef.current !== 'welcome') return;

    const requestId = ++onboardingRequestRef.current;
    updateOnboardingStage('welcome');
    setOnboardingLocationStatus('locating');
    setOnboardingError(null);
    setOnboardingAddress(null);

    const result = await requestCurrentPosition();
    if (requestId !== onboardingRequestRef.current) return;

    if (!result.ok) {
      setOnboardingLocationStatus(
        result.error.code === 'denied'
          ? 'denied'
          : result.error.code === 'unsupported'
            ? 'unsupported'
            : 'error'
      );
      setOnboardingError(result.error.message);
      return;
    }

    const gpsLocation = locationFromGps(result.position);
    let within: boolean | null = null;
    try {
      within = await isWithinIligan(gpsLocation.lat, gpsLocation.lng);
    } catch {
      within = null;
    }
    if (requestId !== onboardingRequestRef.current) return;

    let address = gpsLocation.address;
    try {
      address = (await reverseGeocode(gpsLocation.lat, gpsLocation.lng)) || address;
    } catch {
      /* keep the coordinate fallback */
    }
    if (requestId !== onboardingRequestRef.current) return;

    const resolvedLocation = { ...gpsLocation, address };
    setOnboardingAddress(address);
    setOnboardingError(null);

    if (within === false) {
      // The map is clamped to Iligan City. Explain the mismatch instead of
      // dropping the visitor outside the usable area.
      setSelectedLocation(null);
      setWithinCity(false);
      setOnboardingLocationStatus('outside');
      return;
    }

    setSelectedLocation(resolvedLocation);
    setWithinCity(within);
    mapRef.current?.focusLocation(resolvedLocation);
    setOnboardingLocationStatus('ready');
    rememberOnboardingChoice('gps');
  }, [rememberOnboardingChoice, updateOnboardingStage]);

  const handleOnboardingChooseMap = useCallback(() => {
    setIsManualLocationMode(true);
    setIsLocationPromptOpen(false);
    updateOnboardingStage('picking');
    scrollToMap();
  }, [scrollToMap, updateOnboardingStage]);

  const handleOnboardingCancelPick = useCallback(() => {
    setIsManualLocationMode(false);
    updateOnboardingStage('welcome');
  }, [updateOnboardingStage]);

  const handleOnboardingSkipLocation = useCallback(() => {
    rememberOnboardingChoice('skipped');
    setIsManualLocationMode(false);
    beginOnboardingTour();
  }, [beginOnboardingTour, rememberOnboardingChoice]);

  const handleOnboardingStartTour = useCallback(() => {
    if (!readOnboardingRecord()) {
      rememberOnboardingChoice(onboardingChoiceRef.current ?? 'skipped');
    }
    setIsManualLocationMode(false);
    beginOnboardingTour();
  }, [beginOnboardingTour, rememberOnboardingChoice]);

  const handleOnboardingExplore = useCallback(() => {
    const choice =
      readOnboardingRecord()?.locationChoice ?? onboardingChoiceRef.current ?? 'skipped';
    rememberOnboardingChoice(choice);
    setIsManualLocationMode(false);
    updateOnboardingStage('closed');
  }, [rememberOnboardingChoice, updateOnboardingStage]);

  const startMapTour = useCallback(() => {
    if (!isMapReady) {
      scrollToMap();
      toast.info('The map is still loading. Try the tour again in a moment.', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    scrollToMap();
    beginOnboardingTour();
  }, [beginOnboardingTour, isMapReady, scrollToMap]);

  const autoLocateSavedGps = useCallback(async () => {
    if (wasAutoLocatedThisSession()) return;
    markAutoLocatedThisSession();

    const permission = await getGeolocationPermission();
    if (permission !== 'granted') return;

    const result = await requestCurrentPosition();
    if (!result.ok) return;

    const gpsLocation = locationFromGps(result.position);
    try {
      const within = await isWithinIligan(gpsLocation.lat, gpsLocation.lng);
      if (within === false) return;
    } catch {
      /* if the boundary check fails, let the map clamp the camera */
    }

    setSelectedLocation(gpsLocation);
    mapRef.current?.focusLocation(gpsLocation);
    try {
      const address = await reverseGeocode(gpsLocation.lat, gpsLocation.lng);
      if (address) setSelectedLocation({ ...gpsLocation, address });
    } catch {
      /* coordinate fallback is enough */
    }
  }, []);

  // First-visit onboarding. Wait until the map is mounted so GPS can center it,
  // and defer if the visitor landed directly on the About section.
  /* eslint-disable react-hooks/set-state-in-effect -- first-visit browser state */
  useEffect(() => {
    if (!isMapReady || onboardingInitializedRef.current) return;
    if (activeSection !== 'hazard-map') return;
    if (typeof window !== 'undefined' && window.location.hash === '#about') return;

    onboardingInitializedRef.current = true;
    const record = readOnboardingRecord();

    if (isOnboardingComplete()) {
      if (record?.locationChoice === 'gps') {
        queueMicrotask(() => {
          void autoLocateSavedGps();
        });
      }
      return;
    }

    setOnboardingAddress(null);
    setOnboardingError(null);
    setOnboardingLocationStatus('checking');
    updateOnboardingStage('welcome');

    void getGeolocationPermission().then((permission) => {
      if (permission === 'granted') {
        // Permission already exists, so this does not need a fresh gesture and
        // will not show a browser prompt.
        void handleOnboardingUseLocation();
      } else if (permission === 'denied') {
        setOnboardingLocationStatus('denied');
      } else if (permission === 'unsupported') {
        setOnboardingLocationStatus('unsupported');
      } else {
        setOnboardingLocationStatus('idle');
      }
    });
  }, [
    activeSection,
    autoLocateSavedGps,
    handleOnboardingUseLocation,
    isMapReady,
    updateOnboardingStage,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleUseCurrentLocation = useCallback(() => {
    const isReportMode = locationPromptMode === 'report';
    const attempt = (canRetry: boolean) => {
      if (!navigator.geolocation) {
        setIsLocating(false);
        toast.error('Location sharing is not supported by this browser.', {
          position: 'top-right',
          autoClose: 3000,
        });
        return;
      }

      setIsManualLocationMode(false);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const fallbackLocation = locationFromGps(position);

          // Close the prompt only once we actually have a fix, so the
          // locating state in the button is the visible feedback meanwhile.
          setIsLocating(false);
          setIsLocationPromptOpen(false);
          setSelectedLocation(fallbackLocation);

          // Resolve real human-readable address immediately
          let resolvedAddress = fallbackLocation.address;
          try {
            resolvedAddress = await reverseGeocode(latitude, longitude);
          } catch {
            // keep fallback coords
          }

          const targetLocation = {
            ...fallbackLocation,
            address: resolvedAddress,
          };
          setSelectedLocation(targetLocation);

          if (isReportMode) {
            setLocationPromptMode('assessment');
            void openReportModalFor(targetLocation);
          } else {
            void openAssessmentModalFor(targetLocation);
          }
        },
        (error) => {
          if (canRetry && error.code !== 1) {
            attempt(false);
            return;
          }
          // Keep the prompt open on failure so the user can retry or pick
          // another option instead of being dumped back on the map.
          setIsLocating(false);
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
    setIsLocating(true);
    attempt(true);
  }, [locationPromptMode, openAssessmentModalFor, openReportModalFor]);

  const handleChooseLocation = useCallback(() => {
    setIsLocationPromptOpen(false);
    setIsManualLocationMode(true);
    if (locationPromptMode === 'report') {
      toast.info('Tap the flooded location on the map to continue.', {
        position: 'top-right',
        autoClose: 4000,
      });
    }
    scrollToMap();
  }, [locationPromptMode, scrollToMap]);

  const handleLocationSelect = useCallback(
    (location: SelectedLocation) => {
      const pickKey = `${location.lat.toFixed(5)},${location.lng.toFixed(5)}`;
      const lastPick = lastOnboardingPickRef.current;
      if (
        lastPick &&
        lastPick.key === pickKey &&
        (Date.now() - lastPick.at < 2500 || onboardingStageRef.current === 'tour')
      ) {
        // Map taps emit a raw coordinate and then a reverse-geocoded copy of the
        // same point. The first pick starts the tour; the second only refines
        // the address instead of opening the assessment modal over the tour.
        setSelectedLocation((prev) => {
          if (!prev) return location;
          const samePoint =
            Math.abs(prev.lat - location.lat) < 1e-3 &&
            Math.abs(prev.lng - location.lng) < 1e-3;
          if (
            samePoint &&
            isRawCoordinateString(prev.address) &&
            !isRawCoordinateString(location.address)
          ) {
            return { ...prev, address: location.address };
          }
          return prev;
        });
        return;
      }

      if (onboardingStageRef.current === 'picking') {
        lastOnboardingPickRef.current = { key: pickKey, at: Date.now() };
        setSelectedLocation(location);
        setWithinCity(null);
        setIsLocationPromptOpen(false);
        setIsManualLocationMode(false);
        setLocationPromptMode('assessment');
        rememberOnboardingChoice('map');
        beginOnboardingTour();
        return;
      }

      if (isReportModalOpen) {
        setSelectedLocation((prev) => {
          if (!prev) return location;
          if (
            Math.abs(prev.lat - location.lat) < 1e-3 &&
            Math.abs(prev.lng - location.lng) < 1e-3
          ) {
            return {
              ...prev,
              address: isRawCoordinateString(prev.address) ? location.address : prev.address,
            };
          }
          return location;
        });
        return;
      }
      if (isAssessmentOpen) {
        setSelectedLocation((prev) => {
          if (!prev) return location;
          if (
            Math.abs(prev.lat - location.lat) < 1e-3 &&
            Math.abs(prev.lng - location.lng) < 1e-3
          ) {
            return {
              ...prev,
              address: isRawCoordinateString(prev.address) ? location.address : prev.address,
            };
          }
          return location;
        });
        return;
      }
      setIsLocationPromptOpen(false);

      if (isManualLocationMode && locationPromptMode === 'report') {
        setIsManualLocationMode(false);
        setLocationPromptMode('assessment');
        void openReportModalFor(location);
        return;
      }

      void openAssessmentModalFor(location);
    },
    [
      beginOnboardingTour,
      isAssessmentOpen,
      isManualLocationMode,
      isReportModalOpen,
      locationPromptMode,
      openAssessmentModalFor,
      openReportModalFor,
      rememberOnboardingChoice,
    ]
  );

  const handleSearchedLocationSelect = useCallback(
    (location: SelectedLocation) => {
      if (onboardingStageRef.current === 'picking') {
        lastOnboardingPickRef.current = {
          key: `${location.lat.toFixed(5)},${location.lng.toFixed(5)}`,
          at: Date.now(),
        };
        setSelectedLocation(location);
        setWithinCity(null);
        setIsLocationPromptOpen(false);
        setIsManualLocationMode(false);
        setLocationPromptMode('assessment');
        mapRef.current?.focusLocation(location);
        rememberOnboardingChoice('map');
        beginOnboardingTour();
        return;
      }
      if (isAssessmentOpen || isReportModalOpen) return;
      setIsLocationPromptOpen(false);
      mapRef.current?.focusLocation(location);
      if (locationPromptMode === 'report') {
        setLocationPromptMode('assessment');
        void openReportModalFor(location);
      } else {
        void openAssessmentModalFor(location);
      }
    },
    [
      beginOnboardingTour,
      isAssessmentOpen,
      isReportModalOpen,
      locationPromptMode,
      openAssessmentModalFor,
      openReportModalFor,
      rememberOnboardingChoice,
    ]
  );

  const handleLocate = useCallback(async () => {
    await mapRef.current?.shareMyLocation();
  }, []);

  // Stable identity so the ReportModal hazard-check effect doesn't re-run on
  // every parent re-render while the modal is open.
  const handleCheckLocation = useCallback(
    (location: { lat: number; lng: number }) =>
      mapRef.current?.checkLocation(location) ??
      Promise.resolve({
        floodHazard: null,
        landslide: null,
        stormSurge: null,
        precipMm: null,
      }),
    []
  );

  const handleReportLocationChange = useCallback(async (location: SelectedLocation) => {
    const within = await isWithinIligan(location.lat, location.lng);
    if (within === false) throw new Error('Choose a location within Iligan City.');
    if (within == null) throw new Error('Could not verify the city boundary. Please try again.');
    const address = await reverseGeocode(location.lat, location.lng);
    setSelectedLocation({ ...location, address });
    setWithinCity(true);
    mapRef.current?.focusLocation(location);
  }, []);

  const handleReportSubmit = async (data: {
    location: SelectedLocation;
    depth: CreateReportInput['depth'];
    depthCm: number;
    observation: CreateReportInput['observation'];
    observedAt: string;
    reference: { id: FloodReference; label: string; landmark: string };
    photo?: PreparedPhoto;
  }): Promise<void> => {
    let addressToUse = selectedLocation?.address;
    if (isRawCoordinateString(addressToUse)) {
      try {
        const resolved = await reverseGeocode(data.location.lat, data.location.lng);
        if (resolved && !isRawCoordinateString(resolved)) {
          addressToUse = resolved;
        }
      } catch {
        // Fallback to coordinates if offline reverse-geocoding fails
      }
    }
    const fallbackAddress = `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`;

    let report: Report = await createReport({
      location: {
        latitude: data.location.lat,
        longitude: data.location.lng,
        address: addressToUse || fallbackAddress,
      },
      depth: data.depth,
      depthCm: data.depthCm,
      observation: data.observation,
      observedAt: data.observedAt,
      reference: data.reference.id,
    });
    const receiptToken = report.photoUploadToken;

    // The report exists at this point, so a failed photo upload is reported but
    // never rolls the submission back.
    if (data.photo) {
      try {
        report = await uploadReportPhoto(report.id, data.photo.blob, undefined, receiptToken);
      } catch (uploadError) {
        console.error('Report photo upload failed:', uploadError);
        toast.error(
          'Your report was submitted, but the photo could not be uploaded.',
          { position: 'top-right', autoClose: 5000 }
        );
      }
    }

    setLastSubmittedReport({
      id: report.id,
      location: {
        lat: report.location.latitude,
        lng: report.location.longitude,
        address: report.location.address || fallbackAddress,
      },
      depth: report.depth,
      depthCm: report.depthCm,
      reference: data.reference,
      status: report.status,
      decisionSource: report.decisionSource,
      validationSummary: report.validationSummary,
      photoUploadToken: receiptToken,
      submittedAt: new Date(report.createdAt).toLocaleString(),
    });

    mapRef.current?.refreshReports();
  };

  return (
    <div data-map-shell className="relative h-[100dvh] w-full overflow-hidden bg-canvas-grey">
      <PublicHeader
        extraAction={<MapDisplayPopover {...mapDisplay} disabled={!mapDisplay.ready}
          onBasemapChange={value => mapRef.current?.setBasemap(value)}
          onModeChange={value => mapRef.current?.setMapMode(value)}
          onBarangayBoundariesChange={value => mapRef.current?.setBarangayBoundariesVisible(value)}
          onSmoothingChange={value => mapRef.current?.setPolygonSmoothing(value)}
          onBuildingsChange={value => mapRef.current?.setBuildingsVisible(value)}
          onRoadsChange={value => mapRef.current?.setRoadsVisible(value)}
          onFocusRoadsChange={value => mapRef.current?.setFocusRoads(value)} />}
        activeSection={activeSection}
        initialAuth={initialAuth}
        onNavigateSection={scrollToSection}
        onSearchSelect={handleSearchedLocationSelect}
        onLocate={handleLocate}
        showBentoMenu
        onStartReport={handleStartReport}
        onStartTour={startMapTour}
      />
      <SectionJumpControls
        showUp={activeSection !== 'hazard-map'}
        showDown={false}
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
                <PageLoader isLoading={isLoadingReports} />
                <PublicMap
                  hideDisplayControls
                  onDisplaySettingsChange={setMapDisplay}
                  mapApiRef={mapRef}
                  onReady={handleMapReady}
                  onRainfallHoursChange={setRainfallHours}
                  onLoadingChange={setIsLoadingReports}
                  onLocationSelect={handleLocationSelect}
                  selectedLocation={selectedLocation}
                  reportStatusToggleStatuses={REPORT_STATUS_TOGGLE_STATUSES}
                  reportFilters={{ createdAfterHours: 48, status: 'VERIFIED' }}
                  defaultVisibleReportStatuses={DEFAULT_VISIBLE_REPORT_STATUSES}
                  searchOverlayActive={isManualLocationMode}
                  weatherExpandedByDefault
                  fullScreen
                  hasBottomNav
                  hideBarangayBoundariesToggle
                  hideShareLocation
                  onStartReport={handleStartReport}
                  tourActive={onboardingStage === 'tour'}
                  tourPanel={TOUR_STEPS[tourStepIndex]?.panel ?? null}
                />
              </div>
            </div>
          </section>

          <section id="about" className="relative min-h-screen overflow-hidden border-t border-maroon-900/30 bg-gakit-maroon scroll-mt-16 snap-start">
            <TopoBackground className="opacity-[0.55]" />
            {/* vignette spans the whole section so taller tabs (Data & Privacy) stay edge-to-edge */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/[0.06] via-transparent to-black/[0.10]" />
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

      {onboardingStage === 'picking' && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-20 z-[1250] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-md"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-gakit-maroon">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-xs leading-4 text-slate-600">
            <span className="font-semibold text-slate-900">Pick a place on the map.</span>{' '}
            Search above or tap anywhere to start the tour there.
          </p>
          <button
            type="button"
            onClick={handleOnboardingCancelPick}
            aria-label="Cancel map selection"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <LocationPromptModal
        isOpen={isLocationPromptOpen}
        onClose={() => setIsLocationPromptOpen(false)}
        onUseCurrentLocation={handleUseCurrentLocation}
        onChooseLocation={handleChooseLocation}
        onSearchLocationSelect={handleSearchedLocationSelect}
        mode={locationPromptMode}
        isLocating={isLocating}
      />

      {/* Spinner-only pill shown while the geofence check prepares a modal */}
      {isPreparing && (
        <div
          role="status"
          aria-label="Preparing"
          className="fixed top-4 left-1/2 z-[1350] flex -translate-x-1/2 items-center rounded-full border border-slate-200/80 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md"
        >
          <Spinner size="sm" iconClassName="bg-gakit-maroon" />
        </div>
      )}

      <HazardAssessmentModal
        isOpen={isAssessmentOpen}
        onClose={() => {
          setIsAssessmentOpen(false);
          setSelectedLocation(null);
          setWithinCity(null);
          setIsManualLocationMode(true);
        }}
        selectedLocation={selectedLocation}
        onCheckLocation={handleCheckLocation}
        rainfallHours={rainfallHours}
        withinCity={withinCity}
      />

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setSelectedLocation(null);
          setWithinCity(null);
          setIsManualLocationMode(true);
        }}
        selectedLocation={selectedLocation}
        onSubmit={handleReportSubmit}
        onLocationChange={handleReportLocationChange}
        onSuccess={() => {
          setIsReportModalOpen(false);
          setIsSuccessOpen(true);
        }}
        withinCity={withinCity}
      />

      <SuccessModal
        isOpen={isSuccessOpen}
        report={lastSubmittedReport}
        onClose={() => setIsSuccessOpen(false)}
      />

      <OnboardingWelcome
        isOpen={onboardingStage === 'welcome'}
        status={onboardingLocationStatus}
        address={onboardingAddress}
        errorMessage={onboardingError}
        onUseLocation={() => void handleOnboardingUseLocation()}
        onChooseMap={handleOnboardingChooseMap}
        onStartTour={handleOnboardingStartTour}
        onExplore={handleOnboardingExplore}
        onSkipLocation={handleOnboardingSkipLocation}
        onDismiss={handleOnboardingExplore}
      />

      <MapTour
        isOpen={onboardingStage === 'tour'}
        stepIndex={tourStepIndex}
        onStepChange={setTourStepIndex}
        onClose={finishOnboarding}
        onFinish={finishOnboarding}
        onReport={() => {
          finishOnboarding();
          handleStartReport();
        }}
      />
    </div>
  );
}

// Re-exported for consumers that previously imported these from this module.
export type { SelectedLocation } from './components/LocationPromptModal';
