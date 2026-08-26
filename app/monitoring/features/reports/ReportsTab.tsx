'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, PlusCircle, RotateCcw, Search } from 'lucide-react';
import { DEPTH_LABELS, STATUS_META, formatDateTime } from '@/lib/reports/reportFormatting';
import type { PublicMapHandle } from '@/components/PublicMap';
import type { FloodDepthCode, Report, ReportStatus } from '@/types/report';
import { toast } from 'react-toastify';
import { FeaturePageShell } from '../shared/FeaturePageShell';
import { createClient } from '@/lib/supabase/client';
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
  const [timeFilter, setTimeFilter] = useState('24h');
  const [criticalFilter, setCriticalFilter] = useState(initialCritical);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [actor, setActor] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const mapRef = useRef<PublicMapHandle | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const requestSeqRef = useRef(0);

  const [activeHighlightedId, setActiveHighlightedId] = useState<string | null>(highlightedReportId);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setActor(data.user.email);
    });
  }, []);

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
      const since =
        selectedRange && selectedRange.hours != null
          ? new Date(
              Math.floor((Date.now() - selectedRange.hours * 3600 * 1000) / 60_000) * 60_000
            ).toISOString()
          : undefined;

      fetchReports({
        page: currentPage,
        limit: REPORTS_PER_PAGE,
        search: query.trim() || undefined,
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

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('All');
    setDepthFilter('All');
    setTimeFilter('24h');
    setCriticalFilter(false);
    setCurrentPage(1);
  };

  const handleLocationSelect = (location: SelectedLocation) => {
    setSelectedLocation(location);
    setIsReportModalOpen(true);
  };

  const handleStaffReportSubmit = async (data: {
    location: { lat: number; lng: number; elevation?: number };
    depth: 'ankle' | 'knee' | 'waist' | 'shoulder' | 'head' | 'overhead';
    depthCm?: number;
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

  const handleUpdateStatus = async (report: Report, toStatus: ReportStatus) => {
    setUpdatingId(report.id);
    try {
      await updateReportStatus(report.id, toStatus, { actor });
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
        <section className="grid grid-cols-1 gap-4">
            <div className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">
              <div className="space-y-4 p-4 border-b border-canvas-grey">
                <div>
                  <h3 className="font-bold text-slate-900">Reports</h3>
                  {/* <p className="text-sm text-slate-500">{loading ? 'Loading...' : `${total} reports found`}</p> */}
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
                  <button onClick={resetFilters} className="flex items-center justify-center gap-2 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light">
                    <RotateCcw className="w-4 h-4" />
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
                              isHighlighted || selectedReport?.id === report.id
                                ? 'bg-maroon-100/80'
                                : 'hover:bg-canvas-light/70'
                            } transition-colors duration-200`}
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
                          <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
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
                          isHighlighted ? 'bg-maroon-100/80' : ''
                        } transition-colors duration-200`}
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

        <section ref={mapSectionRef} className="grid grid-cols-1 gap-4 scroll-mt-6">
          <div className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">
            <div className="p-4 border-b border-canvas-grey flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Map</h3>
                <p className="text-sm text-slate-500">
                  Click Inspect on a report to zoom to its pinned location on the map.
                </p>
              </div>
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
              <div className="text-xs text-slate-500">Hover or click a marker to inspect details.</div>
            </div>
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
