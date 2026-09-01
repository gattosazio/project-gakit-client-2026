'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';

const SEARCH_CLEAR_PX = 76;

export type OverlayState = {
  weatherOpen: boolean;
  reportsOpen: boolean;
  layersOpen: boolean;
  flood: boolean;
  rain: boolean;
  himawari: boolean;
  landslide: boolean;
  stormSurge: boolean;
};

export type PriorityTarget = 'weather' | 'reports' | 'layers' | 'auto';

interface UseOverlayCollapseOptions {
  mapContainerRef: MutableRefObject<HTMLDivElement | null>;
  hideWeather?: boolean;
  hideShareLocation?: boolean;
  hasBottomNav?: boolean;
  fullScreen?: boolean;
  showFloodHazard: boolean;
  showRainfall: boolean;
  showHimawariIR: boolean;
  showLandslide: boolean;
  showStormSurge: boolean;
}

export function useOverlayCollapse({
  mapContainerRef,
  hideWeather = false,
  hideShareLocation = false,
  hasBottomNav = false,
  fullScreen = false,
  showFloodHazard,
  showRainfall,
  showHimawariIR,
  showLandslide,
  showStormSurge,
}: UseOverlayCollapseOptions) {
  const [layersOpen, setLayersOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [reportsOpen, setReportsOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [weatherOpen, setWeatherOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const controlsContainerRef = useRef<HTMLDivElement | null>(null);

  const predictedStackHeight = useCallback(
    (s: OverlayState) => {
      const weatherH = hideWeather ? 0 : s.weatherOpen ? 275 : 38;
      const reportsH = s.reportsOpen ? 150 : 38;
      let layersH = 38;
      if (s.layersOpen) {
        layersH = 195;
        if (s.flood) layersH += 75;
        if (s.landslide) layersH += 75;
        if (s.stormSurge) layersH += 175;
        if (s.rain) layersH += 125;
        if (s.himawari) layersH += 55;
      }
      const activeCardCount = (hideWeather ? 0 : 1) + 2 + (hideShareLocation ? 0 : 1);
      const gapsH = Math.max(0, activeCardCount - 1) * 12;
      const locateH = hideShareLocation ? 0 : 40;
      return weatherH + reportsH + layersH + gapsH + locateH;
    },
    [hideWeather, hideShareLocation]
  );

  const maxAllowedStackHeight = useCallback(() => {
    const isDesktopCentered =
      !hideWeather &&
      typeof window !== 'undefined' &&
      window.innerWidth >= 768;
    const mapH =
      mapContainerRef.current?.clientHeight ||
      (typeof window !== 'undefined' ? window.innerHeight : 800);

    if (isDesktopCentered) {
      // Desktop full view: centered vertically (top-1/2 -translate-y-1/2)
      return mapH - 2 * SEARCH_CLEAR_PX;
    } else {
      // Embedded / mobile: anchored at bottom (bottom-4 or bottom-24)
      const bottomMargin = fullScreen && hasBottomNav ? 96 : 16;
      const topMargin = SEARCH_CLEAR_PX;
      return mapH - bottomMargin - topMargin;
    }
  }, [hideWeather, fullScreen, hasBottomNav, mapContainerRef]);

  const stackFits = useCallback(
    (s: OverlayState) => {
      return predictedStackHeight(s) <= maxAllowedStackHeight();
    },
    [predictedStackHeight, maxAllowedStackHeight]
  );

  /**
   * Cascades collapses based on what the user is actively opening/interacting with.
   * Protects the target card from ever being collapsed by its own toggle.
   */
  const collapseToFit = useCallback(
    (proposed: OverlayState, priority: PriorityTarget = 'auto'): OverlayState => {
      if (typeof window === 'undefined') return proposed;

      let s = { ...proposed };
      if (stackFits(s)) return s;

      if (priority === 'weather') {
        // Protect weather: collapse Layers first, then Reports
        if (s.layersOpen) {
          s = { ...s, layersOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.reportsOpen) {
          s = { ...s, reportsOpen: false };
          if (stackFits(s)) return s;
        }
      } else if (priority === 'reports') {
        // Protect reports: collapse Weather first, then Layers
        if (!hideWeather && s.weatherOpen) {
          s = { ...s, weatherOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.layersOpen) {
          s = { ...s, layersOpen: false };
          if (stackFits(s)) return s;
        }
      } else if (priority === 'layers') {
        // Protect layers: collapse Weather first, then Reports (never collapse Layers!)
        if (!hideWeather && s.weatherOpen) {
          s = { ...s, weatherOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.reportsOpen) {
          s = { ...s, reportsOpen: false };
          if (stackFits(s)) return s;
        }
      } else {
        // Auto / window resize
        if (!hideWeather && s.weatherOpen) {
          s = { ...s, weatherOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.reportsOpen) {
          s = { ...s, reportsOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.layersOpen) {
          s = { ...s, layersOpen: false };
        }
      }
      return s;
    },
    [hideWeather, stackFits]
  );

  const handleToggleWeather = useCallback(
    (nextOpen: boolean) => {
      const proposed: OverlayState = {
        weatherOpen: nextOpen,
        reportsOpen,
        layersOpen,
        flood: showFloodHazard,
        rain: showRainfall,
        himawari: showHimawariIR,
        landslide: showLandslide,
        stormSurge: showStormSurge,
      };
      const safe = nextOpen ? collapseToFit(proposed, 'weather') : proposed;
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    },
    [reportsOpen, layersOpen, showFloodHazard, showRainfall, showHimawariIR, showLandslide, showStormSurge, collapseToFit]
  );

  const handleToggleReports = useCallback(
    (nextOpen: boolean) => {
      const proposed: OverlayState = {
        weatherOpen,
        reportsOpen: nextOpen,
        layersOpen,
        flood: showFloodHazard,
        rain: showRainfall,
        himawari: showHimawariIR,
        landslide: showLandslide,
        stormSurge: showStormSurge,
      };
      const safe = nextOpen ? collapseToFit(proposed, 'reports') : proposed;
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    },
    [weatherOpen, layersOpen, showFloodHazard, showRainfall, showHimawariIR, showLandslide, showStormSurge, collapseToFit]
  );

  const handleToggleLayers = useCallback(
    (nextOpen: boolean) => {
      const proposed: OverlayState = {
        weatherOpen,
        reportsOpen,
        layersOpen: nextOpen,
        flood: showFloodHazard,
        rain: showRainfall,
        himawari: showHimawariIR,
        landslide: showLandslide,
        stormSurge: showStormSurge,
      };
      const safe = nextOpen ? collapseToFit(proposed, 'layers') : proposed;
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    },
    [weatherOpen, reportsOpen, showFloodHazard, showRainfall, showHimawariIR, showLandslide, showStormSurge, collapseToFit]
  );

  // Pre-paint DOM boundary guard: ensures stack NEVER surpasses search bar
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const el = controlsContainerRef.current;
    if (!el) return;

    const checkDomOverflow = () => {
      const rect = el.getBoundingClientRect();
      const parentRect = mapContainerRef.current?.getBoundingClientRect();
      const relativeTop = parentRect ? rect.top - parentRect.top : rect.top;

      if (relativeTop < 76) {
        if (!hideWeather && weatherOpen) {
          setWeatherOpen(false);
        } else if (reportsOpen && layersOpen) {
          setReportsOpen(false);
        }
      }
    };

    checkDomOverflow();
    window.addEventListener('resize', checkDomOverflow);
    return () => window.removeEventListener('resize', checkDomOverflow);
  }, [hideWeather, weatherOpen, reportsOpen, layersOpen, showFloodHazard, showRainfall, showHimawariIR, showLandslide, showStormSurge, mapContainerRef]);

  // Window resize: re-run collapseToFit against current state
  useEffect(() => {
    const onResize = () => {
      const proposed: OverlayState = {
        weatherOpen,
        reportsOpen,
        layersOpen,
        flood: showFloodHazard,
        rain: showRainfall,
        himawari: showHimawariIR,
        landslide: showLandslide,
        stormSurge: showStormSurge,
      };
      const safe = collapseToFit(proposed);
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [weatherOpen, reportsOpen, layersOpen, showFloodHazard, showRainfall, showHimawariIR, showLandslide, showStormSurge, collapseToFit]);

  return {
    weatherOpen,
    setWeatherOpen,
    reportsOpen,
    setReportsOpen,
    layersOpen,
    setLayersOpen,
    controlsContainerRef,
    collapseToFit,
    handleToggleWeather,
    handleToggleReports,
    handleToggleLayers,
  };
}
