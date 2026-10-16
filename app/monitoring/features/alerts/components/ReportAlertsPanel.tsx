'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldAlert,
  ArrowDownAZ,
  ArrowDownWideNarrow,
} from 'lucide-react';
import { FilterDropdown, type FilterDropdownOption } from '@/components/ui/FilterDropdown';
import { DEPTH_LABELS } from '@/lib/reports/reportFormatting';
import type { Notification } from '@/lib/notifications';
import type { FloodDepthCode } from '@/types/report';
import {
  filterByDateRange,
  filterByDepth,
  filterReportsByType,
  sortNotifications,
  type AlertsView,
  type DateRange,
  type ReportTypeFilter,
  type SortColumn,
  type SortDirection,
} from '@/lib/notifications/filters';
import { AlertsPanel } from './AlertsPanel';
import { FilterChips, type ChipOption } from './FilterChips';
import { EmptyNotifications } from './EmptyNotifications';

const REPORT_TYPE_CHIPS: readonly ChipOption<ReportTypeFilter>[] = [
  { value: 'all', label: 'All', icon: BellRing },
  { value: 'new-report', label: 'New', icon: BellRing },
  { value: 'needs-review', label: 'Needs review', icon: ShieldAlert },
  { value: 'flagged', label: 'Flagged', icon: AlertTriangle },
  { value: 'rejected', label: 'Rejected', icon: CheckCircle2 },
];

const DATE_OPTIONS: FilterDropdownOption<DateRange>[] = [
  { value: '24h', label: 'Last 24 hours', icon: <Clock className="h-4 w-4 shrink-0" /> },
  { value: '7d', label: 'Last 7 days', icon: <Clock className="h-4 w-4 shrink-0" /> },
  { value: 'all', label: 'All time', icon: <Clock className="h-4 w-4 shrink-0" /> },
];

const DEPTH_CODES: FloodDepthCode[] = [
  'overhead',
  'head',
  'shoulder',
  'waist',
  'knee',
  'ankle',
];

const DEPTH_OPTIONS: FilterDropdownOption<FloodDepthCode | 'all'>[] = [
  { value: 'all', label: 'Any depth' },
  ...DEPTH_CODES.map((code) => ({ value: code, label: DEPTH_LABELS[code] })),
];

type ReportSortValue = `${SortColumn}:${SortDirection}`;

const SORT_OPTIONS: FilterDropdownOption<ReportSortValue>[] = [
  { value: 'sentAt:desc', label: 'Newest first', icon: <ArrowDownWideNarrow className="h-4 w-4 shrink-0" /> },
  { value: 'sentAt:asc', label: 'Oldest first', icon: <ArrowDownWideNarrow className="h-4 w-4 shrink-0 rotate-180" /> },
  { value: 'severity:desc', label: 'Severity (high to low)', icon: <ArrowDownWideNarrow className="h-4 w-4 shrink-0" /> },
  { value: 'location:asc', label: 'Location (A–Z)', icon: <ArrowDownAZ className="h-4 w-4 shrink-0" /> },
  { value: 'depth:asc', label: 'Depth (shallow to deep)', icon: <ArrowDownWideNarrow className="h-4 w-4 shrink-0" /> },
];

function parseSort(value: ReportSortValue): { column: SortColumn; direction: SortDirection } {
  const [column, direction] = value.split(':') as [SortColumn, SortDirection];
  return { column, direction };
}

/**
 * Right-hand column: flood report notifications with their own type, depth,
 * date, and sort filters.
 */
export function ReportAlertsPanel({
  notifications,
  readIds,
  view,
  loading,
  error,
  highlightedId,
  onMarkRead,
  onDismiss,
  onRestore,
  onDismissRequest,
  onOpenReports,
  onMarkAllRead,
}: {
  notifications: Notification[];
  readIds: string[];
  view: AlertsView;
  loading: boolean;
  error: string | null;
  highlightedId: string | null;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  onDismissRequest: (id: string) => void;
  onOpenReports: (reportId?: string) => void;
  onMarkAllRead?: (ids: string[]) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>('all');
  const [depthFilter, setDepthFilter] = useState<FloodDepthCode | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateRange>('24h');
  const [sortValue, setSortValue] = useState<ReportSortValue>('sentAt:desc');
  const sort = useMemo(() => parseSort(sortValue), [sortValue]);

  const filtered = useMemo(() => {
    const byType = filterReportsByType(notifications, typeFilter);
    const byDepth = filterByDepth(byType, depthFilter);
    const byDate = filterByDateRange(byDepth, dateFilter);
    return sortNotifications(byDate, sort.column, sort.direction);
  }, [dateFilter, depthFilter, notifications, sort, typeFilter]);

  const resetKey = `${typeFilter}|${depthFilter}|${dateFilter}|${sortValue}`;

  return (
    <AlertsPanel
      section="report"
      title="Report alerts"
      icon={MapPin}
      view={view}
      notifications={filtered}
      readIds={readIds}
      loading={loading}
      error={error}
      highlightedId={highlightedId}
      resetKey={resetKey}
      onMarkRead={onMarkRead}
      onDismiss={onDismiss}
      onRestore={onRestore}
      onDismissRequest={onDismissRequest}
      onOpenReports={onOpenReports}
      onMarkAllRead={onMarkAllRead}
      emptyState={
        <EmptyNotifications
          title={view === 'archived' ? 'Nothing archived yet' : 'No matching report alerts'}
          description={
            view === 'archived'
              ? 'Dismissed report alerts and ones read for over a week appear here.'
              : 'Try another status, depth, or date filter.'
          }
        />
      }
      filterBar={
        <div className="space-y-2">
          <FilterChips
            ariaLabel="Filter report alerts by status"
            options={REPORT_TYPE_CHIPS}
            value={typeFilter}
            onSelect={setTypeFilter}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <FilterDropdown
              value={depthFilter}
              onSelect={setDepthFilter}
              options={DEPTH_OPTIONS}
              triggerIcon={<ArrowDownWideNarrow className="h-4 w-4" />}
              triggerLabel={DEPTH_OPTIONS.find((o) => o.value === depthFilter)?.label ?? 'Any depth'}
              size="sm"
            />
            <FilterDropdown
              value={dateFilter}
              onSelect={setDateFilter}
              options={DATE_OPTIONS}
              triggerIcon={<Clock className="h-4 w-4" />}
              triggerLabel={DATE_OPTIONS.find((o) => o.value === dateFilter)?.label ?? 'All time'}
              size="sm"
            />
            <FilterDropdown
              value={sortValue}
              onSelect={setSortValue}
              options={SORT_OPTIONS}
              triggerIcon={<ArrowDownWideNarrow className="h-4 w-4" />}
              triggerLabel={SORT_OPTIONS.find((o) => o.value === sortValue)?.label ?? 'Newest first'}
              size="sm"
            />
          </div>
        </div>
      }
    />
  );
}
