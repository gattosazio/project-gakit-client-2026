'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Layers,
  ListFilter,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { WeatherChip } from '@/components/map/WeatherChip';
import { DataLayerControls, ReportControls } from '@/components/map/MapControls';
import { useActiveAlerts, useCurrentWeather } from '@/lib/weather/weatherStore';
import { getWeatherCondition, isDaytimeInManila } from '@/lib/weather/weatherCodes';
import type { RainfallAccumulationHours } from '@/lib/map/rainfall';
import type { MapReportFeature, ReportStatus } from '@/types/report';
import type { ActiveStormSummary, HistoricalStormSummary } from '@/types/typhoon';
import type { SimulatedFloodHorizon, SimulatedFloodTelemetry } from '@/lib/map/surrogate';
import type { ScenarioFrame } from '@/types/scenario';

export interface MapSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: (collapsed: boolean) => void;
  controlsVisible?: boolean;
  hideWeather?: boolean;
  fullScreen?: boolean;
  hasBottomNav?: boolean;

  // Report Flooding Action
  onStartReport?: () => void;

  // Weather Outlook
  weatherLocation?: { lat: number; lng: number } | null;
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
  isCollapsed,
  onToggleCollapse,
  controlsVisible = true,
  hideWeather = false,
  fullScreen = false,
  hasBottomNav = false,
  onStartReport,
  weatherOpen,
  onToggleWeather,
  weatherExpandedByDefault,
  weatherLocation,
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

  const currentWeather = useCurrentWeather();
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

  // Automatically minimize sidebar to the sleek icon rail when all cards are collapsed
  useEffect(() => {
    if (!isCollapsed && !weatherOpen && !layersOpen && !reportsOpen) {
      onToggleCollapse(true);
    }
  }, [isCollapsed, weatherOpen, layersOpen, reportsOpen, onToggleCollapse]);

  const handleToggleWeather = (open: boolean) => {
    onToggleWeather(open);
    if (open) {
      onToggleLayers(false);
      onToggleReports(false);
    } else {
      (document.activeElement as HTMLElement)?.blur();
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile || (!layersOpen && !reportsOpen)) {
        onToggleCollapse(true);
      }
    }
  };

  const handleToggleLayers = (open: boolean) => {
    onToggleLayers(open);
    if (open) {
      onToggleWeather(false);
      onToggleReports(false);
    } else {
      (document.activeElement as HTMLElement)?.blur();
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile || (!weatherOpen && !reportsOpen)) {
        onToggleCollapse(true);
      }
    }
  };

  const handleToggleReports = (open: boolean) => {
    onToggleReports(open);
    if (open) {
      onToggleWeather(false);
      onToggleLayers(false);
    } else {
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
    : `${hasBottomNav ? 'bottom-24' : 'bottom-6'} top-auto md:top-1/2 md:-translate-y-1/2 md:bottom-auto`;

  const maxHeightClass = isEmbedded
    ? 'max-h-[calc(100%-2rem)]'
    : hasBottomNav
      ? 'max-h-[calc(100dvh-12rem)] md:max-h-[calc(100dvh-10.5rem)]'
      : 'max-h-[calc(100dvh-7.5rem)] md:max-h-[calc(100dvh-10.5rem)]';

  return (
    <aside
      aria-label="Map Controls Sidebar"
      className={`absolute left-3 md:left-4 z-[1000] pointer-events-none transition-all duration-300 ease-in-out flex flex-col ${positionClass} ${maxHeightClass} ${
        controlsVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {isCollapsed ? (
        /* ─── Collapsed State: Sleek Vertical Icon Rail ─────────────────── */
        <div className={`pointer-events-auto flex flex-col items-start gap-2 select-none ${maxHeightClass}`}>
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
              <ListFilter className="h-5 w-5 text-gakit-maroon transition-transform group-hover:scale-110" />
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

          {/* Report Flooding (desktop only — mobile uses the bottom-nav FAB) */}
          {onStartReport && (
            <button
              type="button"
              onClick={onStartReport}
              className="hidden md:flex h-10 md:h-11 items-center hud-pill hover:bg-white hover:shadow-lg transition-all duration-300 ease-in-out active:scale-95 group cursor-pointer text-slate-700 hover:text-gakit-maroon shrink-0"
              title="Report flooding"
              aria-label="Report flooding"
            >
              <div className="relative flex h-10 w-10 md:h-11 md:w-11 shrink-0 items-center justify-center">
                <Image
                  src="/assets/report-logo.svg"
                  alt="Report flooding"
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 object-contain transition-transform group-hover:scale-110"
                />
              </div>
              <span className={railLabelClass()}>Report Flooding</span>
            </button>
          )}
        </div>
      ) : (
        /* ─── Expanded State: Unified Scrollable Card Sidebar ────────────── */
        <div className={`relative pointer-events-auto flex flex-col min-h-0 max-h-full ${isEmbedded ? '' : maxHeightClass} w-[calc(100vw-4.5rem)] max-w-72 sm:w-72 transition-all duration-300 ease-in-out`}>
          {/* Docked Drawer Handle Tab */}
          <button
            type="button"
            onClick={handleCollapseSidebar}
            className="hud-pill group absolute -right-1 top-1/2 z-[1010] flex h-16 w-8 -translate-y-1/2 translate-x-full cursor-pointer flex-col items-center justify-center gap-2 !rounded-full text-slate-400 transition-[width,color,box-shadow] duration-200 ease-out hover:w-9 hover:text-slate-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 motion-reduce:transition-none"
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
              <div ref={weatherCardRef} className="w-full">
                <WeatherChip
                  location={weatherLocation}
                  open={weatherOpen}
                  onToggle={handleToggleWeather}
                  defaultExpanded={weatherExpandedByDefault}
                  isSidebarItem
                />
              </div>
            )}

            {/* Map Layers Card */}
            <div ref={layersCardRef} className="w-full">
              <DataLayerControls
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
            <div ref={reportsCardRef} className="w-full">
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

          {/* Primary Action Row: Report Flooding (mobile uses the bottom-nav FAB) */}
          {onStartReport && (
            <div className="mt-1.5 hidden shrink-0 md:block">
              <button
                type="button"
                onClick={onStartReport}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 hud-pill hover:bg-white hover:shadow-lg transition-all duration-150 active:scale-95 group select-none cursor-pointer"
                aria-label="Report flooding"
                title="Report flooding"
              >
                <span
                  role="img"
                  aria-label="Report flooding"
                  className="h-5 w-5 shrink-0 bg-gakit-maroon transition-transform group-hover:scale-110 [mask-image:url(/assets/report-logo.svg)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url(/assets/report-logo.svg)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
                />
                <span className="text-sm font-bold text-gakit-maroon group-hover:text-maroon-900 transition-colors">
                  Report Flooding
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
