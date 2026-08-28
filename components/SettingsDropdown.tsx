'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Monitor, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { ROLE_ADMIN, type StaffRole } from '@/lib/auth/roles';

/**
 * Account/portal menu behind the header gear icon. Everyone signed into a
 * portal sees "Settings"; on the monitoring portal administrators additionally
 * see "Administration", which is swapped for "Monitoring Portal" while already
 * inside the admin portal so the menu never lists the current portal.
 */
export function SettingsDropdown({ role }: { role: StaffRole | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [isOpen]);

  const go = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Open settings"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`rounded-full p-2.5 ring-1 transition-colors ${
          isOpen
            ? 'bg-maroon-50 ring-gakit-maroon'
            : 'bg-slate-50 ring-slate-200 hover:bg-maroon-50 hover:text-gakit-maroon hover:ring-maroon-200'
        }`}
      >
        <Settings className="h-5 w-5 text-slate-600" />
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-24 z-[1300] overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 md:w-56">
          <div className="border-b border-canvas-grey px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Settings
            </p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => go('/settings')}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-canvas-light"
            >
              <UserRound className="h-4 w-4 text-slate-400" />
              Settings
            </button>
            {role === ROLE_ADMIN && (pathname.startsWith('/admin') ? (
              <button
                type="button"
                onClick={() => go('/monitoring')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-canvas-light"
              >
                <Monitor className="h-4 w-4 text-slate-400" />
                Monitoring Portal
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go('/admin')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-canvas-light"
              >
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                Administration
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}