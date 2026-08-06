'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Filter,
  Layers,
  MapPinned,
  RotateCcw,
  Search,
} from 'lucide-react';
import { fetchReports, type Report } from '@/lib/api';
import { DEPTH_LABELS, STATUS_META } from '@/lib/reportFormatting';
import { FeaturePageShell } from '../shared/FeaturePageShell';
import type { OperationalMapReport, OperationalReportStatus } from './OperationalHazardMap';

const OperationalHazardMap = dynamic(
  () => import('./OperationalHazardMap').then((mod) => ({ default: mod.OperationalHazardMap })),
  {
    loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
    ssr: false,
  }
);

const statuses: Array<'All' | OperationalReportStatus> = ['All', 'Pending', 'Verified', 'Anomaly', 'Rejected'];
const depthLabels = ['All', ...Object.values(DEPTH_LABELS)];

const statusStyles: Record<OperationalReportStatus, string> = {
  Pending: 'bg-amber-50 text-hazard-pending border-amber-200',
  Verified: 'bg-green-50 text-hazard-safe border-green-200',
  Anomaly: 'bg-slate-100 text-slate-700 border-slate-200',
  Rejected: 'bg-slate-100 text-slate-600 border-slate-200',
};

const legendItems: Array<{ label: OperationalReportStatus; color: string }> = [
  { label: 'Pending', color: 'bg-hazard-pending' },
  { label: 'Verified', color: 'bg-hazard-safe' },
  { label: 'Anomaly', color: 'bg-slate-500' },
  { label: 'Rejected', color: 'bg-slate-400' },
];

function toOperationalReport(report: Report): OperationalMapReport {
  return {
    id: report.id,
    lat: report.location.latitude,
    lng: report.location.longitude,
    location: report.location.address || 'Unknown location',
    barangay: '',
    depth: DEPTH_LABELS[report.depth.code],
    status: STATUS_META[report.status].label as OperationalReportStatus,
    submittedAt: new Date(report.createdAt).toLocaleString(),
  };
}

