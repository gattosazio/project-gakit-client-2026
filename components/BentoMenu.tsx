'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutGrid, MapPin, Waves, Activity, BookOpen } from 'lucide-react';
import type { BentoTile } from '@/lib/navigation/bentoMenu';
import { useRouteLoader } from './RouteLoader';

function getTileIcon(id: string) {
  switch (id) {
    case 'public-hazard-map':
      return <MapPin className="h-5 w-5 text-rose-700" />;
    case 'flood-scenarios':
      return <Waves className="h-5 w-5 text-sky-600" />;
    case 'monitoring-portal':
      return <Activity className="h-5 w-5 text-emerald-700" />;
    case 'about':
      return <BookOpen className="h-5 w-5 text-indigo-700" />;
    default:
      return <LayoutGrid className="h-5 w-5 text-slate-700" />;
  }
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
      if (isControlled) {
        onOpenChange?.(nextValue);
      } else {
        setInternalIsOpen(nextValue);
      }
    },
    [isControlled, isOpen, onOpenChange]
  );
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(event.target as Node)) setIsOpen(false);
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

  // Filter out the tile representing the current active surface so the menu only offers new destinations
  const displayItems = useMemo(() => {
    const filtered = items.filter((tile) => !getIsCurrent(tile));
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
                className={`group flex w-full items-center justify-center rounded-xl py-2 text-sm font-semibold transition-all duration-150 ${
                  isCurrent
                    ? 'bg-slate-200 text-slate-900 cursor-default font-bold'
                    : 'text-slate-600 hover:bg-white hover:text-gakit-maroon hover:shadow-xs'
                }`}
              >
                <div className="relative shrink-0">
                  {tile.iconSrc ? (
                    <Image
                      src={tile.iconSrc}
                      alt=""
                      width={22}
                      height={22}
                      className="h-5 w-5 object-contain transition-transform group-hover:scale-105"
                    />
                  ) : (
                    getTileIcon(tile.id)
                  )}
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
              className={`group relative flex flex-col items-center justify-center rounded-xl border py-2 px-1 text-center transition-all duration-150 ${
                isCurrent
                  ? 'bg-slate-200 text-slate-900 border-slate-300/80 shadow-xs cursor-default font-bold'
                  : 'bg-white/80 border-slate-200/80 text-slate-600 hover:bg-white hover:border-slate-300 hover:text-gakit-maroon hover:shadow-xs hover:-translate-y-0.5 active:scale-[0.98]'
              }`}
            >
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center transition-transform duration-150 group-hover:scale-105">
                  {tile.iconSrc ? (
                    <Image
                      src={tile.iconSrc}
                      alt=""
                      width={32}
                      height={32}
                      className="h-7 w-7 object-contain drop-shadow-xs"
                    />
                  ) : (
                    getTileIcon(tile.id)
                  )}
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
        aria-label="Open apps menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={
          isMobileNav
            ? `relative flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-95 ${
                isOpen
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon active:bg-slate-100'
              }`
            : `flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-gakit-maroon active:scale-95 ${
                isOpen
                  ? 'bg-slate-200 text-slate-900 ring-1 ring-slate-300/80'
                  : ''
              }`
        }
      >
        <LayoutGrid
          className={
            isMobileNav
              ? `h-5 w-5 ${
                  isOpen
                    ? 'text-gakit-maroon'
                    : 'text-slate-500'
                }`
              : `h-5 w-5 ${isOpen ? 'text-gakit-maroon' : ''}`
          }
        />
        {isMobileNav && (
          <span className="text-[10px] font-semibold">Apps</span>
        )}
      </button>

      {isOpen && (
        <div
          className={
            isMobileNav
              ? 'fixed inset-x-4 bottom-20 z-[1300] mx-auto max-w-[250px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-slate-900/10 md:hidden animate-in fade-in slide-in-from-bottom-2 duration-150'
              : 'fixed inset-x-4 top-16 z-[1300] mx-auto max-w-[250px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-xl backdrop-blur-xl ring-1 ring-slate-900/10 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-[14.5rem] md:max-w-none animate-in fade-in zoom-in-95 duration-100'
          }
        >
          {/* Bento Header */}
          <div className="px-1 pb-1.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="font-heading text-[9px] font-bold uppercase tracking-wider text-slate-400">
              GAKIT Apps
            </span>
          </div>

          {/* Bento Grid (2 columns x 1 row) */}
          <div className="grid grid-cols-2 gap-1.5">
            {displayItems.map((tile) => {
              const isCurrent = getIsCurrent(tile);
              return (
                <Link
                  key={tile.id}
                  href={tile.href}
                  onClick={(e) => handleTileClick(e, tile, isCurrent)}
                  title={tile.badge ? `${tile.label} (${tile.badge})` : tile.label}
                  className={`group relative flex flex-col items-center justify-center gap-1 rounded-xl border py-2 px-1.5 text-center transition-all duration-150 ${
                    isCurrent
                      ? 'bg-slate-200 border-slate-300 text-slate-900 shadow-xs cursor-default font-bold'
                      : 'bg-white/80 border-slate-200/80 text-slate-600 hover:bg-white hover:border-slate-300 hover:text-gakit-maroon hover:shadow-xs active:scale-[0.98]'
                  }`}
                >
                  <div className="relative">
                    <div className="flex h-9 w-9 items-center justify-center transition-transform duration-150 group-hover:scale-105">
                      {tile.iconSrc ? (
                        <Image
                          src={tile.iconSrc}
                          alt=""
                          width={36}
                          height={36}
                          className="h-8 w-8 object-contain drop-shadow-xs"
                        />
                      ) : (
                        getTileIcon(tile.id)
                      )}
                    </div>
                    {tile.badge && (
                      <sup className="absolute -top-1 -right-2 select-none rounded bg-amber-100/90 px-1 py-0.5 text-[7px] font-extrabold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200/70 leading-none shadow-xs">
                        {tile.badge}
                      </sup>
                    )}
                  </div>

                  <span className="font-heading text-[10.5px] font-bold leading-tight transition-colors line-clamp-1 text-slate-800 group-hover:text-gakit-maroon">
                    {tile.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
