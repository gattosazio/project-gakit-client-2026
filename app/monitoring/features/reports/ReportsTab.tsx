'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileImage,
  Filter,
  PlusCircle,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { ReportModal } from '@/app/public-view/ReportModal';
import { createReport, fetchReports, type FloodDepthCode, type Report, type ReportStatus } from '@/lib/api';
import { DEPTH_LABELS, STATUS_META, formatDateTime } from '@/lib/reportFormatting';
import { toast } from 'react-toastify';
import { FeaturePageShell } from '../shared/FeaturePageShell';

const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
  ssr: false,
});

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
  elevation?: number;
}

const statusOptions: Array<'All' | ReportStatus> = ['All', 'UNVERIFIED', 'VERIFIED', 'ANOMALY', 'REJECTED'];
const depthOptions: Array<'All' | FloodDepthCode> = ['All', 'ankle', 'knee', 'waist', 'head', 'overhead'];
const REPORTS_PER_PAGE = 6;

export function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ReportStatus>('All');
  const [depthFilter, setDepthFilter] = useState<'All' | FloodDepthCode>('All');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      fetchReports({
        page: currentPage,
        limit: REPORTS_PER_PAGE,
        search: query.trim() || undefined,
        status: statusFilter === 'All' ? undefined : statusFilter,
        depth: depthFilter === 'All' ? undefined : depthFilter,
      })
        .then((result) => {
          setReports(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages);
          setSelectedReportId((currentId) =>
            currentId && result.items.some((report) => report.id === currentId)
              ? currentId
              : (result.items[0]?.id ?? null)
          );
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to load reports');
          setReports([]);
          setTotal(0);
          setTotalPages(1);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [currentPage, query, statusFilter, depthFilter, refreshKey]);

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) || reports[0] || null;

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('All');
    setDepthFilter('All');
    setCurrentPage(1);
  };

  const handleLocationSelect = (location: SelectedLocation) => {
    setSelectedLocation(location);
    setIsReportModalOpen(true);
  };

  const handleStaffReportSubmit = async (data: {
    location: { lat: number; lng: number; elevation?: number };
    depth: 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
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

  return (
    <>
      <FeaturePageShell
        toolbar={
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_10rem_auto_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search ID, location, or barangay"
              className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'All' | ReportStatus);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'All' ? 'All statuses' : STATUS_META[status].label}
              </option>
            ))}
          </select>

          <select
            value={depthFilter}
            onChange={(event) => {
              setDepthFilter(event.target.value as 'All' | FloodDepthCode);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            {depthOptions.map((depth) => (
              <option key={depth} value={depth}>
                {depth === 'All' ? 'All depths' : DEPTH_LABELS[depth]}
              </option>
            ))}
          </select>

          <button className="flex items-center justify-center gap-2 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light">
            <CalendarDays className="w-4 h-4" />
            All time
          </button>

          <button
            onClick={resetFilters}
            className="flex items-center justify-center gap-2 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <button
            onClick={() => setIsSubmitOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-800"
          >
            <PlusCircle className="w-4 h-4" />
            Submit Report
          </button>
        </div>
        }
      >
        <section className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_24rem] gap-4">
          <div className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-canvas-grey flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Reports</h3>
                <p className="text-sm text-slate-500">{loading ? 'Loading...' : `${total} reports found`}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Filter className="w-4 h-4" />
                Live filters
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
                        return (
                          <tr
                            key={report.id}
                            className={selectedReport?.id === report.id ? 'bg-maroon-50/60' : 'hover:bg-canvas-light/70'}
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
                              <button
                                onClick={() => setSelectedReportId(report.id)}
                                className="inline-flex items-center gap-2 rounded-lg border border-canvas-grey px-3 py-2 text-xs font-semibold text-slate-700 hover:border-gakit-maroon hover:text-gakit-maroon"
                              >
                                <Eye className="w-4 h-4" />
                                Inspect
                              </button>
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
                    return (
                      <button
                        key={report.id}
                        onClick={() => setSelectedReportId(report.id)}
                        className="w-full p-4 text-left hover:bg-canvas-light"
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

          {selectedReport ? (
            <ReportDetails report={selectedReport} />
          ) : (
            <aside className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
              <div className="p-5 text-sm text-slate-500">Select a report to view details.</div>
            </aside>
          )}
        </section>
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

function StaffSubmitReportModal({
  selectedLocation,
  isReportModalOpen,
  onClose,
  onLocationSelect,
  onReportModalClose,
  onSubmit,
}: {
  selectedLocation: SelectedLocation | null;
  isReportModalOpen: boolean;
  onClose: () => void;
  onLocationSelect: (location: SelectedLocation) => void;
  onReportModalClose: () => void;
  onSubmit: (data: {
    location: { lat: number; lng: number; elevation?: number };
    depth: 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
    image?: File;
  }) => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-[1400] bg-slate-950/60 p-3 md:p-6">
      <div className="h-full overflow-hidden rounded-lg bg-white shadow-2xl flex flex-col">
        <div className="h-16 shrink-0 border-b border-canvas-grey px-4 md:px-6 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Submit Staff Report</h2>
            <p className="text-xs text-slate-500">Select the affected location on the map, then complete the report.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-canvas-grey text-slate-600 hover:bg-canvas-light"
            aria-label="Close submit report"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 flex overflow-hidden">
          <div className="relative min-h-0 flex-1">
            <div className="absolute top-4 left-4 z-[1000] max-w-xs rounded-lg border border-canvas-grey bg-white/95 p-4 shadow-lg">
              <div className="text-sm font-semibold text-slate-900">Choose report location</div>
              <div className="text-xs text-slate-600 mt-1">
                Click the flooded location on the map to open the report form.
              </div>
            </div>
            <PublicMap
              onLocationSelect={onLocationSelect}
              selectedLocation={selectedLocation}
            />
          </div>

          <ReportModal
            isOpen={isReportModalOpen}
            onClose={onReportModalClose}
            selectedLocation={selectedLocation}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}

function ReportDetails({ report }: { report: Report }) {
  const status = STATUS_META[report.status];
  const address =
    report.location.address ||
    `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`;

  return (
    <aside className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
      <div className="p-5 border-b border-canvas-grey">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Report Details</h3>
            <p className="text-sm text-slate-500 mt-1 break-all">{report.id}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="aspect-video rounded-lg bg-canvas-light border border-canvas-grey flex items-center justify-center">
          <div className="text-center">
            <FileImage className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-500 mt-2">No photo submitted</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Location" value={address} />
          <DetailItem label="Depth" value={DEPTH_LABELS[report.depth.code]} />
          <DetailItem label="Status" value={status.label} />
          <DetailItem label="Coordinates" value={`${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`} />
          <DetailItem label="Submitted" value={formatDateTime(report.createdAt)} />
          <DetailItem label="Observed" value={formatDateTime(report.observedAt)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            title="Status updates are not available yet"
            className="rounded-lg bg-gakit-maroon px-4 py-3 text-sm font-semibold text-white hover:bg-maroon-800"
          >
            Verify
          </button>
          <button
            title="Status updates are not available yet"
            className="rounded-lg border border-canvas-grey px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
          >
            Escalate
          </button>
        </div>
      </div>
    </aside>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="font-medium text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function ReportsPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="border-t border-canvas-grey px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-500">
        Showing {startItem}-{endItem} of {totalItems} reports
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-2 rounded-lg border border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2 text-sm font-semibold text-slate-700">
          Page {currentPage} of {totalPages}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-2 rounded-lg border border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
