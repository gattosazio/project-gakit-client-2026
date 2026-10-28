'use client';

import { useMemo, useState } from 'react';
import {
  Clock,
  CloudRain,
  Flame,
  AlertTriangle,
  ShieldAlert,
  ArrowDownWideNarrow,
} from 'lucide-react';
import { FilterDropdown, type FilterDropdownOption } from '@/components/ui/FilterDropdown';
import type { Notification, Severity } from '@/lib/notifications';
import {
  filterByDateRange,
  filterBySeverity,
  filterWeatherByAlertType,
  sortNotifications,
  type AlertsView,
  type DateRange,
  type SortColumn,
  type SortDirection,
  type WeatherAlertTypeFilter,
} from '@/lib/notifications/filters';
import { AlertsPanel } from './AlertsPanel';
import { FilterChips, type ChipOption } from './FilterChips';
import { EmptyNotifications } from './EmptyNotifications';

const WEATHER_TYPE_CHIPS: readonly ChipOption<WeatherAlertTypeFilter>[] = [
  { value: 'all', label: 'All', icon: CloudRain },
  { value: 'thunderstorm', label: 'Thunderstorm', icon: AlertTriangle },
  { value: 'heavy_rain', label: 'Heavy rain', icon: CloudRain },
  { value: 'extreme_heat', label: 'Heat', icon: Flame },
];

const SEVERITY_OPTIONS: FilterDropdownOption<Severity | 'all'>[] = [
  { value: 'all', label: 'Any severity' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

const DATE_OPTIONS: FilterDropdownOption<DateRange>[] = [
  { value: '48h', label: 'Last 48 hours', icon: <Clock className="h-4 w-4 shrink-0" /> },
  { value: '7d', label: 'Last 7 days', icon: <Clock className="h-4 w-4 shrink-0" /> },
  { value: 'all', label: 'All time', icon: <Clock className="h-4 w-4 shrink-0" /> },
];

type WeatherSortValue = `${SortColumn}:${SortDirection}`;

const SORT_OPTIONS: FilterDropdownOption<WeatherSortValue>[] = [
  {
    value: 'sentAt:desc',
    label: 'Newest first',
    icon: <ArrowDownWideNarrow className="h-4 w-4 shrink-0" />,
  },
  {
    value: 'sentAt:asc',
    label: 'Oldest first',
    icon: <ArrowDownWideNarrow className="h-4 w-4 shrink-0 rotate-180" />,
  },
  {
    value: 'severity:desc',
    label: 'Severity (high to low)',
    icon: <ShieldAlert className="h-4 w-4 shrink-0" />,
  },
];

function parseSort(value: WeatherSortValue): { column: SortColumn; direction: SortDirection } {
  const [column, direction] = value.split(':') as [SortColumn, SortDirection];
  return { column, direction };
}


export function WeatherAlertsPanel({
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
  onSelectWeatherAlert,
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
  onSelectWeatherAlert?: (alert: NonNullable<Notification['weatherAlert']>) => void;
  onMarkAllRead?: (ids: string[]) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<WeatherAlertTypeFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateRange>('48h');
  const [sortValue, setSortValue] = useState<WeatherSortValue>('sentAt:desc');
  const sort = useMemo(() => parseSort(sortValue), [sortValue]);

  const filtered = useMemo(() => {
    const byType = filterWeatherByAlertType(notifications, typeFilter);
    const bySeverity = filterBySeverity(byType, severityFilter);
    const byDate = filterByDateRange(bySeverity, dateFilter);
    return sortNotifications(byDate, sort.column, sort.direction);
  }, [dateFilter, notifications, severityFilter, sort, typeFilter]);

  const resetKey = `${typeFilter}|${severityFilter}|${dateFilter}|${sortValue}`;

  return (
    <AlertsPanel
      section="weather"
      title="Weather alerts"
      icon={CloudRain}
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
      onSelectWeatherAlert={onSelectWeatherAlert}
      onMarkAllRead={onMarkAllRead}
      emptyState={
        <EmptyNotifications
          title={view === 'archived' ? 'Nothing archived yet' : 'No matching weather alerts'}
          description={
            view === 'archived'
              ? 'Archived weather alerts and ones read for over a week appear here.'
              : 'Try another advisory type, severity, or date filter.'
          }
        />
      }
      filterBar={
        <div className="space-y-2">
          <FilterChips
            ariaLabel="Filter weather alerts by advisory type"
            options={WEATHER_TYPE_CHIPS}
            value={typeFilter}
            onSelect={setTypeFilter}
          />
          <div className="flex flex-wrap gap-1.5">
            <FilterDropdown
              value={severityFilter}
              onSelect={setSeverityFilter}
              options={SEVERITY_OPTIONS}
              triggerIcon={<ShieldAlert className="h-4 w-4" />}
              triggerLabel={
                SEVERITY_OPTIONS.find((o) => o.value === severityFilter)?.label ?? 'Any severity'
              }
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
