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
  value: 'All' | 'AllStatuses' | ReportStatus;
  onChange: (value: 'All' | 'AllStatuses' | ReportStatus) => void;
}) {
  const options: FilterDropdownOption<'All' | 'AllStatuses' | ReportStatus>[] = [
    { value: 'All', label: 'Pending & validated', icon: <Filter className="w-4 h-4 shrink-0" /> },
    { value: 'AllStatuses', label: 'All statuses', icon: <Filter className="w-4 h-4 shrink-0" /> },
    ...(['UNVERIFIED', 'VERIFIED', 'REJECTED'] as ReportStatus[]).map((status) => {
      const Icon = STATUS_ICONS[status];
      return {
        value: status,
        label: STATUS_META[status].label,
        icon: <Icon className="w-4 h-4 shrink-0" style={{ color: STATUS_META[status].color }} />,
      };
    }),
  ];
  const isGroup = value === 'All' || value === 'AllStatuses';
  const SelectedIcon = isGroup ? Filter : STATUS_ICONS[value];

  return (
    <FilterDropdown
      size="sm"
      value={value}
      onSelect={onChange}
      options={options}
      triggerIcon={
        <SelectedIcon
          className="w-4 h-4"
          style={!isGroup ? { color: STATUS_META[value].color } : undefined}
        />
      }
      triggerLabel={value === 'All' ? 'Pending & validated' : value === 'AllStatuses' ? 'All statuses' : STATUS_META[value].label}
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
      size="sm"
      maxMenuHeight={320}
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
      size="sm"
      value={value}
      onSelect={onChange}
      options={options}
      triggerIcon={<Clock className="w-4 h-4" />}
      triggerLabel={timeRangeOptions.find((option) => option.value === value)?.label ?? value}
    />
  );
}
