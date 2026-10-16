'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  HelpCircle,
  MapPin,
  Megaphone,
  Waves,
  X,
} from 'lucide-react';
import { useId, type RefObject } from 'react';

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
  const panelId = useId();
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
        className={`flex h-10 min-w-10 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[9px] font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-gakit-maroon md:h-9 md:flex-row md:gap-1.5 md:px-2.5 md:text-[11px] ${
          isOpen ? 'bg-slate-200 text-slate-900 ring-1 ring-slate-300/80 font-bold' : ''
        }`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label="Platform Guide"
        title="Platform Guide"
      >
        <HelpCircle className={`h-4 w-4 ${isOpen ? 'text-gakit-maroon' : 'text-slate-600'}`} />
        <span>Guide</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop for mobile dismiss and focus */}
          <div
            className="fixed inset-0 z-[1290] bg-black/20 backdrop-blur-xs md:hidden"
            onClick={onToggle}
            aria-hidden="true"
          />

          <div id={panelId} role="region" aria-label="Platform Guide"
            className="hud-card fixed inset-x-4 top-16 z-[1300] mx-auto max-h-[calc(100dvh-5rem)] max-w-80 overflow-y-auto overscroll-contain md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-80 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3.5 py-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900">Platform Guide</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">Find a location. Explore conditions. Share a report.</p>
              </div>
              <button type="button" onClick={onToggle} aria-label="Close guide"
                className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-gakit-maroon"><X className="h-4 w-4" /></button>
            </div>
            <div className="divide-y divide-slate-100 px-3.5">
              {[
                { icon: MapPin, title: 'Check a location', description: 'Search an address or tap the map to see flood, landslide, and storm surge exposure.' },
                { icon: Waves, title: 'Explore flood estimates', description: 'Enable Flood Simulation in Layers, then use the floating player to explore past and forecast estimates.' },
                { icon: Megaphone, title: 'Report flooding', description: 'Choose Report Flooding, pin the location, and enter the water depth. Reports are assessed before appearing publicly.' },
              ].map(({ icon: Icon, title, description }, index) => <div key={title} className="flex items-start gap-2.5 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <h4 className="text-[11px] font-semibold text-slate-800"><span className="mr-1.5 text-[9px] tabular-nums text-slate-400">0{index + 1}</span>{title}</h4>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{description}</p>
                </div>
              </div>)}
            </div>
            <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-3.5 py-3">
              <Link href="/#about" onClick={handleAboutClick} className="flex items-center justify-between text-[10px] font-medium text-slate-500 transition-colors hover:text-gakit-maroon focus-visible:outline-gakit-maroon">About Project GAKIT<ArrowUpRight className="h-3 w-3" aria-hidden="true" /></Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
