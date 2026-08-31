'use client';

import { Info } from 'lucide-react';
import type { RefObject } from 'react';

interface HowToReportPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function HowToReportPopover({
  isOpen,
  onToggle,
  containerRef,
}: HowToReportPopoverProps) {
  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`rounded-full p-2 text-slate-500 transition-all duration-150 hover:bg-slate-100/80 hover:text-gakit-maroon active:scale-95 ${
          isOpen ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80 font-bold' : ''
        }`}
        aria-expanded={isOpen}
        aria-label="How to report guide"
      >
        <Info className="h-4.5 w-4.5" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-12 w-72 z-[1201]">
          <div className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.12),inset_0_1px_0_0_rgba(255,255,255,0.9)] backdrop-blur-xl ring-1 ring-slate-200/80">
            <div className="mb-2.5 flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-maroon-50 text-gakit-maroon font-bold text-[11px]">
                ?
              </div>
              <div className="text-xs font-bold text-slate-900">How to report a flood hazard</div>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700">
                  1
                </span>
                <span>Set location (search, tap, or use GPS).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700">
                  2
                </span>
                <span>Choose scale reference & estimate waterline.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700">
                  3
                </span>
                <span>Submit report to alert responders & community.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
