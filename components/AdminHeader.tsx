'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bell, LogOut, Settings, Shield, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AdminHeaderProps {
  title: string;
  description: string;
  profileLabel?: string;
}

export function AdminHeader({
  title,
  description,
  profileLabel = 'Admin',
}: AdminHeaderProps) {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg border border-canvas-grey hover:bg-canvas-light transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-hazard-critical" />
        </button>

        <div className="relative">
          <button
            onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
            className="flex items-center gap-2 p-2 rounded-lg border border-canvas-grey hover:bg-canvas-light transition-colors"
            aria-expanded={isProfileOpen}
            aria-haspopup="menu"
          >
            <UserRound className="w-5 h-5 text-gakit-maroon" />
            <span className="hidden md:inline text-sm font-semibold text-slate-700">{profileLabel}</span>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-12 z-50 w-52 rounded-lg border border-canvas-grey bg-white p-2 shadow-lg">
              <Link
                href="/monitoring"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
                onClick={() => setIsProfileOpen(false)}
              >
                <Settings className="w-4 h-4 text-slate-500" />
                Settings
              </Link>
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
                onClick={() => setIsProfileOpen(false)}
              >
                <Shield className="w-4 h-4 text-slate-500" />
                Administration
              </Link>
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
