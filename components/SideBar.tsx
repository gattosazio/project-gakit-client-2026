'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useEffect } from 'react';
import Image from 'next/image';
import { LogOut, Map, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, type StaffRole } from '@/lib/auth/roles';
import { PortalNavItem } from './portalTypes';
import { useRouteLoader } from './RouteLoader';

interface SideBarProps<T extends string> {
  activeTab: T;
  items: PortalNavItem<T>[];
  portalSubtitle: string;
  onTabChange: (tab: T) => void;
}

export function MobileSignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        title="Sign out"
        aria-label="Sign out"
        className="rounded-lg border border-canvas-grey p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <LogOut className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="flex flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <LogOut className="h-5 w-5" />
      <span className="truncate">{isSigningOut ? '...' : 'Sign out'}</span>
    </button>
  );
}

export function SideBar<T extends string>({
  activeTab,
  items,
  portalSubtitle,
  onTabChange,
}: SideBarProps<T>) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const { navigate, loadingOverlay } = useRouteLoader();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      setEmail(data.user.email ?? null);
      getStaffRole(supabase, data.user.id).then((staffRole) => {
        if (!cancelled) setRole(staffRole);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3">
          <UserRound className="h-4 w-4 shrink-0 text-gakit-maroon" />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-900">
              {email || 'Signed-in user'}
            </div>
            <div className="text-[11px] capitalize text-slate-500">
              {role || 'Loading role...'}
            </div>
          </div>
        </div>
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
