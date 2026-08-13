'use client';

import { Bell, type LucideIcon } from 'lucide-react';
import { MobileSignOutButton } from './SideBar';

interface AdminHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function AdminHeader({
  title,
  description,
  icon: Icon,
}: AdminHeaderProps) {

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
        <div className="lg:hidden">
          <MobileSignOutButton compact />
        </div>
      </div>
    </header>
  );
}
