'use client';

import { Locate, MapPinned } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Explicit, mobile-only location prompt for returning visitors. Nothing is
 * requested from the browser until the visitor taps "Use my location".
 */
export function MobileLocationPrompt({
  isOpen,
  isLocating,
  error,
  onUseLocation,
  onDismiss,
}: {
  isOpen: boolean;
  isLocating: boolean;
  error: string | null;
  onUseLocation: () => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={isLocating ? () => {} : onDismiss}
      ariaLabelledBy="mobile-location-prompt-title"
      maxWidthClass="max-w-sm"
      panelClassName="p-0"
    >
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon">
          <MapPinned className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id="mobile-location-prompt-title"
            className="font-heading text-base font-bold text-slate-900"
          >
            See reports near you
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Use your location to center the map on your area. You can also
            explore the map manually.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-4 text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 p-5 pt-4">
        <button
          type="button"
          onClick={onUseLocation}
          disabled={isLocating}
          aria-busy={isLocating}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-gakit-maroon px-4 text-xs font-semibold text-white transition-colors hover:bg-maroon-800 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
        >
          {isLocating ? (
            <Spinner size="sm" />
          ) : (
            <Locate className="h-4 w-4" aria-hidden="true" />
          )}
          {isLocating ? 'Getting your location…' : 'Use my location'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isLocating}
          className="flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          Not now
        </button>
      </div>
    </Dialog>
  );
}
