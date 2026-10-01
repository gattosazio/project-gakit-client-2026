'use client';

import type { PortalNavItem } from '@/types/portal';
import { BentoMenu } from './BentoMenu';
import { monitoringBentoTiles } from '@/lib/navigation/bentoMenu';

export function MobileBottomNav<T extends string>({
  items,
  activeTab,
  onTabChange,
}: {
  items: PortalNavItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}) {
  return (
    <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-[1200] px-3 pb-2 lg:hidden">
      <div className="pointer-events-auto mx-auto grid max-w-sm grid-cols-4 items-center gap-1 p-1.5 rounded-2xl bg-white/85 shadow-[0_12px_40px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.9)] border border-white/60 ring-1 ring-slate-200/80 backdrop-blur-xl">
        {items.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeTab === feature.id;
          return (
            <button
              key={feature.id}
              onClick={() => onTabChange(feature.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon active:bg-slate-100'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'text-gakit-maroon' : ''}`} />
                {feature.badge && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold">
                {feature.mobileLabel ?? feature.label}
              </span>
            </button>
          );
        })}
        <BentoMenu
          items={monitoringBentoTiles}
          variant="mobile-nav"
        />
      </div>
    </nav>
  );
}
