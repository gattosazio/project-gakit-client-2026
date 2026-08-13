'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Info,
  Loader2,
  PlusCircle,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
  XCircle,
  type LucideIcon,
  Ruler,
} from 'lucide-react';
import { ReportModal } from '@/app/public-view/ReportModal';
import { DEPTH_LABELS, STATUS_META, formatDateTime } from '@/lib/reportFormatting';
import type { PublicMapHandle } from '@/components/PublicMap';
import type { FloodDepthCode, Report, ReportStatus } from '@/types/report';
import { toast } from 'react-toastify';
import { FeaturePageShell } from '../shared/FeaturePageShell';
import { createClient } from '@/lib/supabase/client';
import { createReport, listReports as fetchReports, updateReportStatus } from './actions/reports';
import { ReportDetail } from './ReportDetail';

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

const depthOptions: Array<'All' | FloodDepthCode> = ['All', 'ankle', 'knee', 'waist', 'head', 'overhead'];
const timeRangeOptions: Array<{ value: string; label: string; hours: number | null }> = [
  { value: '24h', label: 'Last 24 hours', hours: 24 },
  { value: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { value: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { value: 'all', label: 'All time', hours: null },
];
const STATUS_ICONS: Record<ReportStatus, LucideIcon> = {
  UNVERIFIED: Clock,
  VERIFIED: CheckCircle2,
  ANOMALY: AlertTriangle,
  REJECTED: XCircle,
};
const REPORTS_PER_PAGE = 6;

export function ReportsTab({ initialCritical = false }: { initialCritical?: boolean }) {
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
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      const selectedRange = timeRangeOptions.find((option) => option.value === timeFilter);
      const since =
        selectedRange && selectedRange.hours != null
          ? new Date(Date.now() - selectedRange.hours * 3600 * 1000).toISOString()
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
          setReports(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages);
          setSelectedReportId((currentId) =>
            currentId && result.items.some((report) => report.id === currentId)
              ? currentId
              : null
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
  }, [currentPage, query, statusFilter, depthFilter, timeFilter, criticalFilter, refreshKey]);

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
            <div className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
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
                        return (
                          <tr
                            key={report.id}
                            className={selectedReport?.id === report.id ? 'bg-maroon-100/80' : 'hover:bg-canvas-light/70'}
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
                    return (
                      <div key={report.id} className="flex items-start gap-2 p-4 hover:bg-canvas-light">
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
          <div className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-canvas-grey flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Map</h3>
                <p className="text-sm text-slate-500">
                  Click Inspect on a report to zoom to its pinned location on the map.
                </p>
              </div>
            </div>

            <div className="h-[20rem] md:h-[26rem] relative">
              <PublicMap
                mapApiRef={mapRef}
                onLocationSelect={handleNoopLocationSelect}
                selectedLocation={null}
                hideShareLocation
                hideAttribution
              />
            </div>

            <div className="border-t border-canvas-grey px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">Live map of reports</div>
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

interface FilterDropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

function FilterDropdown<T extends string>({
  value,
  onSelect,
  options,
  triggerLabel,
  triggerIcon,
}: {
  value: T;
  onSelect: (value: T) => void;
  options: FilterDropdownOption<T>[];
  triggerLabel: string;
  triggerIcon: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 192;
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-canvas-light"
      >
        <span className="flex items-center gap-2">
          {triggerIcon}
          {triggerLabel}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 192 }}
            className="z-[1400] overflow-hidden rounded-lg border border-canvas-grey bg-white py-1 shadow-lg"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-canvas-light ${index > 0 ? 'border-t border-canvas-grey' : ''} ${isSelected ? 'bg-canvas-light text-gakit-maroon' : 'text-slate-700'}`}
                >
                  {option.icon}
                  <span className="flex-1 text-left">{option.label}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0 text-gakit-maroon" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

function StatusFilterDropdown({
  value,
  onChange,
}: {
  value: 'All' | ReportStatus;
  onChange: (value: 'All' | ReportStatus) => void;
}) {
  const options: FilterDropdownOption<'All' | ReportStatus>[] = [
    { value: 'All', label: 'All statuses', icon: <Filter className="w-4 h-4 shrink-0" /> },
    ...(['UNVERIFIED', 'VERIFIED', 'ANOMALY', 'REJECTED'] as ReportStatus[]).map((status) => {
      const Icon = STATUS_ICONS[status];
      return {
        value: status,
        label: STATUS_META[status].label,
        icon: <Icon className="w-4 h-4 shrink-0" style={{ color: STATUS_META[status].color }} />,
      };
    }),
  ];
  const SelectedIcon = value === 'All' ? Filter : STATUS_ICONS[value];

  return (
    <FilterDropdown
      value={value}
      onSelect={onChange}
      options={options}
      triggerIcon={
        <SelectedIcon
          className="w-4 h-4"
          style={value !== 'All' ? { color: STATUS_META[value].color } : undefined}
        />
      }
      triggerLabel={value === 'All' ? 'All statuses' : STATUS_META[value].label}
    />
  );
}

function DepthsFilterDropdown({
  value,
  onChange,
}: {
  value: 'All' | FloodDepthCode;
  onChange: (value: 'All' | FloodDepthCode) => void;
}) {
  const options: FilterDropdownOption<'All' | FloodDepthCode>[] = depthOptions.map((depth) => ({
    value: depth,
    label: depth === 'All' ? 'All depths' : DEPTH_LABELS[depth],
    icon: depth === 'All' ? <Ruler className="w-4 h-4 shrink-0" /> : undefined,
  }));

  return (
    <FilterDropdown
      value={value}
      onSelect={onChange}
      options={options}
      triggerIcon={<Ruler className="w-4 h-4" />}
      triggerLabel={value === 'All' ? 'All depths' : DEPTH_LABELS[value]}
    />
  );
}

function TimeFilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const options: FilterDropdownOption<string>[] = timeRangeOptions.map((option) => ({
    value: option.value,
    label: option.label,
    icon: <Clock className="w-4 h-4 shrink-0" />,
  }));

  return (
    <FilterDropdown
      value={value}
      onSelect={onChange}
      options={options}
      triggerIcon={<Clock className="w-4 h-4" />}
      triggerLabel={value === 'all' ? 'All time' : value}
    />
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
    depth: FloodDepthCode;
  }) => Promise<void>;
}) {
  const mapRef = useRef<PublicMapHandle | null>(null);

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
              mapApiRef={mapRef}
              onLocationSelect={onLocationSelect}
              selectedLocation={selectedLocation}
            />
          </div>

          <ReportModal
            isOpen={isReportModalOpen}
            onClose={onReportModalClose}
            selectedLocation={selectedLocation}
            onSubmit={onSubmit}
            onCheckLocation={(location) =>
              mapRef.current?.checkLocation(location) ??
              Promise.resolve({ hazardLevel: null, precipMm: null })
            }
          />
        </div>
      </div>
    </div>
  );
}

function ReportActions({
  report,
  isUpdating,
  onInspect,
  onViewDetails,
  onUpdateStatus,
  showInspect = true,
}: {
  report: Report;
  isUpdating: boolean;
  onInspect: () => void;
  onViewDetails: () => void;
  onUpdateStatus: (report: Report, toStatus: ReportStatus) => void;
  showInspect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const options: Array<{
    status: ReportStatus;
    label: string;
    className: string;
    icon: typeof CheckCircle2;
  }> = [
    { status: 'VERIFIED', label: 'Verify', className: 'text-hazard-safe', icon: CheckCircle2 },
    { status: 'ANOMALY', label: 'Flag for review', className: 'text-hazard-critical', icon: AlertTriangle },
    { status: 'REJECTED', label: 'Reject', className: 'text-slate-600', icon: XCircle },
  ];
  const StatusIcon = STATUS_ICONS[report.status];

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 176;
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      });
    }
    setOpen(true);
  };

  return (
    <div className="flex items-center gap-2">
      {showInspect && (
        <button
          onClick={onInspect}
          aria-label="Inspect report on map"
          title="View on map"
          className="inline-flex items-center justify-center rounded-lg border border-canvas-grey p-2 text-slate-700 hover:border-gakit-maroon hover:text-gakit-maroon"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={onViewDetails}
        aria-label="View report details"
        title="View details"
        className="inline-flex items-center justify-center rounded-lg border border-canvas-grey p-2 text-slate-700 hover:border-gakit-maroon hover:text-gakit-maroon"
      >
        <Info className="h-4 w-4" />
      </button>
      <div>
        <button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          disabled={isUpdating}
          aria-label={`Update status for report ${report.id.slice(0, 8)}`}
          title="Update status"
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-0.5 rounded-lg border border-canvas-grey px-2 py-2 text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon disabled:opacity-50"
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <StatusIcon className="h-4 w-4" style={{ color: STATUS_META[report.status].color }} />
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </>
          )}
        </button>

        {open &&
          createPortal(
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-[1300] cursor-default"
                onClick={() => setOpen(false)}
              />
              <div
                role="menu"
                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 176 }}
                className="z-[1400] overflow-hidden rounded-lg border border-canvas-grey bg-white shadow-lg"
              >
                {options.map((option, index) => {
                  const isCurrent = report.status === option.status;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.status}
                      role="menuitem"
                      disabled={isCurrent}
                      onClick={() => {
                        if (option.status === 'REJECTED' && !window.confirm('Reject this report?')) return;
                        setOpen(false);
                        onUpdateStatus(report, option.status);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-50 ${index > 0 ? 'border-t border-canvas-grey' : ''} ${option.className}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{option.label}</span>
                      {isCurrent && <span className="text-xs font-medium text-slate-400">Current</span>}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body
          )}
      </div>
    </div>
  );
}

function StatusActionMenu({
  report,
  isUpdating,
  onUpdateStatus,
}: {
  report: Report;
  isUpdating: boolean;
  onUpdateStatus: (report: Report, toStatus: ReportStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number; width: number }>({
    bottom: 0,
    left: 0,
    width: 0,
  });
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const options: Array<{
    status: ReportStatus;
    label: string;
    className: string;
    icon: typeof CheckCircle2;
  }> = [
    {
      status: 'VERIFIED',
      label: 'Verify',
      className: 'text-hazard-safe',
      icon: CheckCircle2,
    },
    {
      status: 'ANOMALY',
      label: 'Mark Anomaly',
      className: 'text-hazard-critical',
      icon: AlertTriangle,
    },
    {
      status: 'REJECTED',
      label: 'Reject',
      className: 'text-slate-600',
      icon: XCircle,
    },
  ];

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        disabled={isUpdating}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 py-3 text-sm font-semibold text-white hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUpdating ? 'Updating…' : 'Update Status'}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="fixed inset-0 z-[1300] cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              style={{
                position: 'fixed',
                top: 'auto',
                bottom: menuPos.bottom,
                left: menuPos.left,
                width: menuPos.width,
              }}
              className="z-[1400] overflow-hidden rounded-lg border border-canvas-grey bg-white shadow-lg"
            >
              {options.map((option, index) => {
                const isCurrent = report.status === option.status;
                const Icon = option.icon;
                return (
                  <button
                    key={option.status}
                    role="menuitem"
                    disabled={isCurrent}
                    onClick={() => {
                      setOpen(false);
                      onUpdateStatus(report, option.status);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-50 ${index > 0 ? 'border-t border-canvas-grey' : ''} ${option.className}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{option.label}</span>
                    {isCurrent && (
                      <span className="text-xs font-medium text-slate-400">Current</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </>
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
