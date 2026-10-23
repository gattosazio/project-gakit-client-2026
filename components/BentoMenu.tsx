'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutGrid, LogOut } from 'lucide-react';
import type { BentoTile } from '@/lib/navigation/bentoMenu';
import { useRouteLoader } from './RouteLoader';

const MENU_ICON_ART: Record<string, React.ReactNode> = {
  'public-hazard-map': <>
    <path d="M3 8L11 4L21 8L29 4V25L21 29L11 25L3 29Z" fill="#ecfdf5" stroke="#409277" />
    <path d="M11 4V25L21 29V8Z" fill="#c3e6d4" />
    <path d="M5 21C9 17 12 22 16 18S24 19 27 15" stroke="#38a3c5" strokeWidth="2" />
    <path d="M26 10C26 14 21 18 21 18S16 14 16 10A5 5 0 0 1 26 10Z" fill="#9b1c31" stroke="#7a0019" />
    <circle cx="21" cy="10" r="1.7" fill="white" />
  </>,
  'flood-scenarios': <>
    <path d="M8 13L16 6L24 13V24H8Z" fill="#e0f2fe" stroke="#7db4cf" />
    <path d="M5 14L16 4L27 14" stroke="#164e63" strokeWidth="2.5" />
    <rect x="13" y="12" width="6" height="6" rx="1" fill="#164e63" />
    <path d="M3 21C7 18 11 24 16 21S25 18 29 21V28H3Z" fill="#0284c7" />
    <path d="M5 25C9 22 12 28 17 25S25 23 27 24" stroke="#bae6fd" strokeWidth="1.8" />
  </>,
  'monitoring-portal': <>
    <rect x="3" y="4" width="26" height="23" rx="5" fill="#173b49" />
    <path d="M3 11H29" stroke="#34616f" />
    <circle cx="7" cy="7.5" r="1" fill="#6ee7b7" />
    <path d="M7 20H11L14 14L18 23L21 17H25" stroke="#6ee7b7" strokeWidth="2" />
    <path d="M12 30H20" stroke="#173b49" strokeWidth="2" />
  </>,
  login: <>
    <rect x="9" y="3" width="19" height="26" rx="4" fill="#e0e7ff" stroke="#818cf8" />
    <path d="M16 7L25 5V27L16 25Z" fill="#6366f1" />
    <circle cx="22" cy="16" r="1" fill="white" />
    <path d="M3 16H16M11 11L16 16L11 21" stroke="#3730a3" strokeWidth="2.3" />
  </>,
  administration: <>
    <path d="M16 2L27 7V16C27 23 21 28 16 30C11 28 5 23 5 16V7Z" fill="#7a0019" />
    <path d="M16 6L23 9V16C23 21 19 25 16 26C13 25 9 21 9 16V9Z" fill="#a9314d" />
    <path d="M11 16L15 20L22 12" stroke="#fde68a" strokeWidth="2.4" />
  </>,
  about: <>
    <path d="M16 7C12 4 7 4 3 6V26C7 24 12 24 16 27C20 24 25 24 29 26V6C25 4 20 4 16 7Z" fill="#fff7ed" stroke="#c2823d" />
    <path d="M16 7V27M7 11L12 12M7 16L12 17M20 12L25 11M20 17L25 16" stroke="#c2823d" />
  </>,
};

function getTileIcon(id: string) {
  const art = MENU_ICON_ART[id];
  return art
    ? <svg className="h-6 w-6" viewBox="0 0 32 32" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{art}</svg>
    : <LayoutGrid className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />;
}

export interface BentoMenuProps {
  items: BentoTile[];
  variant?: 'header' | 'mobile-nav' | 'sidebar';
  isCollapsed?: boolean;
  className?: string;
  onNavigate?: (href: string) => void;
  onNavigateSection?: (id: 'hazard-map' | 'about') => void;
  activeSection?: 'hazard-map' | 'about';
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSignOut?: () => void;
  isSigningOut?: boolean;
}

