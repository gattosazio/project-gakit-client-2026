'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useEffect } from 'react';
import Image from 'next/image';
import { Loader2, LogOut, Map, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, type StaffRole } from '@/lib/auth/roles';
import { PortalNavItem } from '@/types/portal';
import { useRouteLoader } from './RouteLoader';

interface SideBarProps<T extends string> {
  activeTab: T;
  items: PortalNavItem<T>[];
  portalSubtitle: string;
  onTabChange: (tab: T) => void;
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
            {isSigningOut && <Loader2 className="h-4 w-4 animate-spin" />}
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
}: SideBarProps<T>) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
          <div className="text-sm font-bold leading-tight text-slate-500">{portalSubtitle}</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
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
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3">
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
          onClick={() => setShowConfirm(true)}
          disabled={isSigningOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
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
