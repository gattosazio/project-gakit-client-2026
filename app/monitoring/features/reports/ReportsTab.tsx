'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  PlusCircle,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { ReportModal } from '@/app/public-view/ReportModal';
import {
  createReport,
  listDepthCategories,
} from '@/app/public-view/actions/public.view';
import type {
  FloodDepth,
  FloodDepthCategory,
  ReportRecord,
  ReportStatus,
} from '@/app/public-view/actions/public.view';
import { FeaturePageShell } from '../shared/FeaturePageShell';
import { listReports } from './actions/reports';

const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
  ssr: false,
});

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
}

const statuses: Array<{ value: 'All' | ReportStatus; label: string }> = [
  { value: 'All', label: 'All statuses' },
  { value: 'UNVERIFIED', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'ANOMALY', label: 'Anomaly' },
  { value: 'REJECTED', label: 'Rejected' },
];
const REPORTS_PER_PAGE = 4;

const statusStyles: Record<ReportStatus, string> = {
  UNVERIFIED: 'bg-amber-50 text-hazard-pending border-amber-200',
  VERIFIED: 'bg-green-50 text-hazard-safe border-green-200',
  ANOMALY: 'bg-slate-100 text-slate-700 border-slate-200',
  REJECTED: 'bg-red-50 text-hazard-critical border-red-200',
};

const statusLabels: Record<ReportStatus, string> = {
  UNVERIFIED: 'Pending',
  VERIFIED: 'Verified',
  ANOMALY: 'Anomaly',
  REJECTED: 'Rejected',
};

const formatLocation = (report: ReportRecord) =>
  report.location.address ||
  `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`;

const formatCoordinates = (report: ReportRecord) =>
  `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`;

const formatDepth = (depth: FloodDepthCategory) =>
  depth.code === 'overhead'
    ? `${depth.label} (${depth.approximateCm} cm or deeper)`
    : `${depth.label} (approximately ${depth.approximateCm} cm)`;

const formatDateTime = (value: string) => new Date(value).toLocaleString();

