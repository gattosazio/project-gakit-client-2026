'use client';

import { LogOut, UserRound } from 'lucide-react';
import type { RefObject } from 'react';

interface UserNavMenuProps {
  email: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSignOutClick: () => void;
  isSigningOut?: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function UserNavMenu({
  email,
  isOpen,
  onToggle,
  onSignOutClick,
  isSigningOut = false,
  containerRef,
}: UserNavMenuProps) {
  if (!email) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center justify-center rounded-full p-2 text-slate-500 transition-all duration-150 hover:bg-slate-100/80 hover:text-gakit-maroon active:scale-95 ${
          isOpen ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80 font-bold' : ''
        }`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <UserRound className="h-4.5 w-4.5" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl ring-1 ring-slate-200/80">
          <div className="break-all border-b border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700">
            {email}
          </div>
          <button
            type="button"
            onClick={onSignOutClick}
            disabled={isSigningOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 text-red-500" />
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
