'use client';

import { useState } from 'react';
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
import { FeaturePageShell } from '../shared/FeaturePageShell';

const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
  ssr: false,
});

type ReportStatus = 'Pending' | 'Verified' | 'Critical' | 'Anomaly';
type ReportDepth = 'Ankle Deep' | 'Knee Deep' | 'Waist Deep' | 'Head Deep' | 'Overhead';

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
  elevation?: number;
}

interface FloodReport {
  id: string;
  location: string;
  barangay: string;
  depth: ReportDepth;
  status: ReportStatus;
  submittedAt: string;
  reporterType: 'Citizen' | 'Sentinel' | 'Staff';
  hasPhoto: boolean;
  coordinates: string;
  validationNote: string;
}

const reports: FloodReport[] = [
  {
    id: 'GAKIT-284190',
    location: 'Hinaplanon Road',
    barangay: 'Hinaplanon',
    depth: 'Waist Deep',
    status: 'Pending',
    submittedAt: 'Today, 10:42 AM',
    reporterType: 'Citizen',
    hasPhoto: true,
    coordinates: '8.2312, 124.2570',
    validationNote: 'Waiting for rainfall and nearby report checks.',
  },
  {
    id: 'GAKIT-284191',
    location: 'Tibanga Bridge',
    barangay: 'Tibanga',
    depth: 'Knee Deep',
    status: 'Verified',
    submittedAt: 'Today, 10:31 AM',
    reporterType: 'Sentinel',
    hasPhoto: true,
    coordinates: '8.2284, 124.2452',
    validationNote: 'Matched nearby reports and expected terrain depression.',
  },
  {
    id: 'GAKIT-284192',
    location: 'San Miguel Crossing',
    barangay: 'San Miguel',
    depth: 'Overhead',
    status: 'Critical',
    submittedAt: 'Today, 10:18 AM',
    reporterType: 'Staff',
    hasPhoto: false,
    coordinates: '8.2241, 124.2518',
    validationNote: 'Critical depth reported by staff. Needs responder visibility.',
  },
  {
    id: 'GAKIT-284193',
    location: 'Pala-o Market',
    barangay: 'Pala-o',
    depth: 'Ankle Deep',
    status: 'Anomaly',
    submittedAt: 'Today, 09:54 AM',
    reporterType: 'Citizen',
    hasPhoto: false,
    coordinates: '8.2298, 124.2389',
    validationNote: 'Terrain and nearby reports do not currently support this claim.',
  },
  {
    id: 'GAKIT-284194',
    location: 'Aguinaldo Street',
    barangay: 'Poblacion',
    depth: 'Head Deep',
    status: 'Pending',
    submittedAt: 'Today, 09:43 AM',
    reporterType: 'Citizen',
    hasPhoto: true,
    coordinates: '8.2269, 124.2417',
    validationNote: 'High severity report awaiting validation queue result.',
  },
];

const statuses: Array<'All' | ReportStatus> = ['All', 'Pending', 'Verified', 'Critical', 'Anomaly'];
const depths: Array<'All' | ReportDepth> = ['All', 'Ankle Deep', 'Knee Deep', 'Waist Deep', 'Head Deep', 'Overhead'];
const REPORTS_PER_PAGE = 4;

const statusStyles: Record<ReportStatus, string> = {
  Pending: 'bg-amber-50 text-hazard-pending border-amber-200',
  Verified: 'bg-green-50 text-hazard-safe border-green-200',
  Critical: 'bg-red-50 text-hazard-critical border-red-200',
  Anomaly: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function ReportsTab() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ReportStatus>('All');
  const [depthFilter, setDepthFilter] = useState<'All' | ReportDepth>('All');
  const [selectedReportId, setSelectedReportId] = useState(reports[0].id);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredReports = reports.filter((report) => {
    const matchesQuery = `${report.id} ${report.location} ${report.barangay}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'All' || report.status === statusFilter;
    const matchesDepth = depthFilter === 'All' || report.depth === depthFilter;

    return matchesQuery && matchesStatus && matchesDepth;
  });

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) || filteredReports[0] || reports[0];
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedReports = filteredReports.slice(
    (safeCurrentPage - 1) * REPORTS_PER_PAGE,
    safeCurrentPage * REPORTS_PER_PAGE
  );

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
  }) => {
    console.log('Staff report submitted:', data);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 800);
    });
    setIsReportModalOpen(false);
    setIsSubmitOpen(false);
    setSelectedLocation(null);
  };

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
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>

          <select
            value={depthFilter}
            onChange={(event) => {
              setDepthFilter(event.target.value as 'All' | ReportDepth);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            {depths.map((depth) => (
              <option key={depth}>{depth}</option>
            ))}
          </select>

          <button className="flex items-center justify-center gap-2 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light">
            <CalendarDays className="w-4 h-4" />
            Today
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
                <p className="text-sm text-slate-500">{filteredReports.length} reports shown</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Filter className="w-4 h-4" />
                Live filters
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
                  {paginatedReports.map((report) => (
                    <tr
                      key={report.id}
                      className={selectedReport.id === report.id ? 'bg-maroon-50/60' : 'hover:bg-canvas-light/70'}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{report.id}</div>
                        <div className="text-xs text-slate-500">{report.reporterType}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-700">{report.location}</div>
                        <div className="text-xs text-slate-500">{report.barangay}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{report.depth}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[report.status]}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{report.submittedAt}</td>
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
              {paginatedReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className="w-full p-4 text-left hover:bg-canvas-light"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{report.id}</div>
                      <div className="text-sm text-slate-600 mt-1">{report.location}</div>
                      <div className="text-xs text-slate-500 mt-1">{report.submittedAt}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[report.status]}`}>
                      {report.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <ReportsPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filteredReports.length}
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

function ReportDetails({ report }: { report: FloodReport }) {
  return (
    <aside className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
      <div className="p-5 border-b border-canvas-grey">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Report Details</h3>
            <p className="text-sm text-slate-500 mt-1">{report.id}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[report.status]}`}>
            {report.status}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="aspect-video rounded-lg bg-canvas-light border border-canvas-grey flex items-center justify-center">
          {report.hasPhoto ? (
            <div className="text-center">
              <FileImage className="w-8 h-8 text-gakit-maroon mx-auto" />
              <div className="text-sm font-semibold text-slate-700 mt-2">Photo attached</div>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-500">No photo submitted</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Location" value={report.location} />
          <DetailItem label="Barangay" value={report.barangay} />
          <DetailItem label="Depth" value={report.depth} />
          <DetailItem label="Reporter" value={report.reporterType} />
          <DetailItem label="Coordinates" value={report.coordinates} />
          <DetailItem label="Submitted" value={report.submittedAt} />
        </div>

        {/* <div className="rounded-lg bg-canvas-light border border-canvas-grey p-4">
          <div className="text-sm font-semibold text-slate-900">Validation note</div>
          <p className="text-sm text-slate-600 mt-2">{report.validationNote}</p>
        </div> */}

        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-lg bg-gakit-maroon px-4 py-3 text-sm font-semibold text-white hover:bg-maroon-800">
            Verify
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
