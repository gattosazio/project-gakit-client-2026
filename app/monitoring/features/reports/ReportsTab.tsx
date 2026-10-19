'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowDown, ArrowUp, ArrowUpDown, MapPin, RotateCcw, Search } from 'lucide-react';
import {
  DEPTH_LABELS,
  STATUS_META,
  formatDateTime,
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

const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center"><Spinner size="md" /></div>,
  ssr: false,
});

const REPORTS_PER_PAGE = 6;

export function ReportsTab({
  highlightedReportId = null,
  active = true,
  initialStatus = null,
  initialTime = null,
}: {
  highlightedReportId?: string | null;
  active?: boolean;
  initialStatus?: ReportStatus | null;
  initialTime?: string | null;
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
  const [statusDraft, setStatusDraft] = useState<'All' | ReportStatus>('All');
  const [depthDraft, setDepthDraft] = useState<'All' | FloodDepthCode>('All');
  const [timeDraft, setTimeDraft] = useState('48h');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const mapRef = useRef<PublicMapHandle | null>(null);
  const [mapDisplay, setMapDisplay] = useState<MapDisplaySettings & { showBarangayBoundaries: boolean; ready: boolean }>({ basemap: 'satellite', mode: '2d', showBuildings: true, showRoads: false, showBarangayBoundaries: true, ready: false });
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const tableSectionRef = useRef<HTMLElement | null>(null);
  const requestSeqRef = useRef(0);

  const { sort, toggleSort } = useSortableTable<ReportSortColumn>({
    column: 'createdAt',
    direction: 'desc',
  });

  const [activeHighlightedId, setActiveHighlightedId] = useState<string | null>(highlightedReportId);
  const [hasEverBeenActive, setHasEverBeenActive] = useState(Boolean(active));

  useEffect(() => {
    if (active) {
      setHasEverBeenActive(true);
      const timer = setTimeout(() => {
        mapRef.current?.resize?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('resize'));
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [active]);

  useEffect(() => {
    if (!active || !highlightedReportId) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setActiveHighlightedId(highlightedReportId);
      setQuery(highlightedReportId);
      setQueryDraft(highlightedReportId);
      setTimeFilter('all');
      setTimeDraft('all');
      setCurrentPage(1);
    });
    return () => {
      cancelled = true;
    };
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
      setStatusDraft(initialStatus ?? 'All');
      setDepthFilter('All');
      setDepthDraft('All');
      if (!highlightedReportId) {
        setQuery('');
        setQueryDraft('');
      }
      if (initialTime) {
        setTimeFilter(initialTime);
        setTimeDraft(initialTime);
      }
      setCurrentPage(1);
    });
    return () => {
      cancelled = true;
    };
  }, [active, initialStatus, initialTime, highlightedReportId]);

  useEffect(() => {
    if (!active) return;
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    // Only show full loading skeleton on initial load; keep existing reports visible during revalidations
    if (reports.length === 0) {
      setLoading(true);
    }
    setError(null);

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
        setUpdatedAt(new Date());
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
  }, [active, currentPage, query, statusFilter, depthFilter, timeFilter, refreshKey, sort]);

  // Background auto-refresh, paused while the tab is hidden.
  useVisibleInterval(() => setRefreshKey((key) => key + 1), 30_000, active);

  const canReset =
    (queryDraft || '').trim() !== '' ||
    statusDraft !== 'All' ||
    depthDraft !== 'All' ||
    timeDraft !== '48h' ||
    activeHighlightedId !== null;

  const applyFilters = () => {
    setQuery(queryDraft);
    setStatusFilter(statusDraft);
    setDepthFilter(depthDraft);
    setTimeFilter(timeDraft);
    setCurrentPage(1);
    setActiveHighlightedId(null);
  };

  const resetFilters = () => {
    setQueryDraft('');
    setStatusDraft('All');
    setDepthDraft('All');
    setTimeDraft('48h');
    setQuery('');
    setStatusFilter('All');
    setDepthFilter('All');
    setTimeFilter('48h');
    setCurrentPage(1);
    setActiveHighlightedId(null);
  };

  // The map eats the same dropdown filters as the table: recency window plus
  // optional status/depth. Filtering happens server-side before the
  // map endpoint's result limit, so table and map can never show diverging sets.
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

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleNoopLocationSelect = useCallback(() => {}, []);

  const handleInspect = (report: Report) => {
    mapRef.current?.showReport({
      id: report.id,
      lat: report.location.latitude,
      lng: report.location.longitude,
      address:
        report.location.address ||
        `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`,
      depthLabel: formatReportDepth(report.depth, report.depthCm),
      statusLabel: STATUS_META[report.status].label,
      createdAt: formatDateTime(report.createdAt),
    });
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const handleUpdateStatus = async (report: Report, toStatus: ReportStatus, reason?: string) => {
    setUpdatingId(report.id);
    try {
      await updateReportStatus(report.id, toStatus, { reason });
      const label =
        toStatus === 'VERIFIED' ? 'Report verified.' : toStatus === 'ANOMALY' ? 'Report marked as anomaly.' : toStatus === 'UNVERIFIED' ? 'Report reopened for review.' : 'Report rejected.';
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
      <section ref={mapSectionRef} className="grid grid-cols-1 gap-4 scroll-mt-6">
            <div className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-canvas-grey px-5 py-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gakit-maroon" />
                  <h3 className="text-sm font-bold text-slate-900">Incident map</h3>
                </div>
                <div className="min-w-0 text-xs text-slate-500">
                  <span className="block truncate">Live map of reports ({mapSubtitle})</span>
                </div>
              </div>
              <div className="h-[24rem] md:h-[28rem] relative">
                {hasEverBeenActive ? (
                  <PublicMap
                    mapApiRef={mapRef}
                    onLocationSelect={handleNoopLocationSelect}
                    selectedLocation={null}
                    hideShareLocation
                    hideWeather
                    hideDisplayControls
                    onDisplaySettingsChange={setMapDisplay}
                    enableAddressLookup={false}
                    reportFilters={reportFilters}
                    onReportClick={handleMapPinClick}
                    defaultBasemap="satellite"
                    hideBuildingsOnSatellite
                    defaultShowBarangayBoundaries
                    hideBarangayBoundariesToggle
                  />
                ) : (
                  <div className="w-full h-full bg-canvas-grey flex items-center justify-center">
                    <Spinner size="md" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-canvas-grey px-5 py-2 text-xs text-slate-500">
                <span>Click a marker to view details.</span>
                <MapDisplayPopover {...mapDisplay} compact placement="above" disabled={!mapDisplay.ready}
                  onBasemapChange={(value) => mapRef.current?.setBasemap(value)}
                  onModeChange={(value) => mapRef.current?.setMapMode(value)}
                  onBarangayBoundariesChange={(value) => mapRef.current?.setBarangayBoundariesVisible(value)}
                  onSmoothingChange={value => mapRef.current?.setPolygonSmoothing(value)}
                  onBuildingsChange={(value) => mapRef.current?.setBuildingsVisible(value)}
                  onRoadsChange={(value) => mapRef.current?.setRoadsVisible(value)}
                  onFocusRoadsChange={(value) => mapRef.current?.setFocusRoads(value)} />
              </div>
            </div>
        </section>

        <section ref={tableSectionRef} className="grid grid-cols-1 gap-4 scroll-mt-6">
            <div className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">
              <div className="space-y-4 p-4 border-b border-canvas-grey">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-900">Reports</h3>
                  <div className="flex items-center gap-3">
                    {!loading && (
                      <span className="text-xs text-slate-500">
                        {/* {total} {total === 1 ? 'report' : 'reports'} */}
                        {total > REPORTS_PER_PAGE ? ` · page ${currentPage} of ${totalPages}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(16rem,1fr)_auto_auto_auto_auto_auto]">
                  <label className="col-span-2 flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2 xl:col-span-1">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      value={queryDraft}
                      onChange={(event) => {
                        setQueryDraft(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') applyFilters();
                      }}
                      placeholder="Search UUID or address"
                      className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
                    />
                  </label>
                  <StatusFilterDropdown value={statusDraft} onChange={setStatusDraft} />
                  <DepthsFilterDropdown value={depthDraft} onChange={setDepthDraft} />
                  <TimeFilterDropdown value={timeDraft} onChange={setTimeDraft} />
                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={!canReset}
                    className={`inline-flex h-8 w-28 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold transition-colors ${
                      canReset
                        ? 'border-canvas-grey bg-white text-slate-700 hover:bg-canvas-light hover:border-slate-300 cursor-pointer'
                        : 'border-canvas-grey/60 bg-canvas-light/60 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <RotateCcw className={`h-3.5 w-3.5 transition-colors ${canReset ? 'text-gakit-maroon' : 'text-slate-400'}`} />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="inline-flex h-8 w-28 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-gakit-maroon px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-maroon-800"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>

              {error ? (
                <div className="p-6 text-sm text-red-700">{error}</div>
              ) : (
                <>
                  <div role={reports.length > 0 ? 'table' : undefined} aria-label={reports.length > 0 ? 'Flood reports' : undefined} className="divide-y divide-slate-100">
                    {reports.length > 0 && <div role="row" className={`sr-only bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 xl:not-sr-only xl:grid xl:gap-3 xl:border-b xl:border-slate-200 xl:px-4 xl:py-2 ${REPORT_TABLE_COLUMNS}`}>
                      {([
                        { label: 'Report / location' },
                        { label: 'Flood depth', column: 'depth' },
                        { label: 'Reporter', column: 'reporterType' },
                        { label: 'Sources', column: 'evidenceScore' },
                        { label: 'Submitted', column: 'createdAt' },
                        { label: 'Status', column: 'status' },
                        { label: 'Details' },
                      ] satisfies { label: string; column?: ReportSortColumn }[]).map(({ label, column }) => {
                        const activeSort = column === sort.column;
                        const SortIcon = activeSort ? sort.direction === 'asc' ? ArrowUp : ArrowDown : ArrowUpDown;
                        return <span key={label} role="columnheader" aria-sort={column ? activeSort ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}>
                          {column ? <button type="button" onClick={() => { setCurrentPage(1); toggleSort(column); }}
                            className={`inline-flex items-center gap-1 rounded text-left focus-visible:outline-gakit-maroon hover:text-gakit-maroon ${activeSort ? 'text-gakit-maroon' : ''}`}
                            title={`Sort ${label.toLowerCase()} ${activeSort && sort.direction === 'desc' ? 'ascending' : 'descending'}`}>
                            {label}<SortIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                          </button> : label}
                        </span>;
                      })}
                    </div>}
                    {reports.map((report) => (
                      <ReportTableRow key={report.id} report={report}
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

                <ReportsPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={total}
                  pageSize={REPORTS_PER_PAGE}
                  onPageChange={handlePageChange}
                />
              </>
              )}
            </div>
        </section>
        {selectedReport && (
          <div>
            <ReportDetail
              // A fresh instance per report: the minimap, the failed flag and
              // the status-menu state must never leak from one report into the
              // next through a reused instance.
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
