'use client';

import { Bell, Search, UserRound } from 'lucide-react';

interface AdminHeaderProps {
  title: string;
  description: string;
  searchPlaceholder?: string;
  profileLabel?: string;
}

export function AdminHeader({
  title,
  description,
  searchPlaceholder = 'Search reports or locations',
  profileLabel = 'Admin',
}: AdminHeaderProps) {
  return (
    <header className="h-20 shrink-0 bg-white border-b border-canvas-grey px-4 md:px-6 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 w-72 px-3 py-2 rounded-lg border border-canvas-grey bg-canvas-light">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
          />
        </div>

        <button className="relative p-2 rounded-lg border border-canvas-grey hover:bg-canvas-light transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-hazard-critical" />
        </button>

        <button className="flex items-center gap-2 p-2 rounded-lg border border-canvas-grey hover:bg-canvas-light transition-colors">
          <UserRound className="w-5 h-5 text-[#004aad]" />
          <span className="hidden md:inline text-sm font-semibold text-slate-700">{profileLabel}</span>
        </button>
      </div>
    </header>
  );
}
