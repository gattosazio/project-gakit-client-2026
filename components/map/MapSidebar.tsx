'use client';

import { useEffect, useRef, useState } from 'react';
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
import type { ReportStatus } from '@/types/report';
import type { ActiveStormSummary } from '@/types/typhoon';

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
  weatherOpen: boolean;
  onToggleWeather: (open: boolean) => void;
  weatherExpandedByDefault?: boolean;

  // Map Data Layers
  layersOpen: boolean;
  onToggleLayers: (open: boolean) => void;
  showFloodHazard: boolean;
  onShowFloodHazardChange: (checked: boolean) => void;
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
  layersOpen,
  onToggleLayers,
  showFloodHazard,
  onShowFloodHazardChange,
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

  // Suppress the icon-rail hover labels briefly after minimizing: the cursor
  // rests where the panel was (usually over the top/weather pill), which would
  // otherwise bloom the "Weather Outlook" label open on mount. Deliberate
  // hovers after the gate still expand normally.
  const [railLabelsLive, setRailLabelsLive] = useState(false);
  const [wasCollapsed, setWasCollapsed] = useState(isCollapsed);
  if (wasCollapsed !== isCollapsed) {
    // Rail just (un)mounted: re-arm the hover-label gate during render.
    setWasCollapsed(isCollapsed);
    setRailLabelsLive(false);
  }
  useEffect(() => {
    if (!isCollapsed) return;
    const t = setTimeout(() => setRailLabelsLive(true), 500);
    return () => clearTimeout(t);
  }, [isCollapsed]);

  // Full literal class strings (kept whole so Tailwind still generates them).
  const RAIL_LABEL_BASE =
    'max-w-0 overflow-hidden whitespace-nowrap text-sm font-bold opacity-0 transition-all duration-300 ease-in-out';
  const RAIL_LABEL_HOVER =
    'group-hover:max-w-[150px] group-hover:opacity-100 group-hover:pr-4 group-hover:ml-[-4px]';
  const RAIL_LABEL_HOVER_WIDE =
    'group-hover:max-w-[170px] group-hover:opacity-100 group-hover:pr-4 group-hover:ml-[-4px]';
  const railLabelClass = (wide = false) =>
    `${RAIL_LABEL_BASE} ${railLabelsLive ? (wide ? RAIL_LABEL_HOVER_WIDE : RAIL_LABEL_HOVER) : ''}`;

  const activeLayersCount = [
    showFloodHazard,
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
    } else if (!layersOpen && !reportsOpen) {
      onToggleCollapse(true);
    }
  };

  const handleToggleLayers = (open: boolean) => {
    onToggleLayers(open);
    if (open) {
      onToggleWeather(false);
      onToggleReports(false);
    } else if (!weatherOpen && !reportsOpen) {
      onToggleCollapse(true);
    }
  };

  const handleToggleReports = (open: boolean) => {
    onToggleReports(open);
    if (open) {
      onToggleWeather(false);
      onToggleLayers(false);
    } else if (!weatherOpen && !layersOpen) {
      onToggleCollapse(true);
    }
  };

  const isEmbedded = !fullScreen;

  const positionClass = isEmbedded
    ? 'top-1/2 -translate-y-1/2 bottom-auto'
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

          {/* Quick Action: Report Flooding */}
          {onStartReport && (
            <button
              type="button"
              onClick={onStartReport}
              className="flex h-10 md:h-11 items-center hud-pill hover:bg-white hover:shadow-lg transition-all duration-300 ease-in-out active:scale-95 group cursor-pointer shrink-0"
              title="Report flooding"
              aria-label="Report flooding"
            >
              <div className="relative flex h-10 w-10 md:h-11 md:w-11 shrink-0 items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110"
                  aria-hidden="true"
                >
                  <path
                    d="M 12 5.5 L 19.8 19 L 4.2 19 Z"
                    fill="#7B1113"
                    stroke="#7B1113"
                    strokeWidth="4.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <line x1="12" y1="9.5" x2="12" y2="13.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                  <circle cx="12" cy="17" r="1.15" fill="white" />
                </svg>
              </div>
              <span className={`${railLabelClass()} text-gakit-maroon`}>
                Report Flooding
              </span>
            </button>
          )}
        </div>
      ) : (
        /* ─── Expanded State: Unified Scrollable Card Sidebar ────────────── */
        <div className={`relative pointer-events-auto flex flex-col min-h-0 max-h-full ${isEmbedded ? '' : maxHeightClass} w-[calc(100vw-4.5rem)] max-w-[264px] sm:w-[264px] transition-all duration-300 ease-in-out`}>
          {/* Docked Drawer Handle Tab */}
          <button
            type="button"
            onClick={() => onToggleCollapse(true)}
            className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full flex h-12 w-5.5 items-center justify-center rounded-r-xl bg-white/95 border-y border-r border-slate-200/90 shadow-md shadow-slate-900/10 backdrop-blur-md transition-all duration-150 hover:bg-slate-50 hover:w-6 active:scale-95 group cursor-pointer z-[1010]"
            title="Minimize sidebar"
            aria-label="Minimize sidebar"
          >
            <ChevronLeft className="h-4 w-4 stroke-[2.5] text-slate-400 group-hover:text-gakit-maroon transition-transform duration-150 group-hover:-translate-x-0.5" />
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
                totalReports={totalReportsCount ?? visibleReportsCount}
                statusCounts={statusCounts}
              />
            </div>
          </div>

          {/* Primary Action Row: Report Flooding */}
          {onStartReport && (
            <div className="mt-1.5 shrink-0">
              <button
                type="button"
                onClick={onStartReport}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 hud-pill hover:bg-white hover:shadow-lg transition-all duration-150 active:scale-95 group select-none cursor-pointer"
                aria-label="Report flooding"
                title="Report flooding"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110"
                  aria-hidden="true"
                >
                  <path
                    d="M 12 5.5 L 19.8 19 L 4.2 19 Z"
                    fill="#7B1113"
                    stroke="#7B1113"
                    strokeWidth="4.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <line
                    x1="12"
                    y1="9.5"
                    x2="12"
                    y2="13.5"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="17" r="1.15" fill="white" />
                </svg>
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