export function ReportsTab() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ReportStatus>('All');
  const [depthFilter, setDepthFilter] = useState<'All' | FloodDepth>('All');
  const [depthCategories, setDepthCategories] = useState<FloodDepthCategory[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const abortController = new AbortController();

    void listDepthCategories(abortController.signal)
      .then(setDepthCategories)
      .catch(() => setDepthCategories([]));

    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    const debounceTimer = window.setTimeout(() => {
      void listReports(
        {
          page: currentPage,
          limit: REPORTS_PER_PAGE,
          search: query.trim() || undefined,
          status: statusFilter === 'All' ? undefined : statusFilter,
          depth: depthFilter === 'All' ? undefined : depthFilter,
        },
        abortController.signal
      )
        .then((result) => {
          setReports(result.items);
          setTotalReports(result.total);
          setTotalPages(result.totalPages);
          setSelectedReportId((currentId) =>
            result.items.some((report) => report.id === currentId)
              ? currentId
              : result.items[0]?.id ?? null
          );
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setReports([]);
          setTotalReports(0);
          setSelectedReportId(null);
          setLoadError(
            error instanceof Error ? error.message : 'Unable to load reports.'
          );
        })
        .finally(() => {
          if (!abortController.signal.aborted) setIsLoading(false);
        });
    }, query.trim() ? 300 : 0);

    return () => {
      window.clearTimeout(debounceTimer);
      abortController.abort();
    };
  }, [currentPage, depthFilter, query, refreshVersion, statusFilter]);

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
    location: { lat: number; lng: number };
    depth: FloodDepth;
  }) => {
    await createReport({
      location: {
        latitude: data.location.lat,
        longitude: data.location.lng,
        address: selectedLocation?.address,
      },
      depth: data.depth,
      observedAt: new Date().toISOString(),
    });
    setIsReportModalOpen(false);
    setIsSubmitOpen(false);
    setSelectedLocation(null);
    setCurrentPage(1);
    setRefreshVersion((version) => version + 1);
  };

  return (
    <>
      <FeaturePageShell
        toolbar={
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_auto_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2">
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

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'All' | ReportStatus);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>

          <select
            value={depthFilter}
            onChange={(event) => {
              setDepthFilter(event.target.value as 'All' | FloodDepth);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            <option value="All">All depths</option>
            {depthCategories.map((depth) => (
              <option key={depth.code} value={depth.code}>{depth.label}</option>
            ))}
          </select>

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
                <p className="text-sm text-slate-500">{totalReports} reports found</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Filter className="w-4 h-4" />
                Server filters
              </div>
            </div>

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
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                        Loading reports...
                      </td>
                    </tr>
                  )}
                  {!isLoading && loadError && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-red-600">
                        {loadError}
                      </td>
                    </tr>
                  )}
                  {!isLoading && !loadError && reports.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                        No reports match the selected filters.
                      </td>
                    </tr>
                  )}
                  {!isLoading && !loadError && reports.map((report) => (
                    <tr
                      key={report.id}
                      className={selectedReport?.id === report.id ? 'bg-maroon-50/60' : 'hover:bg-canvas-light/70'}
                    >
                      <td className="px-5 py-4">
                        <div className="max-w-40 break-all text-xs font-semibold text-slate-900">{report.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-700">{formatLocation(report)}</div>
                        <div className="text-xs text-slate-500">{formatCoordinates(report)}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <div>{report.depth.label}</div>
                        <div className="text-xs text-slate-500">
                          {report.depth.code === 'overhead'
                            ? `${report.depth.approximateCm} cm or deeper`
                            : `Approx. ${report.depth.approximateCm} cm`}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[report.status]}`}>
                          {statusLabels[report.status]}
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
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-canvas-grey">
              {isLoading && (
                <div className="p-8 text-center text-sm text-slate-500">Loading reports...</div>
              )}
              {!isLoading && loadError && (
                <div className="p-8 text-center text-sm text-red-600">{loadError}</div>
              )}
              {!isLoading && !loadError && reports.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  No reports match the selected filters.
                </div>
              )}
              {!isLoading && !loadError && reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className="w-full p-4 text-left hover:bg-canvas-light"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="break-all text-xs font-semibold text-slate-900">{report.id}</div>
                      <div className="text-sm text-slate-600 mt-1">{formatLocation(report)}</div>
                      <div className="text-xs text-slate-500 mt-1">{formatDateTime(report.createdAt)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[report.status]}`}>
                      {statusLabels[report.status]}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <ReportsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalReports}
              pageSize={REPORTS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>

          <ReportDetails report={selectedReport} />
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
    location: { lat: number; lng: number };
    depth: FloodDepth;
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

function ReportDetails({ report }: { report: ReportRecord | null }) {
  if (!report) {
    return (
      <aside className="bg-white border border-canvas-grey rounded-lg shadow-sm p-8 text-center text-sm text-slate-500">
        Select a report to view its details.
      </aside>
    );
  }

  return (
    <aside className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
      <div className="p-5 border-b border-canvas-grey">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Report Details</h3>
            <p className="break-all text-xs text-slate-500 mt-1">{report.id}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[report.status]}`}>
            {statusLabels[report.status]}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Location" value={formatLocation(report)} />
          <DetailItem label="Depth" value={formatDepth(report.depth)} />
          <DetailItem label="Coordinates" value={formatCoordinates(report)} />
          <DetailItem label="Observed" value={formatDateTime(report.observedAt)} />
          <DetailItem label="Submitted" value={formatDateTime(report.createdAt)} />
          <DetailItem label="Status" value={statusLabels[report.status]} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            disabled
            title="Authentication is required before status updates are enabled."
            className="cursor-not-allowed rounded-lg bg-canvas-grey px-4 py-3 text-sm font-semibold text-slate-400"
          >
            Verify
          </button>
          <button
            disabled
            title="Authentication is required before status updates are enabled."
            className="cursor-not-allowed rounded-lg border border-canvas-grey px-4 py-3 text-sm font-semibold text-slate-400"
          >
            Reject
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
