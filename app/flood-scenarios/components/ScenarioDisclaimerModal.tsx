'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ShieldAlert, Sparkles, ExternalLink, ArrowRight, Check } from 'lucide-react';

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
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-2xl ring-1 ring-slate-900/10"
      >
        {/* Accent Top Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-gakit-maroon" />

        {/* Header with Icon */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/80">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-300">
                Planning &amp; Drill Simulator
              </span>
            </div>
            <h2 id="disclaimer-title" className="mt-1 font-heading text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
              Simulation Scenario Notice
            </h2>
          </div>
        </div>

        {/* Notice Body */}
        <div className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-slate-600">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-amber-950">
            <p className="font-semibold text-xs sm:text-[13px] leading-snug">
              ⚠️ The inundation maps and water depths displayed in this tool are <strong className="font-bold underline decoration-amber-500">simulated scenarios</strong>. They do <span className="font-bold">NOT</span> represent real-time ongoing flooding in Iligan City.
            </p>
          </div>

          <p>
            Project GAKIT provides this interactive scenario engine to help residents, barangay officials, and responders understand:
          </p>

          <ul className="space-y-2 pl-1">
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-bold mt-0.5">1</span>
              <span>
                <strong className="text-slate-900 font-semibold">Historical Storms:</strong> Retrospective reconstructions of past events like Tropical Storm Sendong (2011) and Odette (2021).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-bold mt-0.5">2</span>
              <span>
                <strong className="text-slate-900 font-semibold">PAGASA Warning Benchmarks:</strong> Simulated inundation patterns matching Yellow, Orange, and Red rainfall warnings.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-bold mt-0.5">3</span>
              <span>
                <strong className="text-slate-900 font-semibold">Return Periods:</strong> UP NOAH 5-year, 25-year, and 100-year design flood benchmarks.
              </span>
            </li>
          </ul>
        </div>

        {/* Real-time Link Callout */}
        <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/60">
          <span className="text-xs text-slate-500 font-medium">
            Looking for active real-time conditions?
          </span>
          <Link
            href="/"
            className="inline-flex items-center gap-1 font-heading text-xs font-bold text-gakit-maroon hover:underline"
          >
            Live Hazard Map <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Don't show again toggle */}
        <label className="mt-4 flex items-center gap-2.5 cursor-pointer select-none text-xs text-slate-600 font-medium">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-gakit-maroon focus:ring-gakit-maroon"
          />
          <span>Don&apos;t show this notice again on this device</span>
        </label>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-gakit-maroon to-maroon-800 px-6 py-2.5 font-heading text-xs font-bold text-white shadow-md transition-all duration-150 hover:from-maroon-800 hover:to-maroon-900 active:scale-95"
          >
            <Check className="h-4 w-4" />
            <span>I Understand &bull; Explore Scenarios</span>
          </button>
        </div>
      </div>
    </div>
  );
}
