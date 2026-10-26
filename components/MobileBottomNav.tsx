'use client';

import type { PortalNavItem } from '@/types/portal';
import { BentoMenu } from './BentoMenu';
import { getBentoTilesForRole } from '@/lib/navigation/bentoMenu';
import type { StaffRole } from '@/lib/auth/roles';

export function MobileBottomNav<T extends string>({
  items,
  activeTab,
  onTabChange,
  role = null,
}: {
  items: PortalNavItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  role?: StaffRole | null;
}) {
  return (
    <nav aria-label="Portal navigation" className="pointer-events-none fixed bottom-0 inset-x-0 z-[1200] px-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom,0px))] lg:hidden">
      <div className="pointer-events-auto mx-auto grid max-w-[320px] grid-cols-4 items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/95 p-1 shadow-lg backdrop-blur-md">
        {items.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeTab === feature.id;
          return (
            <button
              type="button"
              key={feature.id}
              onClick={() => onTabChange(feature.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-10 min-w-0 w-full flex-col items-center justify-center gap-0.5 rounded-full px-1 transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon ${
                isActive
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon active:bg-slate-100'
              }`}
            >
              <div className="relative">
                <Icon aria-hidden="true" className={`h-4 w-4 ${isActive ? 'text-gakit-maroon' : ''}`} />
                {feature.badge && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                  </span>
                )}
              </div>
              <span className="max-w-full truncate text-[10px] font-semibold">
                {feature.mobileLabel ?? feature.label}
              </span>
            </button>
          );
        })}
        <BentoMenu
          items={getBentoTilesForRole(role)}
          variant="mobile-nav"
        />
      </div>
    </nav>
  );
}
