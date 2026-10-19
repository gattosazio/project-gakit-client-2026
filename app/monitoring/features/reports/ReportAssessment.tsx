'use client';

import { ChevronDown } from 'lucide-react';
import { getReportCheckPresentation } from '@/lib/reports/assessmentPresentation';
import { formatDateTime, STATUS_META } from '@/lib/reports/reportFormatting';
import type { Report } from '@/types/report';

export function ReportAssessment({ report }: { report: Report }) {
  const view = getReportCheckPresentation(report);
  const summary = report.validationSummary;
  const checkedAt = report.decisionSource === 'manual' ? report.updatedAt : summary?.assessedAt;
  return (
    <section aria-label="Report check" className="rounded-xl border border-slate-200 bg-white p-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Report check</h4>
      <p className="mt-1 text-xs font-medium leading-5 text-slate-800">{view.message}</p>
      {view.checks.length > 0 && <dl className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 text-[11px] leading-4">
        {view.checks.map(check => <div key={check.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
          <dt className="text-slate-500">{check.label}</dt>
          <dd className="font-medium text-slate-700">{check.value}</dd>
        </div>)}
      </dl>}
      {view.depthNote && <p className="mt-2 text-[11px] leading-4 text-slate-500">{view.depthNote}</p>}
      {checkedAt && <p className="mt-2 text-[10px] leading-4 text-slate-400">{view.origin} · {formatDateTime(checkedAt)}</p>}
      {summary && <details className="group mt-2 border-t border-slate-100 pt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded text-[11px] font-medium text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon [&::-webkit-details-marker]:hidden">
          More details <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <ul className="mt-2 space-y-1 text-[11px] leading-4 text-slate-600">
          {view.details.map(detail => <li key={detail}>{detail}</li>)}
        </ul>
        {report.decisionSource === 'manual' && summary.recommendedStatus !== report.status && <p className="mt-2 text-[11px] leading-4 text-slate-500">
          Automatic result: {STATUS_META[summary.recommendedStatus].label}. The staff decision applies.
        </p>}
      </details>}
    </section>
  );
}
