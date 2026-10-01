'use client';

import Link from 'next/link';
import {
  HelpCircle,
  MapPin,
  Megaphone,
  Waves,
  X,
} from 'lucide-react';
import type { RefObject } from 'react';

interface HowToReportPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
  onNavigateAbout?: () => void;
}

export function HowToReportPopover({
  isOpen,
  onToggle,
  containerRef,
  onNavigateAbout,
}: HowToReportPopoverProps) {
  const handleAboutClick = (e: React.MouseEvent) => {
    onToggle();
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      e.preventDefault();
      if (onNavigateAbout) {
        onNavigateAbout();
      } else {
        document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-gakit-maroon active:scale-95 ${
          isOpen ? 'bg-slate-200 text-slate-900 ring-1 ring-slate-300/80 font-bold' : ''
        }`}
        aria-expanded={isOpen}
        aria-label="Platform Guide"
        title="Platform Guide"
      >
        <HelpCircle className={`h-5 w-5 ${isOpen ? 'text-gakit-maroon' : 'text-slate-600'}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop for mobile dismiss and focus */}
          <div
            className="fixed inset-0 z-[1290] bg-black/20 backdrop-blur-xs md:hidden"
            onClick={onToggle}
            aria-hidden="true"
          />

          {/* Centered on mobile via fixed inset-x-4 + mx-auto, anchored on desktop */}
          <div className="fixed inset-x-4 top-16 z-[1300] mx-auto max-w-[350px] overflow-hidden md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-[350px] animate-in fade-in zoom-in-95 duration-150">
            <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.14),inset_0_1px_0_0_rgba(255,255,255,0.9)] backdrop-blur-xl ring-1 ring-slate-200/80">
              {/* Header */}
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-gakit-maroon ring-1 ring-rose-200/60">
                    <HelpCircle className="h-3.5 w-3.5 stroke-[2.5]" />
                  </div>
                  <h3 className="font-heading text-xs font-bold text-slate-900">
                    Platform Guide
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onToggle}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  aria-label="Close guide"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Quick Feature Guides */}
              <div className="space-y-2">
                {/* Assess Risk */}
                <div className="flex items-start gap-2.5 rounded-xl bg-slate-50/80 p-2.5 ring-1 ring-slate-200/50 transition-colors hover:bg-slate-100/60">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100/80 text-gakit-maroon">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading text-[11px] font-bold text-slate-900 leading-snug">
                      Assess Geohazard Risk
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Tap any point on the map or search an address to view site-level flood, landslide &amp; storm surge exposure.
                    </p>
                  </div>
                </div>

                {/* Flood Scenarios */}
                <div className="flex items-start gap-2.5 rounded-xl bg-slate-50/80 p-2.5 ring-1 ring-slate-200/50 transition-colors hover:bg-slate-100/60">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100/80 text-sky-700">
                    <Waves className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading text-[11px] font-bold text-slate-900 leading-snug">
                      Simulate Flood Scenarios
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Replay 24-hr historical typhoons, PAGASA alert thresholds, and UP NOAH benchmark flood simulations.
                    </p>
                  </div>
                </div>

                {/* Community Report */}
                <div className="flex items-start gap-2.5 rounded-xl bg-slate-50/80 p-2.5 ring-1 ring-slate-200/50 transition-colors hover:bg-slate-100/60">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-800">
                    <Megaphone className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading text-[11px] font-bold text-slate-900 leading-snug">
                      Report Flood Hazards
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Pin flooded streets and select height references (Ankle to Submerged) to alert responders and the community.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer Links */}
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
                <Link
                  href="/#about"
                  onClick={handleAboutClick}
                  className="font-semibold text-gakit-maroon hover:text-maroon-800 hover:underline transition-colors"
                >
                  About Project GAKIT &rarr;
                </Link>
                <a
                  href="mailto:support@gakit.ph"
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  support@gakit.ph
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
