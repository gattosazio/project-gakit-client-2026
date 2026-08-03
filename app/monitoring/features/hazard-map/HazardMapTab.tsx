'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Filter,
  Layers,
  MapPinned,
  RotateCcw,
  Search,
} from 'lucide-react';
import { FeaturePageShell } from '../shared/FeaturePageShell';
import type { OperationalMapReport, OperationalReportStatus } from './OperationalHazardMap';

const OperationalHazardMap = dynamic(
  () => import('./OperationalHazardMap').then((mod) => ({ default: mod.OperationalHazardMap })),
  {
    loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
    ssr: false,
  }
);

const reports: OperationalMapReport[] = [
  {
    id: 'GAKIT-284190',
    lat: 8.2312,
    lng: 124.2570,
    location: 'Hinaplanon Road',
    barangay: 'Hinaplanon',
    depth: 'Waist Deep',
    status: 'Pending',
    submittedAt: 'Today, 10:42 AM',
  },
  {
    id: 'GAKIT-284191',
    lat: 8.2284,
    lng: 124.2452,
    location: 'Tibanga Bridge',
    barangay: 'Tibanga',
    depth: 'Knee Deep',
    status: 'Verified',
    submittedAt: 'Today, 10:31 AM',
  },
  {
    id: 'GAKIT-284192',
    lat: 8.2241,
    lng: 124.2518,
    location: 'San Miguel Crossing',
    barangay: 'San Miguel',
    depth: 'Overhead',
    status: 'Critical',
    submittedAt: 'Today, 10:18 AM',
  },
  {
    id: 'GAKIT-284193',
    lat: 8.2298,
    lng: 124.2389,
    location: 'Pala-o Market',
    barangay: 'Pala-o',
    depth: 'Ankle Deep',
    status: 'Anomaly',
    submittedAt: 'Today, 09:54 AM',
  },
  {
    id: 'GAKIT-284194',
    lat: 8.2269,
    lng: 124.2417,
    location: 'Aguinaldo Street',
    barangay: 'Poblacion',
    depth: 'Head Deep',
    status: 'Pending',
    submittedAt: 'Today, 09:43 AM',
  },
];

const statuses: Array<'All' | OperationalReportStatus> = ['Pending', 'Anomaly', 'Verified', 'Critical', 'All'];
const depths = ['All', 'Ankle Deep', 'Knee Deep', 'Waist Deep', 'Head Deep', 'Overhead'];
const barangays = ['All', 'Hinaplanon', 'Tibanga', 'San Miguel', 'Pala-o', 'Poblacion'];

const statusStyles: Record<OperationalReportStatus, string> = {
  Pending: 'bg-amber-50 text-hazard-pending border-amber-200',
  Verified: 'bg-green-50 text-hazard-safe border-green-200',
  Critical: 'bg-red-50 text-hazard-critical border-red-200',
  Anomaly: 'bg-slate-100 text-slate-700 border-slate-200',
};

const legendItems: Array<{ label: OperationalReportStatus; color: string }> = [
  { label: 'Pending', color: 'bg-hazard-pending' },
  { label: 'Verified', color: 'bg-hazard-safe' },
  { label: 'Critical', color: 'bg-hazard-critical' },
  { label: 'Anomaly', color: 'bg-slate-500' },
];

export function HazardMapTab() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | OperationalReportStatus>('All');
  const [depthFilter, setDepthFilter] = useState('All');
  const [barangayFilter, setBarangayFilter] = useState('All');
  const [selectedReportId, setSelectedReportId] = useState(reports[0].id);

  const filteredReports = reports.filter((report) => {
    const matchesQuery = `${report.id} ${report.location} ${report.barangay}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'All' || report.status === statusFilter;
    const matchesDepth = depthFilter === 'All' || report.depth === depthFilter;
    const matchesBarangay = barangayFilter === 'All' || report.barangay === barangayFilter;

    return matchesQuery && matchesStatus && matchesDepth && matchesBarangay;
  });

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) || filteredReports[0] || reports[0];

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('All');
    setDepthFilter('All');
    setBarangayFilter('All');
  };

  const reportCounts = {
    all: reports.length,
    pending: reports.filter((report) => report.status === 'Pending').length,
    verified: reports.filter((report) => report.status === 'Verified').length,
    critical: reports.filter((report) => report.status === 'Critical').length,
  };

  return (
    <FeaturePageShell
      toolbar={
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_10rem_auto]">
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
            {depths.map((depth) => (
              <option key={depth}>{depth}</option>
            ))}
          </select>

          <select
            value={barangayFilter}
            onChange={(event) => setBarangayFilter(event.target.value)}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            {barangays.map((barangay) => (
              <option key={barangay}>{barangay}</option>
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
            <OperationalHazardMap
              reports={filteredReports}
              selectedReportId={selectedReport.id}
              onSelectReport={setSelectedReportId}
            />
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
                <div className="grid grid-cols-5 gap-2">
                  <SummaryCount label="All" value={reportCounts.all} color="text-gakit-maroon" />
                  <SummaryCount label="Pending" value={reportCounts.pending} color="text-hazard-pending" />
                  <SummaryCount label="Verified" value={reportCounts.verified} color="text-hazard-safe" />
                  <SummaryCount label="Critical" value={reportCounts.critical} color="text-hazard-critical" />
                  <SummaryCount label="Anomaly" value={reports.filter((report) => report.status === 'Anomaly').length} color="text-slate-600" />
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

        <MapReportDetails report={selectedReport} />
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
            <p className="text-sm text-slate-500 mt-1">{report.id}</p>
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
          <div className="text-sm text-slate-600 mt-2">{report.barangay}</div>
          <div className="text-xs text-slate-500 mt-1">
            {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Depth" value={report.depth} />
          <DetailItem label="Submitted" value={report.submittedAt} />
          <DetailItem label="Status" value={report.status} />
          <DetailItem label="Barangay" value={report.barangay} />
        </div>

        <div className="rounded-lg border border-canvas-grey p-4">
          <div className="text-sm font-semibold text-slate-900">Operational note</div>
          <p className="text-sm text-slate-600 mt-2">
            Prioritize this marker based on status, depth, and nearby cluster pattern.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-lg bg-gakit-maroon px-4 py-3 text-sm font-semibold text-white hover:bg-maroon-800">
            Inspect
          </button>
          <button className="rounded-lg border border-canvas-grey px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-canvas-light">
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
