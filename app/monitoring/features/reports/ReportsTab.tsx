'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { PlusCircle, RotateCcw, Search } from 'lucide-react';
import {
  DEPTH_LABELS,
  REFERENCE_LABELS,
  STATUS_META,
  formatDateTime,
  formatReportDepth,
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
import { FeaturePageShell } from '@/components/FeaturePageShell';
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
import { SortableHeader } from '@/components/ui/SortableHeader';
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
}: {
  highlightedReportId?: string | null;
  active?: boolean;
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
  const router = useRouter();
  const mapRef = useRef<PublicMapHandle | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const tableSectionRef = useRef<HTMLElement | null>(null);
  const requestSeqRef = useRef(0);

  const { sort, toggleSort } = useSortableTable<ReportSortColumn>({
    column: 'createdAt',
    direction: 'desc',
  });

  const [activeHighlightedId, setActiveHighlightedId] = useState<string | null>(highlightedReportId);

  // Sync highlight/filters when the `highlightedReportId` prop changes.
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

  // Click-away listener: dismisses the maroon highlight when clicking outside the highlighted row
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

  const handleOpenPublicMapSubmit = () => {
    router.push('/');
  };

  const handleSortChange = (column: ReportSortColumn) => {
    toggleSort(column);
    setCurrentPage(1);
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
      <FeaturePageShell>
        <section ref={mapSectionRef} className="grid grid-cols-1 gap-4 scroll-mt-6">
            <div className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">
            <div className="h-[24rem] md:h-[32rem] relative">
              {/* <button
                type="button"
                onClick={handleOpenPublicMapSubmit}
                title="Submit a report on the public hazard map"
                className="absolute left-4 top-4 z-[1000] inline-flex items-center justify-center gap-2 rounded-2xl bg-gakit-maroon px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-maroon-900/20 transition-all duration-150 hover:bg-maroon-800 active:scale-95"
              >
                <PlusCircle className="h-4 w-4" />
                Submit Report
              </button> */}
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

            <div className="border-t border-canvas-grey px-5 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">
                Live map of reports ({mapSubtitle})
              </div>
              <div className="text-xs text-slate-500">Click a marker to view details.</div>
            </div>
          </div>
        </section>

        <section ref={tableSectionRef} className="grid grid-cols-1 gap-4 scroll-mt-6">
            <div className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">
              <div className="space-y-4 p-4 border-b border-canvas-grey">
                <div>
                  <h3 className="font-bold text-slate-900">Reports</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_10rem_auto_auto]">
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
                  <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-canvas-light text-slate-500">
                      <tr>
                        <th className="text-left font-semibold px-5 py-3">Report</th>
                        <SortableHeader
                          label="Location"
                          column="address"
                          sort={sort}
                          onSort={handleSortChange}
                        />
                        <SortableHeader
                          label="Depth"
                          column="depth"
                          sort={sort}
                          onSort={handleSortChange}
                        />
                        <th className="text-left font-semibold px-5 py-3">Reference</th>
                        <SortableHeader
                          label="Status"
                          column="status"
                          sort={sort}
                          onSort={handleSortChange}
                        />
                        <SortableHeader
                          label="Submitted"
                          column="createdAt"
                          sort={sort}
                          onSort={handleSortChange}
                        />
                        <th className="text-left font-semibold px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-canvas-grey">
                      {reports.map((report) => {
                        const isHighlighted = activeHighlightedId === report.id;
                        return (
                          <tr
                            key={report.id}
                            data-highlighted-report={isHighlighted ? report.id : undefined}
                            className={`${
                              isHighlighted
                                ? 'bg-maroon-100'
                                : selectedReport?.id === report.id
                                ? 'bg-maroon-100/80'
                                : 'hover:bg-canvas-light/70'
                            } transition-all duration-300`}
                          >
                            <td className="px-5 py-4">
                              <div className="font-mono text-xs font-semibold text-slate-900">
                                {report.id.slice(0, 8)}
                              </div>
                              <div className="text-xs text-slate-500">Public report</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-slate-700">
                                {report.location.address || 'Unknown location'}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                              {formatReportDepth(report.depth, report.depthCm)}
                            </td>
                            <td className="px-5 py-4 text-slate-700">
                              {report.reference ? REFERENCE_LABELS[report.reference] : '—'}
                            </td>
                            <td className="px-5 py-4">
                              <StatusDropdown
                                report={report}
                                isUpdating={updatingId === report.id}
                                onUpdateStatus={handleUpdateStatus}
                              />
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDateTime(report.createdAt)}</td>
                            <td className="px-5 py-4">
                              <ReportActions
                                report={report}
                                onInspect={() => handleInspect(report)}
                                onViewDetails={() => setSelectedReport(report)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {reports.length === 0 && loading && (
                        <>
                          {Array.from({ length: 5 }).map((_, index) => (
                            <tr key={index}>
                              <td className="px-5 py-4"><Skeleton className="h-3.5 w-20 rounded-md" /></td>
                              <td className="px-5 py-4"><Skeleton className="h-3.5 w-44 rounded-md" /></td>
                              <td className="px-5 py-4"><Skeleton className="h-3.5 w-16 rounded-md" /></td>
                              <td className="px-5 py-4"><Skeleton className="h-3.5 w-20 rounded-md" /></td>
                              <td className="px-5 py-4"><Skeleton className="h-5 w-24 rounded-full" /></td>
                              <td className="px-5 py-4"><Skeleton className="h-3.5 w-24 rounded-md" /></td>
                              <td className="px-5 py-4"><Skeleton className="h-8 w-24 rounded-lg" /></td>
                            </tr>
                          ))}
                        </>
                      )}
                      {reports.length === 0 && !loading && (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                            No reports match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden divide-y divide-canvas-grey">
                  {reports.map((report) => {
                    const isHighlighted = activeHighlightedId === report.id;
                    return (
                      <div
                        key={report.id}
                        data-highlighted-report={isHighlighted ? report.id : undefined}
                        className={`flex items-start gap-2 p-4 hover:bg-canvas-light ${
                          isHighlighted ? 'bg-maroon-100' : ''
                        } transition-all duration-300`}
                      >
                        <button
                          type="button"
                          onClick={() => handleInspect(report)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div>
                            <div className="font-mono text-xs font-semibold text-slate-900">
                              {report.id.slice(0, 8)}
                            </div>
                            <div className="text-sm text-slate-600 mt-1">
                              {report.location.address || 'Unknown location'}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {formatReportDepth(report.depth, report.depthCm)}
                              {report.reference && <span className="ml-1.5 text-slate-400">· {REFERENCE_LABELS[report.reference]}</span>}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{formatDateTime(report.createdAt)}</div>
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
      </FeaturePageShell>
    </>
  );
}
