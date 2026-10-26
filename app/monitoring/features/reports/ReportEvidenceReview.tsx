'use client';

import { useEffect, useRef, useState } from 'react';
import { STATUS_META } from '@/lib/reports/reportFormatting';
import { fetchReportReviewHistory, requestReportReassessment } from './actions/reports';
import type { ReportReviewHistory } from './actions/reports';

type Recommendation = ReportReviewHistory['assessments'][number]['assessment']['result'];

/** Evidence checks produce a recommendation; the existing moderation controls apply a decision. */
export function ReportEvidenceReview({ reportId }: { reportId: string }) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const initialAssessmentId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    if (!checking) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 60_000;
    const refresh = async () => {
      try {
        const history = await fetchReportReviewHistory(reportId, controller.signal);
        if (controller.signal.aborted) return;
        const latest = history.assessments.find(item => item.id > initialAssessmentId.current
          && item.report_revision === history.reportRevision && item.trigger === 'staff_request');
        if (latest) {
          setRecommendation(latest.assessment.result);
          setMessage(latest.applied ? latest.assessment.result.assigned_status === 'UNVERIFIED'
            ? 'The report remains Pending. The assessment explains what still needs review.'
            : 'The Pending report has completed this check.'
            : 'Review recommendation only. Use the report actions to record your decision.');
          setChecking(false);
          return;
        }
        const job = history.jobs.find(item => item.trigger === 'staff_request');
        if (job && ['failed', 'superseded'].includes(job.status)) {
          setMessage(job.status === 'superseded' ? 'The evidence changed during this check. Request another review.'
            : 'The check could not finish. The saved decision remains in effect.');
          setChecking(false);
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      if (Date.now() >= deadline) {
        setMessage('The check is still queued or waiting for evidence. The saved decision remains in effect.');
        setChecking(false);
      } else timer = setTimeout(refresh, 3000);
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [checking, reportId]);

  const requestReview = async () => {
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setMessage('Requesting evidence review…');
    try {
      const history = await fetchReportReviewHistory(reportId, controller.signal);
      if (controller.signal.aborted) return;
      initialAssessmentId.current = Math.max(0, ...history.assessments.map(item => item.id));
      await requestReportReassessment(reportId);
      if (controller.signal.aborted) return;
      setRecommendation(null);
      setMessage('Checking the latest evidence. The saved decision remains in effect.');
      setChecking(true);
    } catch {
      if (!controller.signal.aborted) setMessage('Could not request the review. Please try again.');
    }
  };

  return <div className="mt-2 border-t border-slate-100 pt-2">
    <button type="button" disabled={checking || message === 'Requesting evidence review…'} onClick={() => void requestReview()}
      className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-gakit-maroon transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon disabled:opacity-50">
      {checking ? 'Checking evidence…' : 'Request evidence review'}
    </button>
    {!message && <p className="mt-1.5 text-xs leading-5 text-slate-500">Runs the evidence checks and shows a recommendation for staff review.</p>}
    {message && <p role="status" className="mt-1 text-xs leading-5 text-slate-600">{message}</p>}
    {recommendation && <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-slate-800">
      <p className="font-medium">Assessment recommendation: {STATUS_META[recommendation.assigned_status].label}</p>
      <p>{recommendation.explanation}</p>
    </div>}
  </div>;
}
