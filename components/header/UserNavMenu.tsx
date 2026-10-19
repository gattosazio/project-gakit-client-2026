'use client';

import { LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { RefObject } from 'react';

interface UserNavMenuProps {
  name?: string | null;
  email: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSignOutClick: () => void;
  isSigningOut?: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
  variant?: 'header' | 'mobile-nav';
}

export function UserNavMenu({
  name,
  email,
  isOpen,
  onToggle,
  onSignOutClick,
  isSigningOut = false,
  containerRef,
  variant = 'header',
}: UserNavMenuProps) {
  if (!email && !name) return null;

  const isMobileNav = variant === 'mobile-nav';

  return (
    <div
      ref={containerRef}
      className={
        isMobileNav
          ? 'relative flex w-full flex-col items-center justify-center'
          : 'relative'
      }
    >
      <button
        type="button"
        onClick={onToggle}
        className={
          isMobileNav
            ? `relative flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-95 ${
                isOpen
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon active:bg-slate-100'
              }`
            : `flex h-10 min-w-10 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[9px] font-semibold text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-gakit-maroon active:scale-95 md:h-9 md:flex-row md:gap-1.5 md:px-2.5 md:text-[11px] ${
                isOpen ? 'bg-slate-200 text-slate-900 ring-1 ring-slate-300/80 font-bold' : ''
              }`
        }
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <UserRound className={`${isMobileNav ? 'h-5 w-5' : 'h-4 w-4'} ${isOpen ? 'text-gakit-maroon' : isMobileNav ? 'text-slate-500' : 'text-slate-600'}`} />
        {isMobileNav && (
          <span className="text-[10px] font-semibold">Profile</span>
        )}
        {!isMobileNav && <span>Account</span>}
      </button>
      {isOpen && (
        <div
          className={
            isMobileNav
              ? 'fixed inset-x-4 bottom-20 z-[1300] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-slate-900/10 md:hidden animate-in fade-in slide-in-from-bottom-2 duration-150'
              : 'absolute right-0 top-12 z-50 w-56 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl ring-1 ring-slate-200/80 animate-in fade-in zoom-in-95 duration-100'
          }
        >
          <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-slate-100">
            <span className="font-heading text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Account
            </span>
          </div>
          <div className="break-all px-2 py-2 text-sm font-semibold text-slate-700">
            {name || email}
          </div>
          <Link href="/settings#account" onClick={onToggle}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
            <Settings className="h-4 w-4" />Settings
          </Link>
          <button
            type="button"
            onClick={onSignOutClick}
            disabled={isSigningOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 text-red-500" />
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
