'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutGrid, LogOut } from 'lucide-react';
import type { BentoTile } from '@/lib/navigation/bentoMenu';
import { useRouteLoader } from './RouteLoader';

// Flat geometric artwork: a shared square grid, rounded corners, distinct colors.
const MENU_ICON_ART: Record<string, React.ReactNode> = {
  'public-hazard-map': <>
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#e1eee5" />
    <path d="M3 13H12V4M12 13V28M12 21H29M21 21V12" stroke="#86ad96" strokeWidth="1.6" />
    <path d="M4 23L9 18L14 18L19 12L27 12" stroke="#4993ae" strokeWidth="2.2" />
    <path d="M25 8V11L20 17L15 11V8A5 5 0 0 1 25 8Z" fill="#8e2940" />
    <rect x="18.3" y="6.8" width="3.4" height="3.4" rx="1" fill="#fff" />
  </>,
  'flood-scenarios': <>
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#e0edf3" />
    <path d="M3 10H13M10 3V18M5 15H16" stroke="#a5c6d3" strokeWidth="1.5" />
    <path d="M3 19C7 16 10 22 14 19S22 16 29 19V25A4 4 0 0 1 25 29H7A4 4 0 0 1 3 25Z" fill="#318cba" />
    <path d="M7 24C10 22 12 26 16 24S22 22 25 24" stroke="#bfe6f5" strokeWidth="1.6" />
    <circle cx="20.5" cy="10.5" r="4.2" fill="#f5fafc" stroke="#315c70" strokeWidth="2.2" />
    <path d="M23.5 13.5L27 17" stroke="#315c70" strokeWidth="2.8" />
  </>,
  'monitoring-portal': <>
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#284e5b" />
    <path d="M3 11H29" stroke="#557883" strokeWidth="1.4" />
    <rect x="7" y="7" width="3" height="1.5" rx=".5" fill="#b4dfcf" />
    <path d="M7 23V19H11V15H16V20H21V16H25" stroke="#a2ddc4" strokeWidth="2.2" />
  </>,
  login: <>
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#dedcf0" />
    <path d="M15 8H23V25H15" stroke="#7769a2" strokeWidth="2" />
    <rect x="19.5" y="15" width="2" height="2" rx=".5" fill="#7769a2" />
    <path d="M7 16H18M13 11L18 16L13 21" stroke="#65548f" strokeWidth="2.5" />
  </>,
  administration: <>
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#8e2940" />
    <path d="M9 7H23V17L20 21L16 24L12 21L9 17Z" fill="#af5266" />
    <path d="M10 16L14 20L22 12" stroke="#f6dc9b" strokeWidth="2.5" />
  </>,
  about: <>
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#eee2ce" />
    <path d="M16 4V28" stroke="#b89663" strokeWidth="1.6" />
    <path d="M7 11H12M7 16H12M7 21H12M20 11H25M20 16H25M20 21H25" stroke="#b89663" strokeWidth="1.6" />
  </>,
};

function getTileIcon(id: string, large = false) {
  const art = MENU_ICON_ART[id];
  return art
    ? <svg className={large ? 'h-10 w-10' : 'h-6 w-6'} viewBox="0 0 32 32" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{art}</svg>
    : <LayoutGrid className={large ? 'h-10 w-10' : 'h-6 w-6'} strokeWidth={1.75} aria-hidden="true" />;
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
                <div className="flex h-12 w-12 items-center justify-center">
                  {getTileIcon(tile.id, true)}
                </div>
                {tile.badge && (
                  <sup className="absolute -top-1 -right-2 select-none rounded bg-amber-100/90 px-1 py-0.5 text-[6.5px] font-extrabold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200/70 leading-none shadow-xs">
                    {tile.badge}
                  </sup>
                )}
              </div>
              <span className="mt-1 font-heading text-[10px] font-bold leading-tight transition-colors line-clamp-2 text-slate-700 group-hover:text-gakit-maroon">
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
          data-header-dropdown={!isMobileNav || undefined}
          className={
            isMobileNav
              ? 'fixed inset-x-1.5 bottom-[calc(max(0.375rem,env(safe-area-inset-bottom,0px))+3.75rem)] z-[1300] mx-auto max-h-[calc(100dvh-6rem-env(safe-area-inset-bottom,0px))] max-w-[280px] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-slate-900/10 md:hidden animate-in fade-in slide-in-from-bottom-2 duration-150'
              : 'map-header-dropdown fixed inset-x-1.5 top-16 z-[1300] mx-auto max-h-[calc(100dvh-5rem)] max-w-[280px] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-xl ring-1 ring-slate-900/10 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-72 md:max-w-none animate-in fade-in zoom-in-95 duration-100'
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
                  className={`group relative flex aspect-square min-h-[108px] flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-center transition-colors duration-150 ${
                    isCurrent
                      ? 'bg-slate-200 border-slate-300 text-slate-900 shadow-xs cursor-default font-bold'
                      : 'bg-white/80 border-slate-200/80 text-slate-600 hover:bg-white hover:border-slate-300 hover:text-gakit-maroon'
                  }`}
                >
                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center transition-transform duration-150 group-hover:-translate-y-0.5 motion-reduce:transform-none">
                      {getTileIcon(tile.id, true)}
                    </div>
                    {tile.badge && (
                      <sup className="absolute -top-1 -right-2 select-none rounded bg-amber-100/90 px-1 py-0.5 text-[7px] font-extrabold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200/70 leading-none shadow-xs">
                        {tile.badge}
                      </sup>
                    )}
                  </div>

                  <span className="font-heading text-[11px] font-bold leading-tight transition-colors line-clamp-2 text-slate-800 group-hover:text-gakit-maroon">
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
