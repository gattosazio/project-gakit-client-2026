'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CloudSun,
  Layers,
  MapPin,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { FloodLoader } from '@/components/ui/FloodLoader';
import type { HeatIndexControlState } from '@/components/map/HeatIndexDetails';
import { WeatherChip } from '@/components/map/WeatherChip';
import { DataLayerControls, ReportControls } from '@/components/map/MapControls';
import { usePointOutlook } from '@/hooks/usePointOutlook';
import { usableCurrentWeather } from '@/lib/weather/weather';
import { useActiveAlerts } from '@/lib/weather/weatherStore';
import { getWeatherCondition, isDaytimeInManila } from '@/lib/weather/weatherCodes';
import type { RainfallAccumulationHours } from '@/lib/map/rainfall';
import type { MapReportFeature, ReportStatus } from '@/types/report';
import type { ActiveStormSummary, HistoricalStormSummary } from '@/types/typhoon';
import type { SimulatedFloodHorizon, SimulatedFloodTelemetry } from '@/lib/map/surrogate';
import type { ScenarioFrame } from '@/types/scenario';

export interface MapSidebarProps {
  heatIndex?: HeatIndexControlState;
  isCollapsed: boolean;
  onToggleCollapse: (collapsed: boolean) => void;
  controlsVisible?: boolean;
  hideWeather?: boolean;
  fullScreen?: boolean;
  hasBottomAction?: boolean;

  // Weather Outlook
  weatherOpen: boolean;
  onToggleWeather: (open: boolean) => void;
  weatherExpandedByDefault?: boolean;

  // Map Data Layers
  layersOpen: boolean;
  onToggleLayers: (open: boolean) => void;
  showFloodHazard: boolean;
  onShowFloodHazardChange: (checked: boolean) => void;
  showSimulatedFlood?: boolean;
  onShowSimulatedFloodChange?: (checked: boolean) => void;
  isLoadingSimulatedFlood?: boolean;
  simulatedFloodHorizon?: SimulatedFloodHorizon | null;
  onSimulatedFloodHorizonChange?: (horizon: SimulatedFloodHorizon) => void;
  simulatedFloodTelemetry?: SimulatedFloodTelemetry | null;
  simulatedFloodStatus?: string;
  simulatedFloodOpacity?: number;
  onSimulatedFloodOpacityChange?: (value: number) => void;
  simulatedFloodReplayFrames?: ScenarioFrame[];
  simulatedFloodReplayIndex?: number | null;
  onSimulatedFloodReplayChange?: (index: number | null) => void;
  showRainfall: boolean;
  onShowRainfallChange: (checked: boolean) => void;
  isLoadingRainfall?: boolean;
  rainfallObservedAt: string | null;
  rainfallSource: string | null;
  rainfallHours: RainfallAccumulationHours;
  onRainfallHoursChange: (hours: RainfallAccumulationHours) => void;
  showHimawariIR: boolean;
  onShowHimawariIRChange: (checked: boolean) => void;
  isLoadingHimawari?: boolean;
  himawariOpacity: number;
  onHimawariOpacityChange: (value: number) => void;
  showTyphoonTrack?: boolean;
  onShowTyphoonTrackChange?: (checked: boolean) => void;
  isLoadingTyphoon?: boolean;
  activeTyphoonName?: string | null;
  typhoonObservedAt?: string | null;
  hasActiveTyphoon?: boolean;
  activeStorms?: ActiveStormSummary[];
  onFocusStorm?: (stormName?: string) => void;
  historicalStorms?: HistoricalStormSummary[];
  selectedHistoricalStorm?: string | null;
  onSelectHistoricalStorm?: (stormName: string | null) => void;
  isLoadingHistory?: boolean;
  showBarangayBoundaries?: boolean;
  onShowBarangayBoundariesChange?: (checked: boolean) => void;
  showBarangayBoundariesToggle?: boolean;
  showLandslide: boolean;
  onShowLandslideChange: (checked: boolean) => void;
  showStormSurge: boolean;
  stormSurgeAdvisory: 1 | 2 | 3 | 4 | null;
  onStormSurgeAdvisoryChange: (next: 1 | 2 | 3 | 4 | null) => void;

