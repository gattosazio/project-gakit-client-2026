'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PortalNavItem } from './portalTypes';

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

  async function handleLogOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="hidden lg:flex w-64 shrink-0 bg-gakit-maroon text-white h-screen flex-col">
      <div className="h-20 px-6 flex items-center gap-3 border-b border-white/15">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
          <span className="text-gakit-maroon font-bold text-sm">GK</span>
        </div>
        <div>
          <div className="font-bold leading-tight">Project GAKIT</div>
          <div className="text-xs text-white/70">{portalSubtitle}</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {items.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeTab === feature.id;

          return (
            <button
              key={feature.id}
              onClick={() => onTabChange(feature.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-white text-gakit-maroon'
                  : 'text-white/85 hover:bg-white/15 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {feature.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/15">
        <button
          onClick={handleLogOut}
          disabled={isSigningOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/85 hover:bg-white/15 hover:text-white transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
