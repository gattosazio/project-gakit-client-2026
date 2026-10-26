'use client';

import type { RefObject } from 'react';
import { Check, type LucideIcon } from 'lucide-react';

export interface ModalGuideContent {
  icon: LucideIcon;
  text: string;
}

interface ModalGuideStripProps extends ModalGuideContent {
  onDismiss: () => void;
  headingRef?: RefObject<HTMLParagraphElement | null>;
}

/**
 * Compact first-run guidance for the map's task modals. It lives in a fixed bar
 * above the footer, outside the scrolling form, so opening or dismissing it
 * never changes the form's scroll position.
 */
export function ModalGuideStrip({
  icon: Icon,
  text,
  onDismiss,
  headingRef,
}: ModalGuideStripProps) {
  return (
    <div
      role="note"
      aria-label="Quick guide"
      className="flex items-start gap-2"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <p
        ref={headingRef}
        tabIndex={-1}
        className="min-w-0 flex-1 rounded text-[11px] font-medium leading-4 text-amber-950 outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
      >
        <span className="block">{text}</span>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Got it, hide quick guide"
        className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-md bg-white px-2.5 text-[10px] font-semibold text-gakit-maroon ring-1 ring-amber-200 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
      >
        <Check className="h-3 w-3" aria-hidden="true" />
        Got it
      </button>
    </div>
  );
}
