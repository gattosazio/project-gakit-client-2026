'use client';

import Link from 'next/link';
import { Switch } from '@/components/ui/Switch';
import { setDemoEnabled } from '@/lib/demo/settings';
import { useReportValidationMode } from '@/hooks/useReportValidationMode';

export function DeveloperToolsSection() {
  const globalMode = useReportValidationMode();
  return <div className="space-y-4">
    <Switch label="Auto-validate all reports" checked={globalMode.mode?.autoValidateReports ?? false}
      disabled={!globalMode.mode || globalMode.saving || Boolean(globalMode.error)}
      onChange={next => void globalMode.save(next)}
      description="Global demo setting: bypass the validation engine and mark every new public and staff report Verified. Applies to everyone, across all browsers, until an admin turns it off." />
    {globalMode.saving && <p role="status" className="text-xs text-slate-500">Saving global validation mode…</p>}
    {globalMode.error && <p role="alert" className="text-xs text-red-700">{globalMode.error} <button type="button" className="font-semibold underline" onClick={globalMode.retry}>Retry</button></p>}
    {globalMode.mode?.autoValidateReports && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Demo approvals are active for everyone. Evidence checks and background assessments are paused. Turning this off restores normal validation for new reports.</p>}
    <div className="border-t border-slate-200 pt-4">
      <p className="mb-3 text-xs leading-5 text-slate-500">Play a synthetic storm, submit current or earlier observations, watch the validation engine decide, then inspect eligible depth and wet-area changes. The workspace uses normal validation by default; bypassing it is an explicit option. Public-map submissions do not feed the synthetic storm.</p>
      <Link href="/admin/demo" onClick={() => setDemoEnabled(true)} className="inline-flex rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white">Open storm & report demo</Link>
    </div>
  </div>;
}
