'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';

export function SectionJumpControls({
  showUp,
  showDown,
  onMoveUp,
  onMoveDown,
}: {
  showUp: boolean;
  showDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <>
      {showUp && (
        <button
          type="button"
          onClick={onMoveUp}
          className="fixed left-1/2 top-20 z-[1100] flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-slate-500/50 bg-slate-700/30 text-white shadow-lg backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:bg-slate-700/50"
          aria-label="Move to previous section"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      {showDown && (
        <button
          type="button"
          onClick={onMoveDown}
          className="fixed left-1/2 bottom-4 z-[1250] hidden h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-slate-500/50 bg-slate-700/30 text-white shadow-lg backdrop-blur-sm transition-transform hover:translate-y-0.5 hover:bg-slate-700/50 md:flex"
          aria-label="Move to next section"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
    </>
  );
}
