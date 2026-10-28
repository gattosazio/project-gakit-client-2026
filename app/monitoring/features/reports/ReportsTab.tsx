'use client';

import type { DecisionReason } from '@/lib/reports/decisionReasons';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import dynamic from 'next/dynamic';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, RotateCcw, Search } from 'lucide-react';
import {
  DEPTH_LABELS,
  STATUS_META,
  formatReportDepth,
} from '@/lib/reports/reportFormatting';
import type { PublicMapHandle } from '@/components/PublicMap';
import { MapDisplayPopover, type MapDisplaySettings } from '@/components/header/MapDisplayPopover';
import type {
  FloodDepthCode,
  MapReportFilters,
  Report,
  ReportSortColumn,
  ReportStatus,
} from '@/types/report';
import { toast } from 'react-toastify';
import { getReport, listReports as fetchReports, updateReportStatus } from './actions/reports';
import { ReportDetail } from './ReportDetail';
import {
  DepthsFilterDropdown,
  StatusFilterDropdown,
  TimeFilterDropdown,
} from './ReportFilterDropdowns';
import { timeRangeOptions } from './reportFilterOptions';
import { REPORT_TABLE_COLUMNS, ReportTableRow } from './ReportTableRow';
import { ReportsPagination } from './ReportsPagination';
import { useVisibleInterval } from '@/hooks/useVisibleInterval';
import { useSortableTable } from '@/hooks/useSortableTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import './ReportsWorkspace.css';

const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center"><Spinner size="md" /></div>,
  ssr: false,
});

const REPORTS_PER_PAGE = 20;
const COLLAPSED_SHEET_HEIGHT = 44;
type SheetPosition = 'collapsed' | 'half' | 'full';
const SHEET_POSITIONS: SheetPosition[] = ['collapsed', 'half', 'full'];
const desktopSnapshot = () => window.matchMedia('(min-width: 1024px)').matches;
const serverSnapshot = () => false;
const subscribeDesktop = (changed: () => void) => {
  const media = window.matchMedia('(min-width: 1024px)');
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
};

