'use client';

import { ChevronDown, CloudRain, Info, Layers, Radio, Users } from 'lucide-react';
import { getReportCheckPresentation } from '@/lib/reports/assessmentPresentation';
import { formatDateTime, getReportAssessmentBasis, STATUS_META } from '@/lib/reports/reportFormatting';
import { hasEvidenceConflict } from '@/lib/reports/decisionReasons';
import type { Report } from '@/types/report';
import { ReportEvidenceReview } from './ReportEvidenceReview';

export function ReportAssessment({ report }: { report: Report }) {
  const view = getReportCheckPresentation(report);
  const summary = report.validationSummary;
  const manual = report.decisionSource === 'manual';
  const basis = getReportAssessmentBasis(report);
  const pending = report.status === 'UNVERIFIED' || report.status === 'ANOMALY';
  const issue = hasEvidenceConflict(report) ? 'Evidence needs review'
    : pending && !manual && summary?.checkState === 'checks_incomplete' ? 'Required checks unavailable' : null;
  return <section aria-label="Report check" className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Saved decision</h4>
      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{view.origin}</span>
    </div>
    <p className="mt-1.5 text-xs font-medium leading-5 text-slate-900">{manual && summary?.staffDecision?.label ? summary.staffDecision.label : view.message}</p>
    <dl className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px]">
      <dt className="text-slate-500">Assessment basis</dt><dd title={basis.title} className="font-medium text-slate-700">{basis.label}</dd>
    </dl>
    {report.status === 'VERIFIED' && <p className="mt-2 text-[11px] leading-5 text-slate-500">
      {basis.label === 'Physical support' ? 'Weather and model support do not independently confirm the flood or its reported depth.'
        : 'Report validation does not certify the reported water depth.'}
    </p>}
    {issue && <p className="mt-2 text-xs font-medium text-amber-800">{issue}</p>}
    {summary?.depthDisagreement && <p className="mt-2 text-xs font-medium text-amber-800">Reported depths differ. Review them before use.</p>}
    <div className="mt-2 space-y-0.5 text-[10px] leading-4 text-slate-500">
      {manual && summary?.staffDecision?.decidedAt && <p>Staff decision recorded {formatDateTime(summary.staffDecision.decidedAt)}</p>}
      {summary?.assessedAt && <p>Evidence checked {formatDateTime(summary.assessedAt)}</p>}
    </div>
    {view.reviewNotice && <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-4 text-amber-900"><Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{view.reviewNotice}</p>}
    {summary?.reviewAvailable && <ReportEvidenceReview key={report.id} reportId={report.id} />}
  </section>;
}

export function ReportValidationChecks({ report }: { report: Report }) {
  const view = getReportCheckPresentation(report);
  const summary = report.validationSummary;
  const context = view.details.filter(detail => !['A photo was provided.', 'No photo was provided.'].includes(detail));
  return <details className="group rounded-xl border border-slate-200 bg-white">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl p-3 text-xs font-semibold text-slate-700 focus-visible:outline-gakit-maroon [&::-webkit-details-marker]:hidden">
      Validation checks<ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
    </summary>
    <div className="border-t border-slate-100 px-4 pb-4">
      {view.checks.length ? <dl className="divide-y divide-slate-100 text-xs leading-5">{view.checks.map(check => {
        const Icon = check.label === 'Rainfall' ? CloudRain : check.label === 'PAGASA' ? Radio : check.label === 'Other reports' ? Users : Layers;
        return <div key={check.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-3">
          <dt className="flex items-center gap-2 text-slate-500"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{check.label}</dt>
          <dd className="break-words font-medium text-slate-700">{check.value}</dd>
        </div>;
      })}</dl> : <p className="py-3 text-xs text-slate-500">No detailed checks were saved with this report.</p>}
      {context.length > 0 && <ul className="space-y-2 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">{context.map(detail => <li key={detail}>{detail}</li>)}</ul>}
      {report.decisionSource === 'manual' && summary && summary.recommendedStatus !== report.status && <p className="mt-3 text-xs leading-5 text-slate-500">
        Earlier automatic recommendation: {STATUS_META[summary.recommendedStatus].label}. The saved staff decision applies.
      </p>}
      {summary?.checkState === 'review_required' && !summary.reviewAvailable && <ReportEvidenceReview key={report.id} reportId={report.id} />}
    </div>
  </details>;
}
