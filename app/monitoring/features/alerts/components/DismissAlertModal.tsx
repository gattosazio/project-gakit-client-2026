import { AlertTriangle } from 'lucide-react';
import type { Notification } from '@/lib/notifications';

interface DismissAlertModalProps {
  notification: Notification | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DismissAlertModal({
  notification,
  onClose,
  onConfirm,
}: DismissAlertModalProps) {
  if (!notification) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dismiss-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 id="dismiss-dialog-title" className="mt-3 text-base font-bold text-slate-900">
          Dismiss Notification?
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to dismiss &ldquo;{notification.title}&rdquo;? It will be removed from your active list.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-canvas-grey px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
