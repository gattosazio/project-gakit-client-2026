'use client';

import { ChevronUp } from 'lucide-react';

export function SectionJumpControls({
  showUp,
  onMoveUp,
}: {
  showUp: boolean;
  onMoveUp: () => void;
}) {
  if (!showUp) return null;

  return (
    <button
      type="button"
      onClick={onMoveUp}
      className="fixed left-1/2 top-20 z-[1100] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-slate-700 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/80 backdrop-blur-md transition-all duration-150 hover:bg-slate-50 hover:text-gakit-maroon hover:shadow-2xl active:opacity-90"
      aria-label="Back to hazard map"
    >
      <ChevronUp className="h-4 w-4 text-gakit-maroon" />
      <span>Back to Map</span>
    </button>
  );
}
