'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { LogOut, Map } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PortalNavItem } from './portalTypes';
import { useRouteLoader } from './RouteLoader';

interface SideBarProps<T extends string> {
  activeTab: T;
  items: PortalNavItem<T>[];
  portalSubtitle: string;
  onTabChange: (tab: T) => void;
}

export function SideBar<T extends string>({
  activeTab,
  items,
  portalSubtitle,
  onTabChange,
}: SideBarProps<T>) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { navigate, loadingOverlay } = useRouteLoader();

  async function handleLogOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
    <aside className="hidden lg:flex w-64 shrink-0 bg-white text-slate-900 h-screen flex-col border-r border-slate-200">
      <div className="h-20 px-6 flex items-center gap-3 border-b border-slate-100">
        <div className="flex h-10 w-24 shrink-0 items-center justify-center">
          <Image
            src="/images/gakit_logo2.svg"
            alt="GAKIT logo"
            width={160}
            height={48}
            className="h-full w-full object-contain"
          />
        </div>
        <div>
          <div className="font-bold leading-tight">{portalSubtitle}</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Map className="w-4 h-4 text-gakit-maroon" />
          Public Hazard Map
        </button>

        <div className="pt-4 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </div>
        {items.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeTab === feature.id;

          return (
            <button
              key={feature.id}
              onClick={() => onTabChange(feature.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-gakit-maroon text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`}
              />
              {feature.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-100">
        <button
          onClick={handleLogOut}
          disabled={isSigningOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </aside>
    {loadingOverlay}
    </>
  );
}
