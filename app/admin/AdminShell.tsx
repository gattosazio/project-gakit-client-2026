'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminHeader } from '@/components/AdminHeader';
import { SideBar } from '@/components/SideBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { adminFeatures, adminFeatureMap, type AdminFeatureId } from './features/adminFeatureConfig';
import { TabLoading } from '@/components/ui/TabLoading';
import type { AuthSnapshot } from '@/lib/auth/roles';

const UsersTab = dynamic(
  () => import('./features/users/UsersTab').then((m) => ({ default: m.UsersTab })),
  { loading: () => <TabLoading />, ssr: false }
);
const RolesTab = dynamic(
  () => import('./features/roles/RolesTab').then((m) => ({ default: m.RolesTab })),
  { loading: () => <TabLoading />, ssr: false }
);
const AuditLogsTab = dynamic(
  () => import('./features/audit-logs/AuditLogsTab').then((m) => ({ default: m.AuditLogsTab })),
  { loading: () => <TabLoading />, ssr: false }
);

/**
 * `space-y-6` sits on the panel rather than on <main> because Tailwind's
 * `space-y-*` compiles to `> :not([hidden]) ~ :not([hidden])`, which matches the
 * *attribute*, not the `hidden` class. Inactive panels are still counted as
 * siblings, so keeping the rhythm on <main> would add a stray 24px offset above
 * every tab except the first.
 */
function tabPanelClass(isActive: boolean): string {
  return isActive ? 'min-w-0 space-y-6' : 'hidden';
}

export function AdminShell({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') as AdminFeatureId | null;
  const tabFromParams = requestedTab && adminFeatureMap[requestedTab] ? requestedTab : 'users';
  const [activeTab, setActiveTab] = useState<AdminFeatureId>(tabFromParams);
  const activeFeature = adminFeatureMap[activeTab];

  // Idle-prefetch tab component chunks so first click is instantaneous
  useEffect(() => {
    const prefetchTabs = () => {
      void import('./features/users/UsersTab');
      void import('./features/roles/RolesTab');
      void import('./features/audit-logs/AuditLogsTab');
    };

    if (typeof window !== 'undefined') {
      if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(prefetchTabs, { timeout: 2000 });
        return () => window.cancelIdleCallback(id);
      }
      const timer = window.setTimeout(prefetchTabs, 1000);
      return () => window.clearTimeout(timer);
    }
  }, []);

  // URL updater: modifies browser address bar with 0ms latency and 0 server round-trips
  const updateUrl = (newTab: AdminFeatureId) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (newTab === 'users') params.delete('tab');
    else params.set('tab', newTab);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `/admin?${query}` : '/admin');
  };

  // Support browser Back and Forward navigation without server round-trips
  useEffect(() => {
    const handlePopState = () => {
      const tabParam = new URLSearchParams(window.location.search).get('tab') as AdminFeatureId | null;
      setActiveTab(tabParam && adminFeatureMap[tabParam] ? tabParam : 'users');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab: AdminFeatureId) => {
    setActiveTab(tab);
    updateUrl(tab);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/80">
      <SideBar
        activeTab={activeTab}
        items={adminFeatures}
        portalSubtitle="Admin Portal"
        onTabChange={handleTabChange}
        initialAuth={initialAuth}
        showTopo
      />

      <div className="h-full min-w-0 flex-1 flex flex-col overflow-hidden bg-white lg:rounded-[2rem] lg:rounded-l-[2.75rem]">
        <AdminHeader
          title={activeFeature.title}
          description={activeFeature.description}
          icon={activeFeature.icon}
          showTopo
        />

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:px-7 md:py-6 lg:px-8 lg:pb-8">
          {/* All three tabs stay mounted and are toggled with `hidden`, so
              switching is instant and in-tab state (filters, page, scroll)
              survives. Each tab defers its own fetching via `active`. */}
          <div className={tabPanelClass(activeTab === 'users')}>
            <UsersTab active={activeTab === 'users'} />
          </div>
          <div className={tabPanelClass(activeTab === 'roles')}>
            <RolesTab active={activeTab === 'roles'} />
          </div>
          <div className={tabPanelClass(activeTab === 'audit-logs')}>
            <AuditLogsTab active={activeTab === 'audit-logs'} />
          </div>
        </main>
      </div>

      <MobileBottomNav
        items={adminFeatures}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        role={initialAuth?.role ?? null}
      />
    </div>
  );
}