  // Citizen Flood Reports
  reportsOpen: boolean;
  onToggleReports: (open: boolean) => void;
  visibleReportStatuses: Record<ReportStatus, boolean>;
  onReportStatusChange: (status: ReportStatus, checked: boolean) => void;
  reportStatusToggleStatuses?: ReportStatus[];
  reportWindowHours?: number | null;
  isLoadingReports?: boolean;
  visibleReportsCount?: number;
  totalReportsCount?: number;
  statusCounts?: Record<ReportStatus, number>;
  reportFeatures?: MapReportFeature[];
  onOpenReport?: (report: MapReportFeature) => void;
}

export function MapSidebar({
  heatIndex,
  isCollapsed,
  onToggleCollapse,
  controlsVisible = true,
  hideWeather = false,
  fullScreen = false,
  hasBottomAction = false,
  weatherOpen,
  onToggleWeather,
  weatherExpandedByDefault,
  layersOpen,
  onToggleLayers,
  showFloodHazard,
  onShowFloodHazardChange,
  showSimulatedFlood = false,
  onShowSimulatedFloodChange,
  isLoadingSimulatedFlood = false,
  simulatedFloodHorizon = 0,
  onSimulatedFloodHorizonChange,
  simulatedFloodTelemetry,
  simulatedFloodStatus,
  simulatedFloodOpacity = 0.85,
  onSimulatedFloodOpacityChange,
  simulatedFloodReplayFrames,
  simulatedFloodReplayIndex,
  onSimulatedFloodReplayChange,
  showRainfall,
  onShowRainfallChange,
  isLoadingRainfall = false,
  rainfallObservedAt,
  rainfallSource,
  rainfallHours,
  onRainfallHoursChange,
  showHimawariIR,
  onShowHimawariIRChange,
  isLoadingHimawari = false,
  himawariOpacity,
  onHimawariOpacityChange,
  showTyphoonTrack = false,
  onShowTyphoonTrackChange,
  isLoadingTyphoon = false,
  activeTyphoonName,
  typhoonObservedAt,
  hasActiveTyphoon = false,
  activeStorms,
  onFocusStorm,
  historicalStorms,
  selectedHistoricalStorm,
  onSelectHistoricalStorm,
  isLoadingHistory = false,
  showBarangayBoundaries = false,
  onShowBarangayBoundariesChange,
  showBarangayBoundariesToggle = true,
  showLandslide,
  onShowLandslideChange,
  showStormSurge,
  stormSurgeAdvisory,
  onStormSurgeAdvisoryChange,
  reportsOpen,
  onToggleReports,
  visibleReportStatuses,
  onReportStatusChange,
  reportStatusToggleStatuses,
  reportWindowHours,
  isLoadingReports = false,
  visibleReportsCount,
  totalReportsCount,
  statusCounts,
  reportFeatures,
  onOpenReport,
}: MapSidebarProps) {
  const weatherCardRef = useRef<HTMLDivElement>(null);
  const layersCardRef = useRef<HTMLDivElement>(null);
  const reportsCardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [mobileControlsHost, setMobileControlsHost] = useState<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [headerClear, setHeaderClear] = useState(false);

  useEffect(() => {
    if (!fullScreen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMobileControlsHost(document.querySelector<HTMLElement>('[data-map-mobile-controls-slot]'));
    });
    return () => { cancelled = true; };
  }, [fullScreen]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!fullScreen || !sidebar) return;
    const headers = [...document.querySelectorAll<HTMLElement>('[data-map-header]')];
    const measure = () => {
      const bounds = sidebar.getBoundingClientRect();
      // Include the expanded panel's protruding collapse handle and a gap.
      const right = bounds.right + (isCollapsed ? 0 : 36) + 12;
      setHeaderClear(window.innerWidth >= 768 && headers.every(header => {
        const headerBounds = header.getBoundingClientRect();
        return !headerBounds.width || right <= headerBounds.left || bounds.left - 12 >= headerBounds.right;
      }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(sidebar);
    headers.forEach(header => observer.observe(header));
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [fullScreen, isCollapsed]);

  const selectedOutlook = usePointOutlook();
  const currentWeather = usableCurrentWeather(selectedOutlook.data?.current ?? null);
  const alerts = useActiveAlerts();
  const digest = alerts?.find((a) => a.alertType === 'daily_digest') ?? null;
  const todayCondition = digest?.data?.days?.[0]
    ? getWeatherCondition(digest.data.days[0].conditionCode)
    : null;
  const liveCondition = currentWeather
    ? getWeatherCondition(currentWeather.conditionCode, isDaytimeInManila(currentWeather.observedAt))
    : todayCondition;
  const WeatherIcon = liveCondition ? liveCondition.icon : CloudSun;
  const currentTemp = currentWeather ? `${Math.round(currentWeather.temperature)}°` : null;

  // Suppress icon-rail hover labels briefly after minimizing on desktop: the cursor
  // rests where the panel was, which would otherwise bloom the label open on mount.
  // Touch / mobile devices never bloom hover labels since they lack fine hover.
  const [railLabelsLive, setRailLabelsLive] = useState(false);
  useEffect(() => {
    if (!isCollapsed) return;
    // Only schedule timer on desktop devices capable of true pointer hover
    if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return;
    }
    const t = setTimeout(() => setRailLabelsLive(true), 500);
    return () => {
      clearTimeout(t);
      setRailLabelsLive(false);
    };
  }, [isCollapsed]);

  // Full literal class strings (rail-label-expand is scoped to @media (hover: hover) in globals.css).
  const RAIL_LABEL_BASE =
    'max-w-0 overflow-hidden whitespace-nowrap text-sm font-bold opacity-0 transition-all duration-300 ease-in-out pointer-events-none select-none';
  const railLabelClass = (wide = false) =>
    `${RAIL_LABEL_BASE} ${railLabelsLive ? (wide ? 'rail-label-expand-wide' : 'rail-label-expand') : ''}`;

  const activeLayersCount = [
    showFloodHazard,
    showSimulatedFlood,
    showRainfall,
    heatIndex?.visible,
    showHimawariIR,
    showTyphoonTrack,
    showLandslide,
    showStormSurge,
    showBarangayBoundaries && showBarangayBoundariesToggle,
  ].filter(Boolean).length;

  const handleExpandTo = (target: 'weather' | 'layers' | 'reports') => {
    onToggleCollapse(false);
    if (target === 'weather') {
      onToggleWeather(true);
      onToggleLayers(false);
      onToggleReports(false);
    } else if (target === 'layers') {
      onToggleLayers(true);
      onToggleWeather(false);
      onToggleReports(false);
    } else if (target === 'reports') {
      onToggleReports(true);
      onToggleWeather(false);
      onToggleLayers(false);
    }
    if (fullScreen && window.innerWidth < 768) return;
    setTimeout(() => {
      const container = scrollContainerRef.current;
      const targetEl =
        target === 'weather'
          ? weatherCardRef.current
          : target === 'layers'
          ? layersCardRef.current
          : reportsCardRef.current;
      if (container && targetEl) {
        const top = targetEl.offsetTop - container.offsetTop;
        container.scrollTo({ top, behavior: 'smooth' });
      }
    }, 80);
  };

  const handleCollapseSidebar = useCallback(() => {
    (document.activeElement as HTMLElement)?.blur();
    onToggleCollapse(true);
    onToggleWeather(false);
    onToggleLayers(false);
    onToggleReports(false);
  }, [onToggleCollapse, onToggleWeather, onToggleLayers, onToggleReports]);

  useEffect(() => {
    if (!fullScreen || isCollapsed || window.innerWidth >= 768) return;
    const outside = (event: PointerEvent) => {
      const target = event.target;
      // Taps inside portalled modals must not collapse the sidebar.
      if (target instanceof Node) {
        if (target instanceof Element && target.closest('[role="dialog"]')) return;
        if (sidebarRef.current?.contains(target)
          || mobileControlsHost?.contains(target)) return;
      }
      handleCollapseSidebar();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCollapseSidebar();
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); };
  }, [fullScreen, isCollapsed, handleCollapseSidebar, mobileControlsHost]);

  // Automatically minimize sidebar to the sleek icon rail when all cards are collapsed
  useEffect(() => {
    if (!isCollapsed && !weatherOpen && !layersOpen && !reportsOpen) {
      onToggleCollapse(true);
    }
  }, [isCollapsed, weatherOpen, layersOpen, reportsOpen, onToggleCollapse]);

  const handleToggleWeather = (open: boolean) => {
    onToggleWeather(open);
    if (open && window.innerWidth < 768) {
      onToggleLayers(false);
      onToggleReports(false);
    } else if (!open) {
      (document.activeElement as HTMLElement)?.blur();
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile || (!layersOpen && !reportsOpen)) {
        onToggleCollapse(true);
      }
    }
  };

  const handleToggleLayers = (open: boolean) => {
    onToggleLayers(open);
    if (open && window.innerWidth < 768) {
      onToggleWeather(false);
      onToggleReports(false);
    } else if (!open) {
      (document.activeElement as HTMLElement)?.blur();
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile || (!weatherOpen && !reportsOpen)) {
        onToggleCollapse(true);
      }
    }
  };

  const handleToggleReports = (open: boolean) => {
    onToggleReports(open);
    if (open && window.innerWidth < 768) {
      onToggleWeather(false);
      onToggleLayers(false);
    } else if (!open) {
      (document.activeElement as HTMLElement)?.blur();
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile || (!weatherOpen && !layersOpen)) {
        onToggleCollapse(true);
      }
    }
  };

  const isEmbedded = !fullScreen;

  const positionClass = isEmbedded
    ? 'bottom-4 top-auto'
    : `${hasBottomAction ? 'bottom-24' : 'bottom-6'} top-auto md:top-1/2 md:-translate-y-1/2 md:bottom-auto`;

  const maxHeightClass = isEmbedded
    ? 'max-h-[calc(100%-2rem)]'
    : `${hasBottomAction ? 'max-h-[calc(100dvh-12rem)]' : 'max-h-[calc(100dvh-7.5rem)]'} ${headerClear ? 'md:max-h-[calc(100dvh-2rem)]' : 'md:max-h-[calc(100dvh-10.5rem)]'}`;

  return (
    <aside
      ref={sidebarRef}
      aria-label="Map Controls Sidebar"
      className={`absolute left-3 md:left-4 z-[1000] pointer-events-none transition-all duration-300 ease-in-out flex flex-col ${fullScreen ? 'mobile-map-sidebar' : ''} ${positionClass} ${maxHeightClass} ${showSimulatedFlood ? 'flood-player-clearance flood-sidebar-clearance' : ''} ${
        controlsVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {fullScreen && mobileControlsHost && createPortal(<div aria-label="Map controls" className="pointer-events-auto flex min-w-0 items-center gap-1.5 pb-1 md:hidden">
        {[
          ...(!hideWeather ? [{ id: 'weather' as const, label: 'Weather', text: liveCondition?.label ?? 'Weather', icon: WeatherIcon, open: weatherOpen, value: currentTemp, loading: selectedOutlook.status === 'loading' }] : []),
          { id: 'layers' as const, label: 'Layers', text: null, icon: Layers, open: layersOpen, value: activeLayersCount, loading: isLoadingSimulatedFlood || isLoadingRainfall || isLoadingHimawari || isLoadingTyphoon || Boolean(heatIndex?.loading) },
          { id: 'reports' as const, label: 'Reports', text: null, icon: MapPin, open: reportsOpen, value: visibleReportsCount ?? totalReportsCount ?? 0, loading: isLoadingReports },
        ].map(({ id, label, text, icon: Icon, open, value, loading }) => <button key={id} type="button"
          aria-label={label} aria-expanded={!isCollapsed && open}
          aria-busy={loading || undefined}
          onClick={() => !isCollapsed && open ? handleCollapseSidebar() : handleExpandTo(id)}
          className={`relative flex h-8 ${id === 'weather' ? 'min-w-0' : 'shrink-0'} items-center justify-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold shadow-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-95 motion-reduce:transition-none ${!isCollapsed && open ? 'border-maroon-200 bg-maroon-50 text-gakit-maroon' : 'border-slate-200/80 bg-white/95 text-slate-600'}`}>
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{loading ? <FloodLoader compact label={`Loading ${label}`} /> : <Icon className="h-3.5 w-3.5" aria-hidden="true" />}</span>{text && <span className="min-w-0 max-w-[130px] truncate">{text}</span>}
          {value != null && (id === 'weather' || Number(value) > 0) && <span className="absolute -bottom-1 -right-1 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-gakit-maroon px-1 text-[9px] font-bold tabular-nums text-white shadow-xs">{value}</span>}
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${!isCollapsed && open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>)}
      </div>, mobileControlsHost)}
      {isCollapsed ? (
        /* ─── Collapsed State: Sleek Vertical Icon Rail ─────────────────── */
        <div className={`pointer-events-auto ${fullScreen ? 'hidden md:flex' : 'flex'} flex-col items-start gap-2 select-none ${maxHeightClass}`}>
          {/* Weather Pill Button */}
          {!hideWeather && (
            <button
              type="button"
              onClick={() => handleExpandTo('weather')}
              className="flex h-10 md:h-11 items-center hud-pill hover:bg-white hover:shadow-lg transition-all duration-300 ease-in-out active:scale-95 group cursor-pointer text-slate-700 hover:text-gakit-maroon shrink-0"
              title="Weather Outlook"
              aria-label="Weather Outlook"
            >
              <div className="relative flex h-10 w-10 md:h-11 md:w-11 shrink-0 items-center justify-center">
                <WeatherIcon className="h-5 w-5 text-gakit-maroon transition-transform group-hover:scale-110 shrink-0" />
                {currentTemp && (
                  <span className="absolute -bottom-1 left-[65%] flex h-4 min-w-4 items-center justify-center rounded-full bg-gakit-maroon px-1 text-[9px] font-bold text-white shadow-xs">
                    {currentTemp}
                  </span>
                )}
              </div>
              <span className={railLabelClass()}>
                Weather Outlook
              </span>
            </button>
          )}

          {/* Map Layers Icon Button */}
          <button
            type="button"
            onClick={() => handleExpandTo('layers')}
            className="flex h-10 md:h-11 items-center hud-pill hover:bg-white hover:shadow-lg transition-all duration-300 ease-in-out active:scale-95 group cursor-pointer text-slate-700 hover:text-gakit-maroon shrink-0"
            title="Map Layers"
            aria-label="Map Layers"
          >
            <div className="relative flex h-10 w-10 md:h-11 md:w-11 shrink-0 items-center justify-center">
              <Layers className="h-5 w-5 text-gakit-maroon transition-transform group-hover:scale-110" />
              {activeLayersCount > 0 && (
                <span className="absolute -bottom-1 left-[65%] flex h-4 min-w-4 items-center justify-center rounded-full bg-gakit-maroon px-1 text-[9px] font-bold text-white shadow-xs">
                  {activeLayersCount}
                </span>
              )}
            </div>
              <span className={railLabelClass()}>
                Map Layers
              </span>
          </button>

          {/* Citizen Reports Icon Button */}
          <button
            type="button"
            onClick={() => handleExpandTo('reports')}
            className="flex h-10 md:h-11 items-center hud-pill hover:bg-white hover:shadow-lg transition-all duration-300 ease-in-out active:scale-95 group cursor-pointer text-slate-700 hover:text-gakit-maroon shrink-0"
            title="Citizen Flood Reports"
            aria-label="Citizen Flood Reports"
          >
            <div className="relative flex h-10 w-10 md:h-11 md:w-11 shrink-0 items-center justify-center">
              <MapPin className="h-5 w-5 text-gakit-maroon transition-transform group-hover:scale-110" />
              {typeof visibleReportsCount === 'number' && visibleReportsCount > 0 && (
                <span className="absolute -bottom-1 left-[65%] flex h-4 min-w-4 items-center justify-center rounded-full bg-gakit-maroon px-1 text-[9px] font-bold text-white shadow-xs">
                  {visibleReportsCount}
                </span>
              )}
              {isLoadingReports && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              )}
            </div>
              <span className={railLabelClass(true)}>
                Citizen Reports
              </span>
          </button>

        </div>
      ) : (
        /* ─── Expanded State: Unified Scrollable Card Sidebar ────────────── */
        <div className={`relative pointer-events-auto flex flex-col min-h-0 max-h-full ${fullScreen ? 'mobile-map-panel' : ''} ${isEmbedded ? '' : maxHeightClass} w-[calc(100vw-4.5rem)] max-w-72 sm:w-72 md:w-[304px] md:max-w-[304px] transition-all duration-300 ease-in-out`}>
          {/* Docked Drawer Handle Tab */}
          <button
            type="button"
            onClick={handleCollapseSidebar}
            className={`hud-pill group absolute -right-1 top-1/2 z-[1010] ${fullScreen ? 'hidden md:flex' : 'flex'} h-16 w-8 -translate-y-1/2 translate-x-full cursor-pointer flex-col items-center justify-center gap-2 !rounded-full text-slate-400 transition-[width,color,box-shadow] duration-200 ease-out hover:w-9 hover:text-slate-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 motion-reduce:transition-none`}
            title="Minimize sidebar"
            aria-label="Minimize sidebar"
            aria-expanded="true"
          >
            <span aria-hidden="true" className="flex gap-0.5 opacity-60 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none">
              <span className="h-3 w-0.5 rounded-full bg-current" />
              <span className="h-3 w-0.5 rounded-full bg-current" />
            </span>
            <ChevronLeft className="h-4 w-4 stroke-2 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">Collapse sidebar</span>
          </button>

          {/* Scrollable Cards Container */}
          <div
            ref={scrollContainerRef}
            className="sidebar-scroll shrink min-h-0 overflow-y-auto overscroll-contain pr-1 pb-1.5 space-y-1.5 [scrollbar-gutter:stable]"
          >
            {/* Weather Outlook Card */}
            {!hideWeather && (
              <div ref={weatherCardRef} data-tour="weather" className={`${fullScreen && !weatherOpen ? 'hidden md:block' : ''} w-full scroll-mt-2`}>
                <WeatherChip
                  open={weatherOpen}
                  onToggle={handleToggleWeather}
                  defaultExpanded={weatherExpandedByDefault}
                  isSidebarItem
                />
              </div>
            )}

            {/* Map Layers Card */}
            <div ref={layersCardRef} className={`${fullScreen && !layersOpen ? 'hidden md:block' : ''} w-full`}>
              <DataLayerControls
                heatIndex={heatIndex}
                open={layersOpen}
                onToggle={handleToggleLayers}
                isSidebarItem
                activeLayersCount={activeLayersCount}
                showFloodHazard={showFloodHazard}
                onShowFloodHazardChange={onShowFloodHazardChange}
                showSimulatedFlood={showSimulatedFlood}
                onShowSimulatedFloodChange={onShowSimulatedFloodChange}
                isLoadingSimulatedFlood={isLoadingSimulatedFlood}
                simulatedFloodHorizon={simulatedFloodHorizon}
                onSimulatedFloodHorizonChange={onSimulatedFloodHorizonChange}
                simulatedFloodTelemetry={simulatedFloodTelemetry}
                simulatedFloodStatus={simulatedFloodStatus}
                simulatedFloodOpacity={simulatedFloodOpacity}
                onSimulatedFloodOpacityChange={onSimulatedFloodOpacityChange}
                simulatedFloodReplayFrames={simulatedFloodReplayFrames}
                simulatedFloodReplayIndex={simulatedFloodReplayIndex}
                onSimulatedFloodReplayChange={onSimulatedFloodReplayChange}
                showRainfall={showRainfall}
                onShowRainfallChange={onShowRainfallChange}
                isLoadingRainfall={isLoadingRainfall}
                rainfallObservedAt={rainfallObservedAt}
                rainfallSource={rainfallSource}
                rainfallHours={rainfallHours}
                onRainfallHoursChange={onRainfallHoursChange}
                showHimawariIR={showHimawariIR}
                onShowHimawariIRChange={onShowHimawariIRChange}
                isLoadingHimawari={isLoadingHimawari}
                himawariOpacity={himawariOpacity}
                onHimawariOpacityChange={onHimawariOpacityChange}
                showTyphoonTrack={showTyphoonTrack}
                onShowTyphoonTrackChange={onShowTyphoonTrackChange}
                isLoadingTyphoon={isLoadingTyphoon}
                activeTyphoonName={activeTyphoonName}
                typhoonObservedAt={typhoonObservedAt}
                hasActiveTyphoon={hasActiveTyphoon}
                activeStorms={activeStorms}
                onFocusStorm={onFocusStorm}
                historicalStorms={historicalStorms}
                selectedHistoricalStorm={selectedHistoricalStorm}
                onSelectHistoricalStorm={onSelectHistoricalStorm}
                isLoadingHistory={isLoadingHistory}
                showBarangayBoundaries={showBarangayBoundaries}
                onShowBarangayBoundariesChange={onShowBarangayBoundariesChange}
                showBarangayBoundariesToggle={showBarangayBoundariesToggle}
                showLandslide={showLandslide}
                onShowLandslideChange={onShowLandslideChange}
                showStormSurge={showStormSurge}
                stormSurgeAdvisory={stormSurgeAdvisory}
                onStormSurgeAdvisoryChange={onStormSurgeAdvisoryChange}
              />
            </div>

            {/* Citizen Flood Reports Card */}
            <div ref={reportsCardRef} data-tour="reports" className={`${fullScreen && !reportsOpen ? 'hidden md:block' : ''} w-full scroll-mt-2`}>
              <ReportControls
                open={reportsOpen}
                onToggle={handleToggleReports}
                isSidebarItem
                visibleReportStatuses={visibleReportStatuses}
                onReportStatusChange={onReportStatusChange}
                reportStatusToggleStatuses={reportStatusToggleStatuses}
                reportWindowHours={reportWindowHours}
                isLoading={isLoadingReports}
                totalReports={visibleReportsCount ?? totalReportsCount}
                statusCounts={statusCounts}
                reportFeatures={reportFeatures}
                onOpenReport={onOpenReport}
              />
            </div>
          </div>

        </div>
      )}
    </aside>
  );
}
