'use client';

import { useId } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Dialog } from './Dialog';

/** Shared failure presentation for recoverable features; callers own retry state. */
export function FailureModal({ isOpen, title = 'Temporarily unavailable', message, onClose, onRetry }: {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onRetry?: () => void;
}) {
  const titleId = useId();
  return <Dialog isOpen={isOpen} onClose={onClose} ariaLabelledBy={titleId} maxWidthClass="max-w-sm">
    <div className="flex items-start gap-3">
      <span className="rounded-full bg-amber-50 p-2 text-amber-700"><AlertCircle className="h-5 w-5" aria-hidden="true" /></span>
      <div><h2 id={titleId} className="text-sm font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">{message}</p></div>
    </div>
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Close</button>
      {onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-gakit-maroon px-3 py-2 text-sm font-semibold text-white hover:opacity-90"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Try again</button>}
    </div>
  </Dialog>;
}
