'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Shared modal a11y behaviour: moves focus into the container on open, traps
 * Tab / Shift+Tab inside it, optionally locks body scroll, and restores focus
 * to the trigger on close. Escape handling is intentionally left to the caller
 * (some surfaces — e.g. `ReportDetail` — route Escape to an inner lightbox
 * before the container).
 *
 * Attach the returned ref to the element that should act as the focus scope.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  enabled = true,
  initialFocus = true,
  restoreFocus = true,
  lockScroll = true,
}: {
  enabled?: boolean;
  initialFocus?: boolean;
  restoreFocus?: boolean;
  lockScroll?: boolean;
} = {}): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusable = () =>
      container
        ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        : [];

    if (initialFocus && container && !container.contains(document.activeElement)) {
      (getFocusable()[0] ?? container).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !container) return;
      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (lockScroll) document.body.style.overflow = previousOverflow;
      if (restoreFocus) previouslyFocused.current?.focus();
    };
  }, [enabled, initialFocus, restoreFocus, lockScroll]);

  return containerRef;
}
