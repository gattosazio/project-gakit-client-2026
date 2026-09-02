'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useEffect } from 'react';
import Image from 'next/image';
import { LogOut, Map, PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, type AuthSnapshot, type StaffRole } from '@/lib/auth/roles';
import { PortalNavItem } from '@/types/portal';
import { useRouteLoader } from './RouteLoader';
import { usePrefetchRoute } from '@/hooks/usePrefetchRoute';

interface SideBarProps<T extends string> {
  activeTab: T;
  items: PortalNavItem<T>[];
  portalSubtitle: string;
  onTabChange: (tab: T) => void;
  showPublicMapLink?: boolean;
}

export function SignOutConfirmDialog({
  isOpen,
  isSigningOut,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  isSigningOut: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm sign out"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
            <LogOut className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Sign out</h2>
            <p className="text-sm text-slate-500">End your portal session</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Are you sure you want to sign out? You will need to sign in again to
          access the portal.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSigningOut}
            className="rounded-lg border border-canvas-grey px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSigningOut}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSigningOut && <Spinner size="sm" iconClassName="bg-white" />}
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MobileSignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const trigger = compact ? (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      disabled={isSigningOut}
      title="Sign out"
      aria-label="Sign out"
      className="rounded-lg border border-canvas-grey p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <LogOut className="h-5 w-5" />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      disabled={isSigningOut}
      className="flex flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <LogOut className="h-5 w-5" />
      <span className="truncate">{isSigningOut ? '...' : 'Sign out'}</span>
    </button>
  );

  return (
    <>
      {trigger}
      <SignOutConfirmDialog
        isOpen={showConfirm}
        isSigningOut={isSigningOut}
        onConfirm={handleSignOut}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

export function SideBar<T extends string>({
  activeTab,
  items,
  portalSubtitle,
  onTabChange,
  initialAuth,
  showPublicMapLink = true,
}: SideBarProps<T> & { initialAuth?: AuthSnapshot }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [email, setEmail] = useState<string | null>(initialAuth?.email ?? null);
  const [role, setRole] = useState<StaffRole | null>(initialAuth?.role ?? null);
  const { navigate, loadingOverlay } = useRouteLoader();

  useEffect(() => {
    if (initialAuth !== undefined) return;
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
  }, [initialAuth]);

  // Idle-time prefetch of the public map so "exit to map" navigations are instant.
  usePrefetchRoute(showPublicMapLink ? '/' : null);

  async function handleLogOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
    <aside
      className={`relative z-10 hidden h-full shrink-0 flex-col overflow-visible border-r border-slate-200 bg-slate-50 text-slate-900 transition-[width] duration-300 lg:flex ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      <button
        type="button"
        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute right-[-1.25rem] top-7 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gakit-maroon shadow-lg ring-4 ring-slate-100 transition-all duration-200 hover:scale-105 hover:bg-maroon-50"
      >
        {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <div className={`flex h-24 shrink-0 flex-col justify-center border-b border-slate-100 ${isCollapsed ? 'items-center px-3' : 'items-start px-7'}`}>
        <div className={`flex h-9 items-center ${isCollapsed ? 'w-9' : 'w-28'}`}>
          <Image
            src="/images/gakit_logo_adobe.svg"
            alt="GAKIT logo"
            width={160}
            height={48}
            priority
            className="h-full w-full object-contain"
          />
        </div>
        <div className={`mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 ${isCollapsed ? 'sr-only' : ''}`}>{portalSubtitle}</div>
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto py-6 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        {showPublicMapLink && (
          <button
            onClick={() => navigate('/')}
            title="Public Hazard Map"
            className={`group flex w-full items-center rounded-2xl py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-white hover:text-gakit-maroon hover:shadow-sm ${
              isCollapsed ? 'justify-center px-3' : 'gap-3 px-4'
            }`}
          >
            <Map className="h-4 w-4 text-slate-400 transition-colors group-hover:text-gakit-maroon" />
            <span className={isCollapsed ? 'sr-only' : ''}>Public Hazard Map</span>
          </button>
        )}

        <div className={`pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 ${isCollapsed ? 'sr-only' : 'px-4'}`}>
          Menu
        </div>
        {items.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeTab === feature.id;

          return (
            <button
              key={feature.id}
              onClick={() => onTabChange(feature.id)}
              title={feature.label}
              className={`group flex w-full items-center rounded-2xl py-3 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-600 hover:bg-white hover:text-gakit-maroon hover:shadow-sm'
              } ${
                isCollapsed ? 'justify-center px-3' : 'gap-3 px-4'
              }`}
            >
              <Icon
                className={`h-4 w-4 transition-colors ${isActive ? 'text-gakit-maroon' : 'text-slate-400 group-hover:text-gakit-maroon'}`}
              />
              <span className={isCollapsed ? 'sr-only' : ''}>{feature.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={`border-t border-slate-100 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <div className={`mb-3 flex items-center rounded-2xl border border-slate-200 bg-slate-50 ${isCollapsed ? 'justify-center p-3' : 'gap-3 p-3'}`}>
          <UserRound className="h-4 w-4 shrink-0 text-gakit-maroon" />
          <div className={isCollapsed ? 'hidden' : 'min-w-0'}>
            <div className="truncate text-xs font-semibold text-slate-900">
              {email || 'staff_gakit@gmail.com'}
            </div>
            <div className="text-[11px] capitalize text-slate-500">
              {role || 'Loading role...'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isSigningOut}
          title="Sign Out"
          className={`flex w-full items-center rounded-2xl py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-white hover:text-red-600 hover:shadow-sm disabled:opacity-50 ${
            isCollapsed ? 'justify-center px-3' : 'gap-3 px-3'
          }`}
        >
          <LogOut className="w-4 h-4" />
          <span className={isCollapsed ? 'sr-only' : ''}>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>
    </aside>
    <SignOutConfirmDialog
      isOpen={showConfirm}
      isSigningOut={isSigningOut}
      onConfirm={handleLogOut}
      onCancel={() => setShowConfirm(false)}
    />
    {loadingOverlay}
    </>
  );
}
