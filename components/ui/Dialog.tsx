'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '@/hooks/useModalA11y';

const DEFAULT_PANEL_CLASS = 'max-h-[calc(100vh-2rem)] overflow-y-auto p-6';

const emptySubscribe = () => () => {};

/** Hydration-safe mount flag so the portal is only created on the client. */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Shared, accessible modal dialog. Handles the concerns every hand-rolled
 * modal in the app previously re-implemented (or forgot): Escape to close,
 * focus trap, focus restoration to the trigger, body scroll lock, `role="dialog"`
 * / `aria-modal` on the panel (not the overlay), and portal rendering into
 * `document.body` so transformed ancestors cannot clip or trap it.
 *
 * `panelClassName` replaces the default padded panel layout, letting complex
 * modals (e.g. a fixed header/footer with a scrolling body) keep their shape.
 */
export function Dialog({
  isOpen,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  maxWidthClass = 'max-w-md',
  panelClassName = DEFAULT_PANEL_CLASS,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  maxWidthClass?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const mounted = useMounted();
  const active = isOpen && mounted;
  const panelRef = useModalA11y<HTMLDivElement>({ enabled: active });

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, onClose]);

  if (!active) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className={`w-full rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 outline-none ${maxWidthClass} ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
