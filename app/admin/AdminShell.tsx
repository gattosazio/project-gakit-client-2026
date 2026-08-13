'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { AdminHeader } from '@/components/AdminHeader';
import { SideBar } from '@/components/SideBar';
import { adminFeatures, adminFeatureMap, type AdminFeatureId } from './features/adminFeatureConfig';
import { AccessRequestsTab } from './features/access-requests/AccessRequestsTab';
import { AuditLogsTab } from './features/audit-logs/AuditLogsTab';
import { PlatformOverviewTab } from './features/dashboard/PlatformOverviewTab';
import { SystemSettingsTab } from './features/system-settings/SystemSettingsTab';
import { UsersRolesTab } from './features/users-roles/UsersRolesTab';
import './Dashboard.css';

export function AdminShell() {
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
    <div className="h-screen bg-canvas-light flex overflow-hidden">
      <SideBar
        activeTab={activeTab}
        items={adminFeatures}
        portalSubtitle="Admin Portal"
        onTabChange={handleTabChange}
      />

      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
        <AdminHeader
          title={activeFeature.title}
          description={activeFeature.description}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
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