export function ReportsTab({
  highlightedReportId = null,
  active = true,
  initialStatus = null,
  initialTime = null,
  fullscreenMode = false,
  onFullscreenModeChange,
}: {
  highlightedReportId?: string | null;
  active?: boolean;
  initialStatus?: ReportStatus | null;
  initialTime?: string | null;
  fullscreenMode?: boolean;
  onFullscreenModeChange?: (enabled: boolean) => void;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ReportStatus>('All');
  const [depthFilter, setDepthFilter] = useState<'All' | FloodDepthCode>('All');
  const [timeFilter, setTimeFilter] = useState('48h');
  const [queryDraft, setQueryDraft] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const mapRef = useRef<PublicMapHandle | null>(null);
  const [mapControlsHost, setMapControlsHost] = useState<HTMLDivElement | null>(null);
  const [mapDisplay, setMapDisplay] = useState<MapDisplaySettings & { showBarangayBoundaries: boolean; ready: boolean }>({ basemap: 'light', mode: '2d', showBuildings: true, showRoads: false, showBarangayBoundaries: false, ready: false });
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const mapToolsRef = useRef<HTMLDivElement | null>(null);
  const workspaceBody = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverSnapshot);
  const [panelHidden, setPanelHidden] = useState(false);
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>('collapsed');
  const [mapRightInset, setMapRightInset] = useState(0);
  const [fullscreenError, setFullscreenError] = useState('');
  const ownsFullscreen = useRef(false);
  const contentId = useId();
  const suppressSheetClick = useRef(false);
  const sheetGesture = useRef<{ pointer: number; y: number; height: number; area: number; start: number; lastY: number; startedAt: number } | null>(null);
  const requestSeqRef = useRef(0);

  const { sort, toggleSort } = useSortableTable<ReportSortColumn>({
    column: 'createdAt',
    direction: 'desc',
  });

  const [activeHighlightedId, setActiveHighlightedId] = useState<string | null>(highlightedReportId);
  const [hasEverBeenActive, setHasEverBeenActive] = useState(Boolean(active));

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      setHasEverBeenActive(true);
      mapRef.current?.resize?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => {
    const changed = () => {
      if (ownsFullscreen.current && !document.fullscreenElement) {
        ownsFullscreen.current = false;
        onFullscreenModeChange?.(false);
      }
    };
    document.addEventListener('fullscreenchange', changed);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onFullscreenModeChange]);

  useEffect(() => {
    if (!active || !panelRef.current || !workspaceBody.current) return;
    // Keep focus targets and map controls in the exposed area beside the card.
    const observer = new ResizeObserver(() => {
      setMapRightInset(desktop && !panelHidden ? Math.ceil(panelRef.current?.getBoundingClientRect().width ?? 0) + 24 : 0);
    });
    observer.observe(panelRef.current);
    observer.observe(workspaceBody.current);
    return () => observer.disconnect();
  }, [active, desktop, panelHidden]);

  useEffect(() => {
    if ((!active || !fullscreenMode) && ownsFullscreen.current && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      ownsFullscreen.current = false;
    }
    if (!active || !fullscreenMode) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.fullscreenElement
        || document.querySelector('[role="dialog"], [role="listbox"]')
        || (event.target instanceof HTMLElement && event.target.matches('input,textarea,select'))) return;
      onFullscreenModeChange?.(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [active, fullscreenMode, onFullscreenModeChange]);

  useEffect(() => {
    const tools = mapToolsRef.current;
    const workspace = workspaceRef.current;
    const mapArea = workspaceBody.current;
    if (!tools || !workspace || !mapArea) return;
    const measure = () => {
      const bottom = tools.getBoundingClientRect().bottom - mapArea.getBoundingClientRect().top;
      workspace.style.setProperty('--reports-map-tools-bottom', `${Math.max(0, bottom)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(tools);
    observer.observe(mapArea);
    return () => observer.disconnect();
  }, []);

  const moveSheet = (position: SheetPosition) => {
    setSheetPosition(position);
    workspaceRef.current?.style.removeProperty('--reports-sheet-height');
    workspaceRef.current?.removeAttribute('data-dragging');
  };
  const startSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (desktop || !event.isPrimary || sheetGesture.current || event.button !== 0 || !panelRef.current || !workspaceBody.current) return;
    suppressSheetClick.current = false;
    sheetGesture.current = { pointer: event.pointerId, y: event.clientY, lastY: event.clientY,
      height: panelRef.current.getBoundingClientRect().height,
      area: workspaceBody.current.getBoundingClientRect().height, start: SHEET_POSITIONS.indexOf(sheetPosition), startedAt: event.timeStamp };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragSheet = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = sheetGesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    drag.lastY = event.clientY;
    workspaceRef.current?.setAttribute('data-dragging', 'true');
    const height = Math.max(COLLAPSED_SHEET_HEIGHT, Math.min(drag.area * 0.92, drag.height + drag.y - event.clientY));
    workspaceRef.current?.style.setProperty('--reports-sheet-height', `${height}px`);
  };
  const endSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = sheetGesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    sheetGesture.current = null;
    workspaceRef.current?.removeAttribute('data-dragging');
    const delta = drag.y - event.clientY;
    suppressSheetClick.current = !cancelled && Math.abs(delta) > 8;
    if (cancelled || Math.abs(delta) <= 8) { workspaceRef.current?.style.removeProperty('--reports-sheet-height'); return; }
    const velocity = Math.abs(delta) / Math.max(1, event.timeStamp - drag.startedAt);
    if (Math.abs(delta) >= 16 && (velocity >= 0.25 || Math.abs(delta) >= drag.area * 0.15)) {
      moveSheet(delta > 0 ? 'full' : 'collapsed');
      return;
    }
    const height = Math.max(COLLAPSED_SHEET_HEIGHT, Math.min(drag.area * 0.92, drag.height + delta));
    const sizes = [COLLAPSED_SHEET_HEIGHT, drag.area * 0.54, drag.area * 0.92];
    let next = sizes.reduce((best, value, index) => Math.abs(value - height) < Math.abs(sizes[best] - height) ? index : best, 0);
    if (next === drag.start && Math.abs(delta) > 40) next = Math.max(0, Math.min(2, next + (delta > 0 ? 1 : -1)));
    moveSheet(SHEET_POSITIONS[next]);
  };
  const toggleFullscreen = async () => {
    setFullscreenError('');
    if (fullscreenMode) {
      onFullscreenModeChange?.(false);
      return;
    }
    onFullscreenModeChange?.(true);
    if (!document.fullscreenEnabled) return;
    ownsFullscreen.current = true;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      ownsFullscreen.current = false;
      setFullscreenError('Browser fullscreen is unavailable. The expanded map remains open.');
    }
  };

  useEffect(() => {
    if (!active || !highlightedReportId) return;
    let cancelled = false;
    // Fetch the linked report directly, even when it falls outside the list's
    // current time, status or depth filters.
    void getReport(highlightedReportId)
      .then((report) => {
        if (cancelled) return;
        setActiveHighlightedId(highlightedReportId);
        setSelectedReport(report);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : 'Could not open the report.');
      });
    return () => { cancelled = true; };
  }, [active, highlightedReportId]);

  useEffect(() => {
    if (!activeHighlightedId) return;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(`[data-highlighted-report="${activeHighlightedId}"]`)) {
        setActiveHighlightedId(null);
      }
    };

    window.addEventListener('mousedown', handleClickAway);
    return () => window.removeEventListener('mousedown', handleClickAway);
  }, [activeHighlightedId]);


  useEffect(() => {
    if (!active || (!initialStatus && !initialTime)) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setStatusFilter(initialStatus ?? 'All');
      setDepthFilter('All');
      if (!highlightedReportId) {
        setQuery('');
        setQueryDraft('');
      }
      if (initialTime) {
        setTimeFilter(initialTime);
      }
      setCurrentPage(1);
      setPanelHidden(false);
      setSheetPosition('half');
    });
    return () => {
      cancelled = true;
    };
  }, [active, initialStatus, initialTime, highlightedReportId]);

  useEffect(() => {
    if (!active) return;
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    void Promise.resolve().then(() => {
      if (seq !== requestSeqRef.current) return;
      setLoading(true);
      setError(null);
    });

    const selectedRange = timeRangeOptions.find((option) => option.value === timeFilter);
    // Bucket the cutoff to 10-minute windows so the cache key stays stable
    // between poll ticks instead of minting a new entry every minute.
    const since =
      selectedRange && selectedRange.hours != null
        ? new Date(
            Math.floor((Date.now() - selectedRange.hours * 3600 * 1000) / (10 * 60_000)) *
              (10 * 60_000)
          ).toISOString()
        : undefined;

    fetchReports({
      page: currentPage,
      limit: REPORTS_PER_PAGE,
      search: (query || '').trim() || undefined,
      status: statusFilter === 'All' ? undefined : statusFilter,
      depth: depthFilter === 'All' ? undefined : depthFilter,
      created_after: since,
      sort_by: sort.column,
      sort_dir: sort.direction,
    })
      .then((result) => {
        if (seq !== requestSeqRef.current) return;
        setReports(result.items);
        setTotal(result.total);
        setTotalPages(Math.max(1, result.totalPages));
        setSelectedReport((current) => {
          if (!current) return null;
          const updated = result.items.find((report) => report.id === current.id);
          return updated ?? current;
        });
      })
      .catch((err: unknown) => {
        if (seq !== requestSeqRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load reports');
        setReports([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => {
        if (seq === requestSeqRef.current) setLoading(false);
      });
    return () => { if (seq === requestSeqRef.current) requestSeqRef.current++; };
  }, [active, currentPage, query, statusFilter, depthFilter, timeFilter, refreshKey, sort]);

  // Background auto-refresh, paused while the tab is hidden.
  useVisibleInterval(() => setRefreshKey((key) => key + 1), 30_000, active);

  const canReset =
    (queryDraft || '').trim() !== '' ||
    statusFilter !== 'All' ||
    depthFilter !== 'All' ||
    timeFilter !== '48h' ||
    activeHighlightedId !== null;

  const applySearch = () => {
    setQuery(queryDraft.trim());
    setCurrentPage(1);
    setActiveHighlightedId(null);
  };

  useEffect(() => {
    if (!active || queryDraft.trim() === query) return;
    const timer = window.setTimeout(() => {
      setQuery(queryDraft.trim());
      setCurrentPage(1);
      setActiveHighlightedId(null);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [active, queryDraft, query]);

  const resetFilters = () => {
    setQueryDraft('');
    setQuery('');
    setStatusFilter('All');
    setDepthFilter('All');
    setTimeFilter('48h');
    setCurrentPage(1);
    setActiveHighlightedId(null);
  };


  const reportFilters: MapReportFilters = {
    createdAfterHours:
      timeRangeOptions.find((option) => option.value === timeFilter)?.hours ?? null,
    status: statusFilter === 'All' ? undefined : statusFilter,
    depth: depthFilter === 'All' ? undefined : depthFilter,
  };

  const mapSubtitle = [
    timeRangeOptions.find((option) => option.value === timeFilter)?.label.toLowerCase() ??
      'all time',
    statusFilter !== 'All' ? STATUS_META[statusFilter].label.toLowerCase() : null,
    depthFilter !== 'All' ? DEPTH_LABELS[depthFilter].toLowerCase() : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  const reportWindow = timeRangeOptions.find(option => option.value === timeFilter);
  const reportBarStatus = loading && !reports.length ? 'Loading reports…'
    : `${total.toLocaleString()} ${query.trim() ? 'matching ' : ''}${statusFilter !== 'All' ? `${STATUS_META[statusFilter].label.toLowerCase()} ` : ''}report${total === 1 ? '' : 's'}${reportWindow?.hours == null ? ' · All time' : ` in the ${reportWindow.label.toLowerCase()}`}`;

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleNoopLocationSelect = useCallback(() => {}, []);

  const handleInspect = (report: Report) => {
    setActiveHighlightedId(report.id);
    moveSheet('collapsed');
    requestAnimationFrame(() => {
      mapRef.current?.resize?.();
      mapRef.current?.showReport({
        id: report.id,
        lat: report.location.latitude,
        lng: report.location.longitude,
        address:
          report.location.address ||
          `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`,
        depthLabel: formatReportDepth(report.depth, report.depthCm),
        statusLabel: STATUS_META[report.status].label,
        createdAt: report.createdAt,
        observedAt: report.observedAt,
      });
    });
  };

  const handleMapPinClick = useCallback(
    (reportId: string) => {
      setActiveHighlightedId(reportId);
      const existing = reports.find((r) => r.id === reportId);
      if (existing) {
        setSelectedReport(existing);
      } else {
        void getReport(reportId).then((r) => {
          if (r) setSelectedReport(r);
        });
      }
    },
    [reports]
  );

  const handleUpdateStatus = async (report: Report, toStatus: ReportStatus, reason?: DecisionReason) => {
    setUpdatingId(report.id);
    try {
      if (!reason) throw new Error('Select a reason for this decision.');
      await updateReportStatus(report.id, toStatus, { reasonCode: reason.reasonCode, reason: reason.note });
      const label =
        toStatus === 'VERIFIED' ? 'Report validated.' : toStatus === 'UNVERIFIED' ? 'Report set to Pending.' : 'Report rejected.';
      toast.success(label, { position: 'top-right', autoClose: 3000 });
      setSelectedReport((current) => current?.id === report.id ? null : current);
      setRefreshKey((key) => key + 1);
      return true;
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update report status.',
        { position: 'top-right', autoClose: 4000 }
      );
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <div ref={workspaceRef} className="reports-workspace" data-map-workspace data-sheet={sheetPosition} data-panel-hidden={panelHidden} data-fullscreen={fullscreenMode}>
{panelHidden && <button type="button" onClick={() => setPanelHidden(false)} aria-expanded={false} aria-controls={contentId}
              className="absolute right-2 top-2 z-[1200] hidden h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm lg:inline-flex">
              <PanelRightOpen className="h-4 w-4" />Show reports
            </button>}
        <div ref={mapToolsRef} className="reports-map-tools pointer-events-none absolute left-2 top-2 z-[1200] flex max-w-[calc(100%-1rem)]">
          <div className="pointer-events-auto flex flex-wrap items-center gap-1">

            <div ref={setMapControlsHost} className="flex items-center" />
              <MapDisplayPopover {...mapDisplay} compact disabled={!mapDisplay.ready} className="rounded-full border border-slate-200 bg-white shadow-sm" align="start"
                onBasemapChange={value => mapRef.current?.setBasemap(value)} onModeChange={value => mapRef.current?.setMapMode(value)}
                onBarangayBoundariesChange={value => mapRef.current?.setBarangayBoundariesVisible(value)} onSmoothingChange={value => mapRef.current?.setPolygonSmoothing(value)}
                onBuildingsChange={value => mapRef.current?.setBuildingsVisible(value)} onRoadsChange={value => mapRef.current?.setRoadsVisible(value)}
                onFocusRoadsChange={value => mapRef.current?.setFocusRoads(value)} />
            {onFullscreenModeChange && <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreenMode ? 'Exit fullscreen' : 'Fullscreen'} title={fullscreenMode ? 'Exit fullscreen' : 'Fullscreen'} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-100">
              {fullscreenMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>}
          </div>
        </div>
        {fullscreenMode && fullscreenError && <p role="status" className="pointer-events-none absolute left-2 top-12 z-[1200] max-w-xs rounded-lg bg-white/95 px-2 py-1 text-xs text-slate-600">{fullscreenError}</p>}
        <div ref={workspaceBody} className="reports-workspace-body">
          <section aria-label="Flood report map" className="reports-workspace-map">
            {(hasEverBeenActive || active) ? <PublicMap
              controlsHost={mapControlsHost} mapApiRef={mapRef} onLocationSelect={handleNoopLocationSelect} selectedLocation={null}
              hideShareLocation hideWeather hideDisplayControls onDisplaySettingsChange={setMapDisplay}
              enableAddressLookup={false} reportFilters={reportFilters} onReportClick={handleMapPinClick}
              defaultBasemap="light" hideBuildingsOnSatellite hideBarangayBoundariesToggle
              rightInset={mapRightInset}
              bottomInset={desktop ? 0 : COLLAPSED_SHEET_HEIGHT}
            /> : <div className="flex h-full items-center justify-center"><Spinner size="md" /></div>}
          </section>
          <section ref={panelRef} aria-label="Reports panel" className="reports-workspace-panel">
            <header className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3">
              <button type="button" className="reports-sheet-handle flex min-h-[42px] min-w-0 flex-1 lg:min-h-12 flex-col items-start justify-center gap-1 text-left lg:cursor-default"
                aria-label={desktop ? 'Reports' : sheetPosition === 'collapsed' ? 'Show reports' : sheetPosition === 'half' ? 'Expand reports' : 'Collapse reports'}
                aria-expanded={desktop ? !panelHidden : sheetPosition !== 'collapsed'} aria-controls={contentId}
                onClick={() => { if (suppressSheetClick.current) { suppressSheetClick.current = false; return; } if (!desktop) moveSheet(sheetPosition === 'collapsed' ? 'full' : 'collapsed'); }}
                onPointerDown={startSheetDrag} onPointerMove={dragSheet} onPointerUp={endSheetDrag} onPointerCancel={event => endSheetDrag(event, true)}
                onKeyDown={event => { const index = SHEET_POSITIONS.indexOf(sheetPosition); if (!desktop && ['ArrowUp','ArrowDown','Home','End'].includes(event.key)) { event.preventDefault(); moveSheet(SHEET_POSITIONS[event.key === 'Home' ? 0 : event.key === 'End' ? 2 : Math.max(0, Math.min(2,index+(event.key === 'ArrowUp'?1:-1)))]); } }}>
                <span aria-hidden="true" className="mx-auto h-1 w-8 rounded-full bg-slate-300 lg:hidden" />
                <span className="max-w-full truncate text-[11px] font-semibold text-slate-700" title={`${reportBarStatus} · ${mapSubtitle}`}>{reportBarStatus}</span>
              </button>
              <button type="button" onClick={() => setPanelHidden(true)} aria-label="Hide reports" title="Hide reports" aria-expanded={!panelHidden} aria-controls={contentId}
                className="hidden h-8 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium text-slate-500 hover:bg-slate-100 lg:inline-flex"><PanelRightClose className="h-4 w-4" />Hide</button>
              <button type="button" className="rounded-lg p-2 text-slate-500 lg:hidden" aria-label={sheetPosition === 'full' ? 'Collapse reports panel' : 'Expand reports panel'} onClick={() => moveSheet(sheetPosition === 'full' ? 'collapsed' : 'full')}>
                {sheetPosition === 'full' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </header>
            <div id={contentId} className="reports-workspace-content" inert={!desktop && sheetPosition === 'collapsed'}>
              <div className="shrink-0 space-y-2 border-b border-slate-100 p-3">
                <form onSubmit={event => { event.preventDefault(); applySearch(); }} className="flex min-w-0 items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <input aria-label="Search reports" value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="Search UUID or address" className="min-w-0 w-full bg-transparent text-xs text-slate-700 outline-none" />
                  </label>
                </form>
                <p className="text-[9px] text-slate-400 lg:hidden">Scroll sideways for all columns</p>
                <div className="reports-filters" role="group" aria-label="Report filters">
                  <StatusFilterDropdown value={statusFilter} onChange={value => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                    setActiveHighlightedId(null);
                  }} />
                  <DepthsFilterDropdown value={depthFilter} onChange={value => {
                    setDepthFilter(value);
                    setCurrentPage(1);
                    setActiveHighlightedId(null);
                  }} />
                  <TimeFilterDropdown value={timeFilter} onChange={value => {
                    setTimeFilter(value);
                    setCurrentPage(1);
                    setActiveHighlightedId(null);
                  }} />
                  <button type="button" onClick={resetFilters} disabled={!canReset} aria-label="Reset filters" title="Reset filters" className="inline-flex h-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {error ? (
                <div className="p-6 text-sm text-red-700">{error}</div>
              ) : (
                <>
                  <div className="relative min-h-0 flex-1 overflow-auto overscroll-contain">
                  <div role={reports.length > 0 ? 'table' : undefined} aria-label={reports.length > 0 ? 'Flood reports' : undefined} className="reports-list divide-y divide-slate-100">
                    {reports.length > 0 && <div role="row" className={`reports-table-header bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 xl:gap-3 xl:border-b xl:border-slate-200 xl:px-4 xl:py-2 ${REPORT_TABLE_COLUMNS}`}>
                      {([
                        { label: 'Location', column: 'address' },
                        { label: 'Depth', column: 'depth' },
                        { label: 'Reporter', column: 'reporterType' },
                        { label: 'Status', column: 'status' },
                        { label: 'Submitted', column: 'createdAt' },
                        { label: 'Actions' },
                      ] satisfies { label: string; column?: ReportSortColumn }[]).map(({ label, column }) => {
                        const activeSort = column === sort.column;
                        const SortIcon = sort.direction === 'asc' ? ArrowUp : ArrowDown;
                        return <span key={label} role="columnheader" aria-sort={column ? activeSort ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}>
                          {column ? <button type="button" onClick={() => { setCurrentPage(1); toggleSort(column); }}
                            className={`relative flex w-full min-w-0 items-center rounded text-left focus-visible:outline-gakit-maroon hover:text-gakit-maroon ${activeSort ? 'pr-3 text-gakit-maroon' : ''}`}
                            title={`Sort ${label.toLowerCase()} ${activeSort && sort.direction === 'desc' ? 'ascending' : 'descending'}`}>
                            <span className="truncate">{label}</span>{activeSort && <SortIcon className="absolute right-0 h-2.5 w-2.5" aria-hidden="true" />}
                          </button> : label}
                        </span>;
                      })}
                    </div>}
                    {reports.map((report) => (
                      <ReportTableRow key={report.id} report={report} compactTable
                        highlighted={activeHighlightedId === report.id}
                        selected={selectedReport?.id === report.id}
                        updating={updatingId === report.id}
                        onInspect={() => handleInspect(report)}
                        onViewDetails={() => setSelectedReport(report)}
                        onUpdateStatus={handleUpdateStatus} />
                    ))}
                    {reports.length === 0 && loading && (
                      <>
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="flex items-start gap-3 p-4">
                            <div className="min-w-0 flex-1 space-y-2">
                              <Skeleton className="h-4 w-2/3 rounded-md" />
                              <Skeleton className="h-4 w-1/3 rounded-md" />
                            </div>
                            <Skeleton className="h-7 w-24 rounded-full" />
                            <Skeleton className="h-8 w-16 rounded-lg" />
                          </div>
                        ))}
                      </>
                    )}
                    {reports.length === 0 && !loading && (
                      <div className="px-5 py-12 text-center text-sm text-slate-500">
                        No reports match the current filters.
                      </div>
                    )}
                  </div>

                </div>
                <div className="shrink-0"><ReportsPagination
                  compact
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={total}
                  pageSize={REPORTS_PER_PAGE}
                  onPageChange={handlePageChange}
                /></div>
              </>
              )}
            </div>
          </section>
        </div>
      </div>
        {selectedReport && (
          <div>
            <ReportDetail
              key={selectedReport.id}
              report={selectedReport}
              onUpdateStatus={handleUpdateStatus}
              isUpdating={updatingId === selectedReport.id}
              onClose={() => setSelectedReport(null)}
              onViewOnMap={() => {
                setSelectedReport(null);
                requestAnimationFrame(() => handleInspect(selectedReport));
              }}
              modal
            />
          </div>
        )}
    </>
  );
}
