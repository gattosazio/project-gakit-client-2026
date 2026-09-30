'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { BENTO_MARK_SIZE, type BentoTile } from '@/lib/navigation/bentoMenu';

/**
 * Portals launcher pinned to the floating portal header, left of the
 * notification bell. Replaces the sidebar entries that used to live in the
 * monitoring portal's left rail.
 */
export function BentoMenu({ items }: { items: BentoTile[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // A full-width "home" row is a shortcut back to the portal, so it goes
  // redundant while you are already there. Feature tiles always render.
  const visibleItems = items.filter((tile) => !(tile.wide && tile.href === pathname));

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Open portals menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`rounded-full p-2 transition-all duration-150 active:scale-95 ${
          isOpen
            ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80'
            : 'text-slate-700 hover:bg-white/80 hover:text-gakit-maroon'
        }`}
      >
        <LayoutGrid className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-16 z-[1300] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/5 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 md:w-[24rem]">
          <div className="border-b border-slate-200/80 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Portals
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-3">
            {visibleItems.map((tile) => (
              <Link
                key={tile.id}
                href={tile.href}
                onClick={() => setIsOpen(false)}
                className={
                  tile.wide
                    ? 'group col-span-2 flex items-center gap-3.5 rounded-[22px] bg-gradient-to-r from-gakit-maroon to-maroon-800 p-3.5 text-white shadow-[0_2px_8px_rgba(123,17,19,0.28)] transition-[transform,box-shadow] duration-200 ease-out hover:from-maroon-800 hover:to-maroon-900 hover:shadow-[0_4px_12px_rgba(123,17,19,0.35)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:transform-none'
                    : 'group flex flex-col items-center gap-2.5 rounded-[22px] bg-canvas-light p-4 text-center ring-1 ring-black/[0.06] transition-[transform,box-shadow] duration-200 ease-out hover:bg-white hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:transform-none'
                }
              >
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                    tile.wide
                      ? 'bg-white/15 text-white ring-1 ring-white/25'
                      : 'bg-white text-gakit-maroon shadow-sm ring-1 ring-black/[0.06]'
                  }`}
                >
                  <Image
                    src={tile.iconSrc}
                    alt=""
                    width={BENTO_MARK_SIZE}
                    height={BENTO_MARK_SIZE}
                    className="h-9 w-9"
                  />
                </span>

                <span className={tile.wide ? 'min-w-0 flex-1' : 'min-w-0'}>
                  <span
                    className={`block font-heading text-[13px] font-bold leading-tight ${
                      tile.wide ? 'text-left text-white' : 'text-slate-900'
                    }`}
                  >
                    {tile.label}
                  </span>
                  {tile.badge && (
                    <span className="mt-1 inline-flex rounded bg-amber-100/80 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200">
                      {tile.badge}
                    </span>
                  )}
                </span>

                {tile.wide && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/70 transition-transform duration-200 group-hover:translate-x-0.5" />
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