export function BentoMenu({
  items,
  variant = 'header',
  isCollapsed = false,
  className = '',
  onNavigate,
  onNavigateSection,
  activeSection,
  isOpen: controlledIsOpen,
  onOpenChange,
  onSignOut,
  isSigningOut = false,
}: BentoMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { navigate: globalNavigate } = useRouteLoader();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const nextValue = typeof next === 'function' ? next(isOpen) : next;
      if (!isControlled) {
        setInternalIsOpen(nextValue);
      }
      onOpenChange?.(nextValue);
    },
    [isControlled, isOpen, onOpenChange]
  );
  const ref = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('touchstart', close, { passive: true });
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('touchstart', close);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onResize = () => setIsOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen, setIsOpen]);

  const handleTileClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    tile: BentoTile,
    isCurrent: boolean
  ) => {
    // Allow middle click / new tab / modifier shortcuts
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    // Always dismiss popover on selection
    setIsOpen(false);

    // If tapping the currently active tile, prevent reload and exit
    if (isCurrent) {
      e.preventDefault();
      return;
    }

    // In-page smooth scrolling when already on the landing page
    if (tile.id === 'about' && pathname === '/') {
      e.preventDefault();
      if (onNavigateSection) {
        onNavigateSection('about');
      } else {
        document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (tile.id === 'public-hazard-map' && pathname === '/') {
      e.preventDefault();
      if (onNavigateSection) {
        onNavigateSection('hazard-map');
      } else {
        document.getElementById('hazard-map')?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // Cross-page portal redirects (e.g. /flood-scenarios, /monitoring, or / from subpages):
    e.preventDefault();
    if (onNavigate) {
      onNavigate(tile.href);
    } else {
      globalNavigate(tile.href);
    }
  };

  const isMobileNav = variant === 'mobile-nav';
  const isSidebar = variant === 'sidebar';

  const getIsCurrent = (tile: BentoTile) => {
    if (tile.id === 'about') {
      return pathname === '/' && activeSection === 'about';
    }
    if (tile.id === 'public-hazard-map') {
      return pathname === '/' && activeSection !== 'about';
    }
    if (tile.href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(tile.href);
  };

  // Keep About discoverable; hide the tile for the active portal.
  const displayItems = useMemo(() => {
    const filtered = items.filter((tile) => tile.id === 'about' || !getIsCurrent(tile));
    return filtered.length > 0 ? filtered : items;
  }, [items, pathname, activeSection]);

  // When rendered in the sidebar, embed the 2x1 bento grid directly into the document flow
  if (isSidebar) {
    if (isCollapsed) {
      return (
        <div className={`space-y-1 ${className}`}>
          {displayItems.map((tile) => {
            const isCurrent = getIsCurrent(tile);
            return (
              <Link
                key={tile.id}
                href={tile.href}
                onClick={(e) => handleTileClick(e, tile, isCurrent)}
                title={tile.badge ? `${tile.label} (${tile.badge})` : tile.label}
                className={`group flex w-full items-center justify-center rounded-xl py-2 text-sm font-semibold transition-colors duration-150 ${
                  isCurrent
                    ? 'bg-slate-200 text-slate-900 cursor-default font-bold'
                    : 'text-slate-600 hover:bg-white hover:text-gakit-maroon'
                }`}
              >
                <div className="relative shrink-0 text-gakit-maroon">
                  {getTileIcon(tile.id)}
                  {tile.badge && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      );
    }

    return (
      <div className={`grid grid-cols-2 gap-1.5 ${className}`}>
        {displayItems.map((tile) => {
          const isCurrent = getIsCurrent(tile);
          return (
            <Link
              key={tile.id}
              href={tile.href}
              onClick={(e) => handleTileClick(e, tile, isCurrent)}
              title={tile.badge ? `${tile.label} (${tile.badge})` : tile.label}
              className={`group relative flex flex-col items-center justify-center rounded-xl border py-2 px-1 text-center transition-colors duration-150 ${
                isCurrent
                  ? 'bg-slate-200 text-slate-900 border-slate-300/80 shadow-xs cursor-default font-bold'
                  : 'bg-white/80 border-slate-200/80 text-slate-600 hover:bg-white hover:border-slate-300 hover:text-gakit-maroon'
              }`}
            >
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center ">
                  {getTileIcon(tile.id)}
                </div>
                {tile.badge && (
                  <sup className="absolute -top-1 -right-2 select-none rounded bg-amber-100/90 px-1 py-0.5 text-[6.5px] font-extrabold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200/70 leading-none shadow-xs">
                    {tile.badge}
                  </sup>
                )}
              </div>
              <span className="mt-1 font-heading text-[10px] font-bold leading-tight transition-colors line-clamp-1 text-slate-700 group-hover:text-gakit-maroon">
                {tile.label}
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  const popup = isOpen ? (
        <div
          ref={popupRef}
          className={
            isMobileNav
              ? 'fixed inset-x-1.5 bottom-[calc(max(0.375rem,env(safe-area-inset-bottom,0px))+3.75rem)] z-[1300] mx-auto max-h-[calc(100dvh-6rem-env(safe-area-inset-bottom,0px))] max-w-[280px] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-slate-900/10 md:hidden animate-in fade-in slide-in-from-bottom-2 duration-150'
              : 'fixed inset-x-1.5 top-16 z-[1300] mx-auto max-h-[calc(100dvh-5rem)] max-w-[280px] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-xl ring-1 ring-slate-900/10 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-72 md:max-w-none animate-in fade-in zoom-in-95 duration-100'
          }
        >
          {/* Bento Header */}
          <div className="px-1 pb-1.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="font-heading text-[9px] font-bold uppercase tracking-wider text-slate-400">
              MENU
            </span>
          </div>

          {/* Portal destinations */}
          <div className="grid grid-cols-2 gap-1.5">
            {displayItems.map((tile) => {
              const isCurrent = getIsCurrent(tile);
              return (
                <Link
                  key={tile.id}
                  href={tile.href}
                  onClick={(e) => handleTileClick(e, tile, isCurrent)}
                  title={tile.badge ? `${tile.label} (${tile.badge})` : tile.label}
                  className={`group relative flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors duration-150 ${
                    isCurrent
                      ? 'bg-slate-200 border-slate-300 text-slate-900 shadow-xs cursor-default font-bold'
                      : 'bg-white/80 border-slate-200/80 text-slate-600 hover:bg-white hover:border-slate-300 hover:text-gakit-maroon'
                  }`}
                >
                  <div className="relative">
                    <div className="flex h-9 w-9 items-center justify-center ">
                      {getTileIcon(tile.id)}
                    </div>
                    {tile.badge && (
                      <sup className="absolute -top-1 -right-2 select-none rounded bg-amber-100/90 px-1 py-0.5 text-[7px] font-extrabold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200/70 leading-none shadow-xs">
                        {tile.badge}
                      </sup>
                    )}
                  </div>

                  <span className="font-heading text-[11px] font-bold leading-tight transition-colors line-clamp-1 text-slate-800 group-hover:text-gakit-maroon">
                    {tile.label}
                  </span>
                </Link>
              );
            })}
          </div>
          {onSignOut && <div className="mt-2 border-t border-slate-200/70 pt-1">
            <button type="button" disabled={isSigningOut}
              onClick={() => { setIsOpen(false); onSignOut(); }}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-gakit-maroon disabled:opacity-50">
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>}
        </div>
  ) : null;

  return (
    <div
      ref={ref}
      className={
        isMobileNav
          ? `relative flex w-full flex-col items-center justify-center ${className}`
          : `relative ${className}`
      }
    >
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={
          isMobileNav
            ? `relative flex h-10 w-full flex-col items-center justify-center gap-0.5 rounded-full px-2 transition-colors duration-150 ${
                isOpen
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon active:bg-slate-100'
              }`
            : `flex h-10 min-w-10 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[9px] font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-gakit-maroon md:h-9 md:flex-row md:gap-1.5 md:px-2.5 md:text-[11px] ${
                isOpen
                  ? 'bg-slate-200 text-slate-900 ring-1 ring-slate-300/80'
                  : ''
              }`
        }
      >
        <LayoutGrid
          strokeWidth={1.75}
          aria-hidden="true"
          className={
            isMobileNav
              ? `h-5 w-5 ${
                  isOpen
                    ? 'text-gakit-maroon'
                    : 'text-slate-500'
                }`
              : `h-4 w-4 ${isOpen ? 'text-gakit-maroon' : ''}`
          }
        />
        {isMobileNav && (
          <span className="text-[10px] font-semibold">Menu</span>
        )}
        {!isMobileNav && <span>Menu</span>}
      </button>

      {isMobileNav && typeof document !== 'undefined' ? createPortal(popup, document.body) : popup}
    </div>
  );
}
