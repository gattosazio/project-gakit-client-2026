'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, PlusCircle, RotateCcw, Search } from 'lucide-react';
import { DEPTH_LABELS, REFERENCE_LABELS, STATUS_META, formatDateTime } from '@/lib/reports/reportFormatting';
import type { PublicMapHandle } from '@/components/PublicMap';
import type { FloodDepthCode, FloodReference, Report, ReportStatus } from '@/types/report';
import { toast } from 'react-toastify';
import { FeaturePageShell } from '@/components/FeaturePageShell';
import { createReport, listReports as fetchReports, updateReportStatus } from './actions/reports';
import { ReportDetail } from './ReportDetail';
import {
  DepthsFilterDropdown,
  StatusFilterDropdown,
  TimeFilterDropdown,
} from './ReportFilterDropdowns';
import { timeRangeOptions } from './reportFilterOptions';
import { ReportActions } from './ReportActions';
import { ReportsPagination } from './ReportsPagination';
import {
  StaffSubmitReportModal,
  type SelectedLocation,
} from './StaffSubmitReportModal';
import { useVisibleInterval } from '@/hooks/useVisibleInterval';

const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
  ssr: false,
});

const REPORTS_PER_PAGE = 6;

export function ReportsTab({
  initialCritical = false,
  highlightedReportId = null,
  active = true,
}: {
  initialCritical?: boolean;
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
  const [criticalFilter, setCriticalFilter] = useState(initialCritical);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const mapRef = useRef<PublicMapHandle | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const tableSectionRef = useRef<HTMLElement | null>(null);
  const requestSeqRef = useRef(0);

  const [activeHighlightedId, setActiveHighlightedId] = useState<string | null>(highlightedReportId);

  // Keep the critical-only filter in sync with the "Review Critical Reports"
  // deep link (ReportsTab is now mounted once, so this won't re-run on mount).
  useEffect(() => {
    setCriticalFilter(initialCritical);
  }, [initialCritical]);

  useEffect(() => {
    if (!highlightedReportId) return;
    setActiveHighlightedId(highlightedReportId);
    setQuery(highlightedReportId);
    setTimeFilter('all');
    setCurrentPage(1);
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
        critical: criticalFilter || undefined,
        created_after: since,
      })
        .then((result) => {
          if (seq !== requestSeqRef.current) return;
          setReports(result.items);
          setTotal(result.total);
          setTotalPages(Math.max(1, result.totalPages));
          setSelectedReportId((currentId) =>
            currentId && result.items.some((report) => report.id === currentId)
              ? currentId
              : null
          );
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
  }, [active, currentPage, query, statusFilter, depthFilter, timeFilter, criticalFilter, refreshKey]);

  // Background auto-refresh, paused while the tab is hidden.
  useVisibleInterval(() => setRefreshKey((key) => key + 1), 30_000, active);

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) || null;

  const canReset =
    (query || '').trim() !== '' ||
    statusFilter !== 'All' ||
    depthFilter !== 'All' ||
    timeFilter !== '48h' ||
    Boolean(criticalFilter) ||
    activeHighlightedId !== null;

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('All');
    setDepthFilter('All');
    setTimeFilter('48h');
    setCriticalFilter(false);
    setCurrentPage(1);
    setActiveHighlightedId(null);
  };

  const handleLocationSelect = (location: SelectedLocation) => {
    setSelectedLocation(location);
    setIsReportModalOpen(true);
  };

  const handleStaffReportSubmit = async (data: {
    location: { lat: number; lng: number; elevation?: number };
    depth: 'ankle' | 'knee' | 'waist' | 'shoulder' | 'head' | 'overhead';
    depthCm?: number;
    reference: { id: FloodReference; label: string; landmark: string };
    image?: File;
  }): Promise<void> => {
    const fallbackAddress = `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`;

    await createReport({
      location: {
        latitude: data.location.lat,
        longitude: data.location.lng,
        address: selectedLocation?.address || fallbackAddress,
      },
      depth: data.depth,
      ...(data.depthCm != null ? { depthCm: data.depthCm } : {}),
      reference: data.reference.id,
    });

    toast.success('Staff report submitted successfully.', {
      position: 'top-right',
      autoClose: 3000,
    });
    setIsReportModalOpen(false);
    setIsSubmitOpen(false);
    setSelectedLocation(null);
    setRefreshKey((key) => key + 1);
  };

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
      depthLabel: DEPTH_LABELS[report.depth.code],
      statusLabel: STATUS_META[report.status].label,
      createdAt: formatDateTime(report.createdAt),
    });
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleMapPinClick = useCallback((reportId: string) => {
    setActiveHighlightedId(reportId);
    setSelectedReportId(null);
    setCurrentPage(1);
    setQuery(reportId);
    setTimeout(() => {
      tableSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const handleUpdateStatus = async (report: Report, toStatus: ReportStatus) => {
    setUpdatingId(report.id);
    try {
      await updateReportStatus(report.id, toStatus);
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
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Map</h3>
              </div>

            <div className="h-[20rem] md:h-[26rem] relative">
              {active ? (
                <PublicMap
                  mapApiRef={mapRef}
                  onLocationSelect={handleNoopLocationSelect}
                  selectedLocation={null}
                  hideShareLocation
                  hideAttribution
                  enableAddressLookup={false}
                  reportWindowHours={timeRangeOptions.find((opt) => opt.value === timeFilter)?.hours ?? null}
                  onReportClick={handleMapPinClick}
                />
              ) : (
                <div className="w-full h-full bg-canvas-grey flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              )}
            </div>

            <div className="border-t border-canvas-grey px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">
                Live map of reports ({timeRangeOptions.find((opt) => opt.value === timeFilter)?.label.toLowerCase() ?? 'all time'})
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
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_10rem_10rem_auto_auto]">
                  <label className="col-span-2 flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2 xl:col-span-1">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search UUID or address"
                      className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
                    />
                  </label>
                  <StatusFilterDropdown value={statusFilter} onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }} />
                  <DepthsFilterDropdown value={depthFilter} onChange={(value) => { setDepthFilter(value); setCurrentPage(1); }} />
                  <TimeFilterDropdown value={timeFilter} onChange={(value) => { setTimeFilter(value); setCurrentPage(1); }} />
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
                  <button onClick={() => setIsSubmitOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-800">
                    <PlusCircle className="w-4 h-4" />
                    Submit Report
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
                        <th className="text-left font-semibold px-5 py-3">Location</th>
                        <th className="text-left font-semibold px-5 py-3">Depth</th>
                        <th className="text-left font-semibold px-5 py-3">Reference</th>
                        <th className="text-left font-semibold px-5 py-3">Status</th>
                        <th className="text-left font-semibold px-5 py-3">Submitted</th>
                        <th className="text-left font-semibold px-5 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-canvas-grey">
                      {reports.map((report) => {
                        const status = STATUS_META[report.status];
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
                            <td className="px-5 py-4 text-slate-700">{DEPTH_LABELS[report.depth.code]}</td>
                            <td className="px-5 py-4 text-slate-700">
                              {report.reference ? REFERENCE_LABELS[report.reference] : '—'}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-slate-600">{formatDateTime(report.createdAt)}</td>
                            <td className="px-5 py-4">
                              <ReportActions
                                report={report}
                                isUpdating={updatingId === report.id}
                                onInspect={() => handleInspect(report)}
                                onViewDetails={() => setSelectedReportId(report.id)}
                                onUpdateStatus={handleUpdateStatus}
                              />
                            </td>
                          </tr>
                        );
                      })}
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
                    const status = STATUS_META[report.status];
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
                          <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-mono text-xs font-semibold text-slate-900">
                              {report.id.slice(0, 8)}
                            </div>
                            <div className="text-sm text-slate-600 mt-1">
                              {report.location.address || 'Unknown location'}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {DEPTH_LABELS[report.depth.code]}
                              {report.reference && <span className="ml-1.5 text-slate-400">· {REFERENCE_LABELS[report.reference]}</span>}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{formatDateTime(report.createdAt)}</div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}>
                            {status.label}
                          </span>
                          </div>
                        </button>
                        <ReportActions
                          report={report}
                          isUpdating={updatingId === report.id}
                          showInspect={false}
                          onInspect={() => handleInspect(report)}
                          onViewDetails={() => setSelectedReportId(report.id)}
                          onUpdateStatus={handleUpdateStatus}
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
              onClose={() => setSelectedReportId(null)}
              modal
            />
          </div>
        )}
      </FeaturePageShell>

      {isSubmitOpen && (
        <StaffSubmitReportModal
          selectedLocation={selectedLocation}
          isReportModalOpen={isReportModalOpen}
          onClose={() => {
            setIsSubmitOpen(false);
            setIsReportModalOpen(false);
            setSelectedLocation(null);
          }}
          onLocationSelect={handleLocationSelect}
          onReportModalClose={() => {
            setIsReportModalOpen(false);
            setSelectedLocation(null);
          }}
          onSubmit={handleStaffReportSubmit}
        />
      )}
    </>
  );
}
