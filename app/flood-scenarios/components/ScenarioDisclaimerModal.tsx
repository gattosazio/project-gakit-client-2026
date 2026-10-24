'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Info, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'gakit:scenario-disclaimer-seen';

export function ScenarioDisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setIsOpen(true);
      }
    } catch {
      // In private browsing or storage disabled, default to open once
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // Ignore storage write errors
      }
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md">
      <div role="dialog" aria-modal="true" aria-labelledby="disclaimer-title" aria-describedby="disclaimer-description disclaimer-note"
        className="w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon">
            <Info className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 id="disclaimer-title" className="font-heading text-sm font-bold leading-5 text-slate-900">Flood Scenario Explorer</h2>
        </div>
        <p id="disclaimer-description" className="mt-3 text-xs leading-5 text-slate-600">
          Explore modeled flood conditions for planning and learning.
        </p>
        <div id="disclaimer-note" className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
          <p className="mb-1 font-semibold text-slate-800">Disclaimer</p>
          <p>Flood extent, depths, and timing are estimates, not confirmed conditions or official PAGASA advisories. Follow official warnings and local authorities for safety decisions.</p>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={dontShowAgain} onChange={event => setDontShowAgain(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-gakit-maroon focus:ring-gakit-maroon" />
          Don&apos;t show again
        </label>
        <button type="button" onClick={handleDismiss}
          className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-gakit-maroon px-4 text-xs font-semibold text-white transition-colors hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2">
          Start exploring <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <Link href="/" className="mt-3 block text-center text-[11px] font-medium text-slate-500 hover:text-gakit-maroon focus-visible:outline-gakit-maroon">
          View hazard map
        </Link>
      </div>
    </div>
  );
}
