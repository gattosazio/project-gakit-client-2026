import type { ReportReceipt } from '@/types/report';

/** Explain the saved receipt; submission success and assessment status are separate facts. */
export function getReportFeedbackPresentation(report: ReportReceipt) {
  const summary = report.validationSummary;
  const manual = report.decisionSource === 'manual';
  const demo = !manual && report.status === 'VERIFIED' && summary?.demoAutoValidated;
  const common = {
    reviewNotice: summary?.reviewAvailable
      ? 'Additional evidence is available for staff review. The saved decision remains in effect.' : null,
    origin: manual ? 'Staff decision' : demo ? 'Demo approval' : 'Automatic assessment',
    savedExplanation: manual ? summary?.staffDecision?.label ?? null : summary?.explanation ?? null,
    assessedAt: summary?.assessedAt,
    decidedAt: manual ? summary?.staffDecision?.decidedAt : undefined,
  };
  if (demo) return { ...common, tone: 'amber' as const, label: 'Demo approval', title: 'Approved for the demo',
    description: 'Evidence checks were skipped because demo auto-validation was enabled.',
    nextStep: 'This approval does not establish flood or depth accuracy.' };
  if (report.status === 'VERIFIED') return { ...common, tone: 'green' as const, label: 'Validated', title: 'Report accepted',
    description: manual ? summary?.staffDecision?.label ?? 'Staff accepted your report.' : 'Your report was accepted against the available flood evidence.',
    nextStep: 'Reported water depth has not been independently confirmed.' };
  if (report.status === 'REJECTED') return { ...common, tone: 'slate' as const, label: 'Rejected', title: 'Report not accepted',
    description: manual ? summary?.staffDecision?.label ?? 'Staff rejected your report.' : 'The assessment did not accept this report for operational use.',
    nextStep: 'It is not shown on the public report map. Staff can review new evidence.' };
  if (report.status === 'ANOMALY') return { ...common, tone: 'amber' as const, label: 'Pending', title: 'Staff review needed',
    description: manual ? 'Staff flagged your report for review.' : 'Your report was saved and flagged for staff review.',
    nextStep: 'A staff decision is needed before this report can be validated.' };
  if (manual) return { ...common, tone: 'amber' as const, label: 'Pending', title: 'Awaiting staff review',
    description: summary?.staffDecision?.label ?? 'Staff marked your report as Pending.',
    nextStep: 'The next decision will be recorded by staff.' };
  if (summary?.checkState === 'review_required') return { ...common, tone: 'amber' as const, label: 'Pending', title: 'Awaiting review',
    description: 'The available information needs review before this report can be accepted.',
    nextStep: 'Additional evidence or a staff decision is needed.' };
  if (summary?.checkState === 'checks_incomplete') return { ...common, tone: 'amber' as const, label: 'Pending', title: 'Assessment incomplete',
    description: 'Your report was saved. Some information needed for assessment is unavailable.',
    nextStep: 'Staff can review the report if the checks cannot be completed.' };
  return { ...common, tone: 'amber' as const, label: 'Pending', title: 'Awaiting a decision',
    description: 'Your report is saved and waiting for assessment or staff review.',
    nextStep: 'Staff can review the available report details.' };
}
