'use client';

import { CheckCircle2, Clock, Filter, Ruler } from 'lucide-react';
import { DEPTH_LABELS, STATUS_META } from '@/lib/reports/reportFormatting';
import type { FloodDepthCode, ReportStatus } from '@/types/report';
import { FilterDropdown, type FilterDropdownOption } from '@/components/ui/FilterDropdown';
import { STATUS_ICONS, depthOptions, timeRangeOptions } from './reportFilterOptions';

export function StatusFilterDropdown({
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

export function DepthsFilterDropdown({
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

export function TimeFilterDropdown({
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
