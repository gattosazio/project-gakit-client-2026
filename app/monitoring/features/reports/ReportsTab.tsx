'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, RotateCcw, Search } from 'lucide-react';
import {
  DEPTH_BAR_COLOR,
  DEPTH_LABELS,
  REFERENCE_LABELS,
  STATUS_META,
  formatDateTime,
  formatReportDepth,
  timeAgo,
} from '@/lib/reports/reportFormatting';
import type { PublicMapHandle } from '@/components/PublicMap';
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
import { ReportActions, StatusDropdown } from './ReportActions';
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
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const tableSectionRef = useRef<HTMLElement | null>(null);
  const requestSeqRef = useRef(0);

  const { sort } = useSortableTable<ReportSortColumn>({
    column: 'createdAt',
    direction: 'desc',
  });

  const [activeHighlightedId, setActiveHighlightedId] = useState<string | null>(highlightedReportId);

  useEffect(() => {
    if (!highlightedReportId) return;
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
  }, [highlightedReportId]);

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
    if (!initialStatus && !initialTime) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (initialStatus) {
        setStatusFilter(initialStatus);
        setStatusDraft(initialStatus);
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
  }, [initialStatus, initialTime]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const seq = requestSeqRef.current + 1;
      requestSeqRef.current = seq;
      setLoading(true);
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
    }, 300);

    return () => clearTimeout(timer);
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
        toStatus === 'VERIFIED' ? 'Report verified.' : toStatus === 'ANOMALY' ? 'Report marked as anomaly.' : 'Report rejected.';
      toast.success(label, { position: 'top-right', autoClose: 3000 });
      setRefreshKey((key) => key + 1);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update report status.',
        { position: 'top-right', autoClose: 4000 }
      );
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
                {active ? (
                  <PublicMap
                    mapApiRef={mapRef}
                    onLocationSelect={handleNoopLocationSelect}
                    selectedLocation={null}
                    hideShareLocation
                    hideWeather
                    enableAddressLookup={false}
                    hasBottomNav
                    reportFilters={reportFilters}
                    onReportClick={handleMapPinClick}
                    defaultBasemap="satellite"
                    defaultShowBarangayBoundaries
                  />
                ) : (
                  <div className="w-full h-full bg-canvas-grey flex items-center justify-center">
                    <Spinner size="md" />
                  </div>
                )}
              </div>

              <div className="border-t border-canvas-grey px-5 py-3 text-xs text-slate-500">
                Click a marker to view details.
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
                        {total} {total === 1 ? 'report' : 'reports'}
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
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      canReset
                        ? 'border-canvas-grey bg-white text-slate-700 hover:bg-canvas-light hover:border-slate-300 cursor-pointer'
                        : 'border-canvas-grey/60 bg-canvas-light/60 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <RotateCcw className={`w-4 h-4 transition-colors ${canReset ? 'text-gakit-maroon' : 'text-slate-400'}`} />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-maroon-800"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>

              {error ? (
                <div className="p-6 text-sm text-red-700">{error}</div>
              ) : (
                <>
                  <div className="divide-y divide-canvas-grey">
                    {reports.map((report) => {
                      const isHighlighted = activeHighlightedId === report.id;
                      const needsReview =
                        report.status === 'UNVERIFIED' &&
                        (report.depth.code === 'head' || report.depth.code === 'overhead');
                      return (
                        <div
                          key={report.id}
                          data-highlighted-report={isHighlighted ? report.id : undefined}
                          className={`flex items-start gap-3 p-4 transition-all duration-300 ${
                            isHighlighted
                              ? 'bg-maroon-100'
                              : selectedReport?.id === report.id
                              ? 'bg-maroon-100/80'
                              : 'hover:bg-canvas-light/70'
                          } ${needsReview ? 'border-l-2 border-hazard-critical' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleInspect(report)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-slate-900">
                                {report.location.address || 'Unknown location'}
                              </span>
                              {needsReview && (
                                <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hazard-critical ring-1 ring-red-200">
                                  Needs review
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <span className="font-mono text-[11px] text-slate-400">
                                {report.id.slice(0, 8)}
                              </span>
                              <span
                                className="flex items-center gap-1.5 font-semibold"
                                style={{ color: DEPTH_BAR_COLOR[report.depth.code] }}
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: DEPTH_BAR_COLOR[report.depth.code] }}
                                />
                                {formatReportDepth(report.depth, report.depthCm)}
                              </span>
                              {report.reference && (
                                <span>· {REFERENCE_LABELS[report.reference]}</span>
                              )}
                              <span
                                className="text-slate-400"
                                title={formatDateTime(report.createdAt)}
                              >
                                · {timeAgo(report.createdAt)}
                              </span>
                            </div>
                          </button>
                          <StatusDropdown
                            report={report}
                            isUpdating={updatingId === report.id}
                            onUpdateStatus={handleUpdateStatus}
                          />
                          <ReportActions
                            report={report}
                            showInspect={false}
                            onInspect={() => handleInspect(report)}
                            onViewDetails={() => setSelectedReport(report)}
                          />
                        </div>
                      );
                    })}
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
