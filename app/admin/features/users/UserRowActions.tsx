'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVertical, MailPlus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { UserStatus } from '@/types/admin';

const MENU_WIDTH = 208;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Kebab (three-dot) actions menu for a user row. Renders the menu in a portal so
 * it is never clipped by the table's `overflow` containers, positioning itself
 * to stay inside the viewport (flipping above the trigger near the bottom edge).
 */
export function UserRowActions({
  userLabel,
  status,
  busy = false,
  onEditRole,
  onResendInvite,
  onToggleStatus,
}: {
  userLabel: string;
  status: UserStatus;
  busy?: boolean;
  onEditRole: () => void;
  onResendInvite: () => void;
  onToggleStatus: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSuspended = status === 'suspended';
  const isPending = status === 'pending';

  const reposition = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 96;
    const openUp = rect.bottom + menuHeight + MENU_GAP > window.innerHeight - VIEWPORT_MARGIN;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN
    );
    const top = openUp ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP;
    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${userLabel}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <Spinner size="sm" />
        ) : (
          <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Actions for ${userLabel}`}
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed z-[2200] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5"
          >
            <button
              type="button"
              role="menuitem"
              onClick={choose(onEditRole)}
              className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gakit-maroon/30"
            >
              <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Edit role
            </button>
            {isPending && (
              <button
                type="button"
                role="menuitem"
                onClick={choose(onResendInvite)}
                className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gakit-maroon/30"
              >
                <MailPlus className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Resend invitation
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={choose(onToggleStatus)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gakit-maroon/30 ${
                isSuspended ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {isSuspended ? (
                <UserCheck className="h-4 w-4" aria-hidden="true" />
              ) : (
                <UserX className="h-4 w-4" aria-hidden="true" />
              )}
              {isSuspended ? 'Reactivate' : 'Deactivate'}
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
