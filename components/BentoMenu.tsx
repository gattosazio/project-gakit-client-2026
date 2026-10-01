'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import { BENTO_MARK_SIZE, type BentoTile } from '@/lib/navigation/bentoMenu';

/**
 * Portals launcher pinned to the portal header, left of the notification bell.
 * Replaces the sidebar entries that used to live in the monitoring portal's
 * left rail.
 */
export function BentoMenu({ items }: { items: BentoTile[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // A tile pointing at the page you are already on is a dead link, so every
  // portal page shows only the places you can still go.
  const visibleItems = items.filter((tile) => tile.href !== pathname);

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
        className={`rounded-full p-1.5 transition-all duration-150 active:scale-95 ${
          isOpen
            ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80'
            : 'text-slate-700 hover:bg-white/80 hover:text-gakit-maroon'
        }`}
      >
        <LayoutGrid className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-16 z-[1300] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/5 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 md:w-[19rem]">
          <div className="border-b border-slate-200/80 px-3.5 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Portals
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2">
            {visibleItems.map((tile) => (
              <Link
                key={tile.id}
                href={tile.href}
                onClick={() => setIsOpen(false)}
                className="group flex flex-col items-center gap-2 rounded-2xl bg-canvas-light p-3 text-center ring-1 ring-black/[0.06] transition-[transform,box-shadow] duration-200 ease-out hover:bg-white hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:transform-none"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-gakit-maroon shadow-sm ring-1 ring-black/[0.06]">
                  <Image
                    src={tile.iconSrc}
                    alt=""
                    width={BENTO_MARK_SIZE}
                    height={BENTO_MARK_SIZE}
                    className="h-7 w-7"
                  />
                </span>

                <span className="min-w-0">
                  <span className="block font-heading text-xs font-bold leading-tight text-slate-900">
                    {tile.label}
                  </span>
                  {tile.badge && (
                    <span className="mt-1 inline-flex rounded bg-amber-100/80 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200">
                      {tile.badge}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
