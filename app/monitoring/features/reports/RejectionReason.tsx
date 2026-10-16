'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';

const REJECTION_REASONS = [
  'Spam',
  'False or misleading report',
  'Not a flood incident',
] as const;

export function RejectionReasonSelect({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return <div>
    <label htmlFor={id} className="mb-1 block text-[11px] font-semibold text-slate-600">Rejection reason <span className="text-hazard-critical">*</span></label>
    <select id={id} required value={value} onChange={event => onChange(event.target.value)} disabled={disabled}
      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-gakit-maroon disabled:opacity-60">
      <option value="" disabled>Select a reason</option>
      {REJECTION_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
    </select>
  </div>;
}

export function ReportStatusReasonDialog({ reportId, isUpdating, onClose, onConfirm, action = 'reject' }: {
  action?: 'reject' | 'reopen';
  reportId: string;
  isUpdating: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const reopening = action === 'reopen';
  const title = reopening ? 'Reopen for review' : 'Reject report';
  const panelRef = useModalA11y<HTMLDivElement>({ enabled: true });
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUpdating) { event.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [isUpdating, onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
      onClick={event => { if (event.target === event.currentTarget && !isUpdating) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl outline-none">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-0.5 font-mono text-[10px] text-slate-400">#{reportId.slice(0, 8)}</p></div>
          <button type="button" onClick={onClose} disabled={isUpdating} aria-label="Close status change dialog" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={event => { event.preventDefault(); if (reason.trim() && !isUpdating) onConfirm(reason.trim()); }}>
          {reopening ? <div>
            <label htmlFor={reasonId} className="mb-1 block text-[11px] font-semibold text-slate-600">Reason for reopening <span className="text-hazard-critical">*</span></label>
            <textarea id={reasonId} required value={reason} onChange={event => setReason(event.target.value)} disabled={isUpdating} rows={3}
              placeholder="Explain why this report needs another review…"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-gakit-maroon disabled:opacity-60" />
          </div> : <RejectionReasonSelect value={reason} onChange={setReason} disabled={isUpdating} />}
          <p className="mt-2 text-[11px] leading-4 text-slate-500">The reason will be recorded in the report’s decision history.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isUpdating} className="h-8 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600">Cancel</button>
            <button type="submit" disabled={!reason.trim() || isUpdating} className="h-8 rounded-md bg-gakit-maroon px-3 text-xs font-semibold text-white hover:bg-maroon-800 disabled:opacity-50">{isUpdating ? 'Saving…' : title}</button>
          </div>
        </form>
      </div>
    </div>, document.body,
  );
}
