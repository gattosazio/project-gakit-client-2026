'use client';

import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Loader2,
  Locate,
  MapPin,
  MapPinned,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

export type OnboardingLocationStatus =
  | 'idle'
  | 'checking'
  | 'locating'
  | 'ready'
  | 'outside'
  | 'denied'
  | 'unsupported'
  | 'error';

export function OnboardingWelcome({
  isOpen,
  status,
  address,
  errorMessage,
  onUseLocation,
  onChooseMap,
  onStartTour,
  onExplore,
  onSkipLocation,
  onDismiss,
}: {
  isOpen: boolean;
  status: OnboardingLocationStatus;
  address?: string | null;
  errorMessage?: string | null;
  onUseLocation: () => void;
  onChooseMap: () => void;
  onStartTour: () => void;
  onExplore: () => void;
  onSkipLocation: () => void;
  onDismiss: () => void;
}) {
  const isLocating = status === 'locating' || status === 'checking';
  const hasFix = status === 'ready' || status === 'outside';
  const primaryMapAction =
    status === 'denied' || status === 'unsupported' || status === 'error';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!isLocating) onDismiss();
      }}
      ariaLabel="Welcome to GAKIT"
      maxWidthClass="max-w-md"
      panelClassName="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-gakit-maroon via-maroon-800 to-maroon-900 px-5 pb-5 pt-4 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full border border-white/10 bg-white/[0.06]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 right-8 h-32 w-32 rounded-full border border-white/10"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <MapPinned className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">
                Project GAKIT
              </p>
              <p className="font-heading text-sm font-bold tracking-wide">Hazard Map</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isLocating}
            aria-label="Close welcome"
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="relative mt-4 text-lg font-bold leading-6">
          {status === 'outside'
            ? 'You are outside Iligan City'
            : hasFix
              ? 'Location is on'
              : 'See hazards where you are'}
        </h2>
        <p className="relative mt-1 max-w-sm text-xs leading-5 text-white/75">
          Flood, landslide, and storm surge risk across Iligan City — plus live reports from
          residents.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {hasFix ? (
          <>
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                status === 'outside'
                  ? 'border-amber-200 bg-amber-50/70'
                  : 'border-emerald-200 bg-emerald-50/70'
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs ${
                  status === 'outside' ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {status === 'outside' ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                ) : (
                  <MapPin className="h-4 w-4" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">
                  {status === 'outside' ? 'Your location is outside Iligan City' : 'Using your location'}
                </p>
                <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-600">
                  {status === 'outside'
                    ? 'The map stays on Iligan City. Search or choose a place on the map to check hazards.'
                    : address || 'The map is centered on your current position.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={status === 'outside' ? onChooseMap : onStartTour}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gakit-maroon px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 active:scale-[0.99]"
            >
              {status === 'outside' ? (
                <>
                  <MapPin className="h-4 w-4" aria-hidden />
                  Choose a place on the map
                </>
              ) : (
                <>
                  Show me around
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={status === 'outside' ? onStartTour : onChooseMap}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-maroon-200 hover:bg-maroon-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
            >
              {status === 'outside' ? (
                <>
                  Show me around first
                  <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden />
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 text-slate-500" aria-hidden />
                  Choose another place
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onExplore}
              className="mx-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
            >
              Explore on my own
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {status === 'denied' && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Location is blocked in your browser. Enable it in this site&apos;s settings,
                    then reload — or choose a place on the map.
                  </span>
                </div>
              )}
              {status === 'unsupported' && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>This browser does not support location sharing. Choose a place on the map instead.</span>
                </div>
              )}
              {status === 'error' && errorMessage && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] leading-4 text-rose-900"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={primaryMapAction ? onChooseMap : onUseLocation}
              disabled={isLocating}
              aria-busy={isLocating}
              className="flex w-full items-start gap-3 rounded-xl border-2 border-gakit-maroon bg-maroon-50/60 p-3.5 text-left transition-colors hover:bg-maroon-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 disabled:cursor-wait disabled:hover:bg-maroon-50/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gakit-maroon shadow-xs">
                {isLocating ? (
                  <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : primaryMapAction ? (
                  <MapPin className="h-5 w-5" aria-hidden />
                ) : (
                  <Locate className="h-5 w-5" aria-hidden />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">
                  {isLocating
                    ? 'Waiting for location…'
                    : primaryMapAction
                      ? 'Choose a place on the map'
                      : 'Turn on location'}
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-600">
                  {isLocating
                    ? 'Allow location access in your browser to continue.'
                    : primaryMapAction
                      ? 'Pick a starting point and check its hazards.'
                      : 'Center the map on where you are. You can change it anytime.'}
                </span>
              </span>
            </button>

            {!primaryMapAction && (
              <button
                type="button"
                onClick={onChooseMap}
                disabled={isLocating}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-colors hover:border-maroon-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Choose on the map</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                    Prefer to pick a barangay, street, or landmark yourself?
                  </span>
                </span>
              </button>
            )}

            {status === 'error' && (
              <button
                type="button"
                onClick={onUseLocation}
                disabled={isLocating}
                className="mx-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gakit-maroon transition-colors hover:bg-maroon-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
              >
                Try my location again
              </button>
            )}

            <button
              type="button"
              onClick={onSkipLocation}
              disabled={isLocating}
              className="mx-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon disabled:opacity-40"
            >
              Skip location and take the tour
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </>
        )}

        <p className="flex items-start gap-1.5 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-400">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Your location is only used to center the map. It is not stored unless you submit a
          report.
        </p>
      </div>
    </Dialog>
  );
}
