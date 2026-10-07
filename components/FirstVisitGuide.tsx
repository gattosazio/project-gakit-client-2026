'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, MapPinned, Waves, X } from 'lucide-react';

const STORAGE_KEY = 'gakit:first-visit-seen';

const STEPS: Array<{ title: string; body: string; icon: ReactNode }> = [
  {
    title: 'Explore the live hazard map',
    body: 'Pan and zoom across Iligan City to see hazard layers for flooding, landslide, and storm surge, plus every report submitted by residents.',
    icon: <MapPinned className="h-5 w-5" />,
  },
  {
    title: 'Report flooding you can see',
    body: 'Tap the Report button, then give the location and how deep the water is. It takes under a minute and helps responders prioritise the worst-hit areas.',
    icon: <Waves className="h-5 w-5" />,
  },
  {
    title: 'Follow your report',
    body: 'Reports appear on the map immediately as unverified pins. Staff review them, and you will see the status change once it has been checked.',
    icon: <MapPinned className="h-5 w-5" />,
  },
];

function hasSeenGuide(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function hasSeenFirstVisitGuide(): boolean {
  if (typeof window === 'undefined') return true;
  return hasSeenGuide();
}

export function resetFirstVisitGuide(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode); guide will simply re-show */
  }
}

/**
 * One-time orientation shown the first time a visitor reaches the public hazard
 * map. Persisted in localStorage so it shows once per browser rather than once
 * per session, and reopenable from the header help control.
 */
export function FirstVisitGuide({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* storage unavailable; guide will re-show next visit */
    }
    setStep(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        finish();
        return;
      }
      if (event.key === 'ArrowRight') {
        setStep((current) => Math.min(current + 1, STEPS.length - 1));
        return;
      }
      if (event.key === 'ArrowLeft') {
        setStep((current) => Math.max(current - 1, 0));
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, finish]);

  if (!isOpen) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={finish}
      role="dialog"
      aria-modal="true"
      aria-label="How to use GAKIT"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gakit-maroon">
              Welcome to GAKIT
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-900">{current.title}</h2>
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="Close guide"
            className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-canvas-light hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-100">
            {current.icon}
          </span>
          <p className="text-sm leading-6 text-slate-600">{current.body}</p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" role="status" aria-live="polite">
            <span className="sr-only">
              Step {step + 1} of {STEPS.length}
            </span>
            {STEPS.map((entry, index) => (
              <span
                key={entry.title}
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  index === step ? 'w-5 bg-gakit-maroon' : 'w-1.5 bg-slate-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(value - 1, 0))}
                className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-canvas-light"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                className="rounded-lg bg-gakit-maroon px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-maroon-800"
              >
                Start exploring
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((value) => Math.min(value + 1, STEPS.length - 1))}
                className="flex items-center gap-1 rounded-lg bg-gakit-maroon px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-maroon-800"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}