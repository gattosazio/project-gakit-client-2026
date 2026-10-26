'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatDateTime, STATUS_META } from '@/lib/reports/reportFormatting';
import { fetchReportReviewHistory, type ReportReviewHistory } from './actions/reports';

/** Staff-only history endpoint; private notes never come from a public receipt. */
export function StaffDecisionHistory({ reportId }: { reportId: string }) {
  const [decisions, setDecisions] = useState<ReportReviewHistory['decisions']>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  return <details className="group mt-3 border-t border-slate-100 pt-3" onToggle={async event => {
    if (!event.currentTarget.open || decisions || loading) return;
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setFailed(false);
    try {
      const history = await fetchReportReviewHistory(reportId, controller.signal);
      if (!controller.signal.aborted) setDecisions(history.decisions ?? []);
    } catch { if (!controller.signal.aborted) setFailed(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }}>
    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
      Staff decision history<ChevronDown className="h-4 w-4 group-open:rotate-180" aria-hidden="true" />
    </summary>
    {loading && <p role="status" className="mt-3 text-xs text-slate-500">Loading decisions…</p>}
    {failed && <p role="alert" className="mt-3 text-xs text-slate-500">Could not load history. Close and reopen this section to retry.</p>}
    {decisions?.length === 0 && <p className="mt-3 text-xs text-slate-500">No staff decisions are recorded.</p>}
    <ol className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
      {decisions?.map(decision => <li key={decision.id} className="rounded-lg border border-slate-100 p-3">
        <p className="font-semibold text-slate-800">{STATUS_META[decision.verdict].label}{decision.verdict === 'ANOMALY' ? ' · Legacy conflict' : ''}</p>
        <p>{decision.reason || 'No reason recorded under the previous workflow.'}</p>
        {decision.note && <p className="mt-2 whitespace-pre-wrap break-words"><span className="font-medium">Staff-only note: </span>{decision.note}</p>}
        <p className="mt-2 break-words text-[10px] text-slate-400">{decision.actor} · {formatDateTime(decision.created_at)}</p>
      </li>)}
    </ol>
  </details>;
}
