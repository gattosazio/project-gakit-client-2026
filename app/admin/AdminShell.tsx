'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminHeader } from '@/components/AdminHeader';
import { SideBar } from '@/components/SideBar';
import { adminFeatures, adminFeatureMap, type AdminFeatureId } from './features/adminFeatureConfig';
import { PlatformOverviewTab } from './features/dashboard/PlatformOverviewTab';
import type { AuthSnapshot } from '@/lib/auth/roles';
import './Dashboard.css';

const TabFallback = () => (
  <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
);

const AccessRequestsTab = dynamic(
  () => import('./features/access-requests/AccessRequestsTab').then((m) => ({ default: m.AccessRequestsTab })),
  { loading: () => <TabFallback />, ssr: false }
);
const AuditLogsTab = dynamic(
  () => import('./features/audit-logs/AuditLogsTab').then((m) => ({ default: m.AuditLogsTab })),
  { loading: () => <TabFallback />, ssr: false }
);
const SystemSettingsTab = dynamic(
  () => import('./features/system-settings/SystemSettingsTab').then((m) => ({ default: m.SystemSettingsTab })),
  { loading: () => <TabFallback />, ssr: false }
);
const UsersRolesTab = dynamic(
  () => import('./features/users-roles/UsersRolesTab').then((m) => ({ default: m.UsersRolesTab })),
  { loading: () => <TabFallback />, ssr: false }
);

export function AdminShell({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') as AdminFeatureId | null;
  const activeTab = requestedTab && adminFeatureMap[requestedTab] ? requestedTab : 'dashboard';
  const activeFeature = adminFeatureMap[activeTab];

  const handleTabChange = (tab: AdminFeatureId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'dashboard') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    router.replace(query ? `/admin?${query}` : '/admin', { scroll: false });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <SideBar
        activeTab={activeTab}
        items={adminFeatures}
        portalSubtitle="Admin Portal"
        onTabChange={handleTabChange}
        initialAuth={initialAuth}
      />

      <div className="h-full min-w-0 flex-1 flex flex-col overflow-hidden bg-white lg:rounded-[2rem] lg:rounded-l-[2.75rem]">
        <AdminHeader
          title={activeFeature.title}
          description={activeFeature.description}
          icon={activeFeature.icon}
        />

        <main className="flex-1 overflow-y-auto p-4 md:px-7 md:py-6 lg:px-8 lg:py-8 space-y-6">
          <AdminTabContent activeTab={activeTab} />
        </main>
      </div>
    </div>
  );
}

function AdminTabContent({ activeTab }: { activeTab: AdminFeatureId }) {
  switch (activeTab) {
    case 'access-requests':
      return <AccessRequestsTab />;
    case 'users-roles':
      return <UsersRolesTab />;
    case 'system-settings':
      return <SystemSettingsTab />;
    case 'audit-logs':
      return <AuditLogsTab />;
    case 'dashboard':
    default:
      return <PlatformOverviewTab />;
  }
}
