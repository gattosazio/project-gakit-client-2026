'use client';

import { useReportValidationMode } from '@/hooks/useReportValidationMode';

export function ValidationModeBadge() {
  const { mode } = useReportValidationMode();
  if (!mode?.autoValidateReports) return null;
  return <span role="status" title="Global demo mode: every new public and staff report is approved automatically. Evidence checks are disabled."
    className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
    DEMO<span className="hidden md:inline"> · Auto-validation</span>
  </span>;
}
