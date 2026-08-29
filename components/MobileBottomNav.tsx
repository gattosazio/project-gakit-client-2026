'use client';

import { Map } from 'lucide-react';
import { useRouteLoader } from './RouteLoader';
import type { PortalNavItem } from '@/types/portal';

export function MobileBottomNav<T extends string>({
  items,
  activeTab,
  onTabChange,
}: {
  items: PortalNavItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}) {
  const { navigate, loadingOverlay } = useRouteLoader();
  return (
    <>
      <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-[1200] px-4 pb-2 lg:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-sm items-center justify-center gap-1.5 rounded-2xl bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur">
          <button
            onClick={() => navigate('/')}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-slate-500 transition-colors hover:bg-maroon-50 hover:text-gakit-maroon"
          >
            <Map className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Map</span>
          </button>
          {items.map((feature) => {
            const Icon = feature.icon;
            const isActive = activeTab === feature.id;
            return (
              <button
                key={feature.id}
                onClick={() => onTabChange(feature.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-150 ${
                  isActive
                    ? 'bg-[#eef2f6] text-gakit-maroon shadow-[inset_1.5px_1.5px_3px_rgba(15,23,42,0.12),inset_-1.5px_-1.5px_3px_rgba(255,255,255,1)] ring-1 ring-slate-300/60 font-bold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-gakit-maroon' : ''}`} />
                <span className="text-[10px] font-semibold">
                  {feature.mobileLabel ?? feature.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      {loadingOverlay}
    </>
  );
}