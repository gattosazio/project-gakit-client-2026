'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, LogOut, Settings, Shield, UserRound, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, ROLE_ADMIN, type StaffRole } from '@/lib/auth/roles';

interface AdminHeaderProps {
  title: string;
  description: string;
  profileLabel?: string;
  icon?: LucideIcon;
}

export function AdminHeader({
  title,
  description,
  profileLabel = 'Admin',
  icon: Icon,
}: AdminHeaderProps) {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      if (!cancelled) setEmail(data.user.email ?? null);
      getStaffRole(supabase, data.user.id).then((staffRole) => {
        if (!cancelled) setRole(staffRole);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsProfileOpen(false);
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="h-20 shrink-0 bg-white border-b border-canvas-grey px-4 md:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-gakit-maroon">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 truncate">{title}</h1>
          <p className="hidden md:block text-sm text-slate-500 truncate">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg border border-canvas-grey hover:bg-canvas-light transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-hazard-critical" />
        </button>

        <div className="relative">
          <button
            onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
            className={`flex items-center justify-center p-2 rounded-lg border transition-colors ${
              isProfileOpen
                ? 'border-gakit-maroon bg-maroon-50'
                : 'border-canvas-grey hover:bg-canvas-light'
            }`}
            aria-expanded={isProfileOpen}
            aria-haspopup="menu"
          >
            <UserRound className="w-5 h-5 text-gakit-maroon" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border border-canvas-grey bg-white p-2 shadow-lg">
              {email && (
                <div className="px-3 py-2 text-sm font-semibold text-slate-700 border-b border-canvas-grey mb-1 break-all">
                  {email}
                </div>
              )}
              {role === ROLE_ADMIN && (
                <>
                  <Link
                    href="/monitoring"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    Monitoring Portal
                  </Link>
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <Shield className="w-4 h-4 text-slate-500" />
                    Administration
                  </Link>
                </>
              )}
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