export function HazardMapTab() {
  const [reports, setReports] = useState<OperationalMapReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | OperationalReportStatus>('All');
  const [depthFilter, setDepthFilter] = useState('All');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchReports({ limit: 100 })
      .then((result) => {
        if (cancelled) return;
        const mapped = result.items.map(toOperationalReport);
        setReports(mapped);
        setSelectedReportId((currentId) =>
          currentId && mapped.some((report) => report.id === currentId)
            ? currentId
            : (mapped[0]?.id ?? null)
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load reports');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredReports = reports.filter((report) => {
    const matchesQuery = `${report.id} ${report.location} ${report.barangay}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'All' || report.status === statusFilter;
    const matchesDepth = depthFilter === 'All' || report.depth === depthFilter;

    return matchesQuery && matchesStatus && matchesDepth;
  });

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) || filteredReports[0] || reports[0] || null;

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('All');
    setDepthFilter('All');
  };

  const reportCounts = {
    all: reports.length,
    pending: reports.filter((report) => report.status === 'Pending').length,
    verified: reports.filter((report) => report.status === 'Verified').length,
    anomaly: reports.filter((report) => report.status === 'Anomaly').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-canvas-grey bg-white p-10 shadow-sm text-sm text-slate-500">
        Loading hazard map data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Could not load hazard map data: {error}
      </div>
    );
  }

  return (
    <FeaturePageShell
      toolbar={
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search location, barangay, or report ID"
              className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
            />
          </label>

          <select
            value={depthFilter}
            onChange={(event) => setDepthFilter(event.target.value)}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            {depthLabels.map((depth) => (
              <option key={depth}>{depth}</option>
            ))}
          </select>

          <button className="flex items-center justify-center gap-2 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light">
            <Layers className="w-4 h-4" />
            Layers
          </button>

          <button
            onClick={resetFilters}
            className="flex items-center justify-center gap-2 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      }
    >
      <section className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_24rem] gap-4">
        <div className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
          <div className="h-[34rem] relative">
            {selectedReport && (
              <OperationalHazardMap
                reports={filteredReports}
                selectedReportId={selectedReport.id}
                onSelectReport={setSelectedReportId}
              />
            )}
            <div className="absolute bottom-4 left-4 z-[1000] flex max-w-[calc(100%-2rem)] flex-col gap-3 rounded-lg border border-canvas-grey bg-white/95 p-3 shadow-lg xl:flex-row">
              <div>
                <div className="text-xs font-bold text-slate-900 mb-2">Legend</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {legendItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className={`w-3 h-3 rounded-full ${item.color}`} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-canvas-grey pt-3 xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0">
                <div className="text-xs font-bold text-slate-900 mb-2">Summary</div>
                <div className="grid grid-cols-4 gap-2">
                  <SummaryCount label="All" value={reportCounts.all} color="text-gakit-maroon" />
                  <SummaryCount label="Pending" value={reportCounts.pending} color="text-hazard-pending" />
                  <SummaryCount label="Verified" value={reportCounts.verified} color="text-hazard-safe" />
                  <SummaryCount label="Anomaly" value={reportCounts.anomaly} color="text-slate-600" />
                </div>
              </div>

              <div className="border-t border-canvas-grey pt-3 xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0">
                <div className="text-xs font-bold text-slate-900 mb-2">Map Filter</div>
                <div className="grid grid-cols-3 gap-2">
                  {statuses.map((status) => (
                    <StatusFilterButton
                      key={status}
                      status={status}
                      isActive={statusFilter === status}
                      onClick={() => setStatusFilter(status)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-canvas-grey p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Filter className="w-4 h-4 text-gakit-maroon" />
              Showing {filteredReports.length} of {reports.length} mapped reports
            </div>
            <div className="text-xs text-slate-500">
              Click a marker to inspect the selected report.
            </div>
          </div>
        </div>

        {selectedReport ? (
          <MapReportDetails report={selectedReport} />
        ) : (
          <aside className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
            <div className="p-5 text-sm text-slate-500">No reports available.</div>
          </aside>
        )}
      </section>
    </FeaturePageShell>
  );
}

function MapReportDetails({ report }: { report: OperationalMapReport }) {
  return (
    <aside className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
      <div className="p-5 border-b border-canvas-grey">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Selected Report</h3>
            <p className="text-sm text-slate-500 mt-1 break-all">{report.id}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[report.status]}`}>
            {report.status}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="rounded-lg bg-canvas-light border border-canvas-grey p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MapPinned className="w-4 h-4 text-gakit-maroon" />
            {report.location}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Depth" value={report.depth} />
          <DetailItem label="Submitted" value={report.submittedAt} />
          <DetailItem label="Status" value={report.status} />
        </div>

        <div className="rounded-lg border border-canvas-grey p-4">
          <div className="text-sm font-semibold text-slate-900">Operational note</div>
          <p className="text-sm text-slate-600 mt-2">
            Prioritize this marker based on status, depth, and nearby cluster pattern.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            title="Status updates are not available yet"
            className="rounded-lg bg-gakit-maroon px-4 py-3 text-sm font-semibold text-white hover:bg-maroon-800"
          >
            Inspect
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

function SummaryCount({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="min-w-12 rounded-md border border-canvas-grey bg-canvas-light px-2 py-1">
      <div className="text-[10px] font-semibold text-slate-500">{label}</div>
      <div className={`text-base font-bold leading-tight ${color}`}>{value}</div>
    </div>
  );
}

function StatusFilterButton({
  status,
  isActive,
  onClick,
}: {
  status: 'All' | OperationalReportStatus;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
        isActive
          ? 'border-gakit-maroon bg-maroon-50 text-gakit-maroon'
          : 'border-canvas-grey bg-canvas-light text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon'
      }`}
    >
      {status}
    </button>
  );
}
