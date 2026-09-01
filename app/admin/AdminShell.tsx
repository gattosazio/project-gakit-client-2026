'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
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

export function AdminShell({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') as AdminFeatureId | null;
  const activeTab = requestedTab && adminFeatureMap[requestedTab] ? requestedTab : 'users';
  const activeFeature = adminFeatureMap[activeTab];

  const handleTabChange = (tab: AdminFeatureId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'users') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    router.replace(query ? `/admin?${query}` : '/admin', { scroll: false });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/80">
      <SideBar
        activeTab={activeTab}
        items={adminFeatures}
        portalSubtitle="Admin Portal"
        onTabChange={handleTabChange}
        initialAuth={initialAuth}
        showPublicMapLink={false}
      />

      <div className="h-full min-w-0 flex-1 flex flex-col overflow-hidden bg-white lg:rounded-[2rem] lg:rounded-l-[2.75rem]">
        <AdminHeader
          title={activeFeature.title}
          description={activeFeature.description}
          icon={activeFeature.icon}
          role={initialAuth?.role ?? null}
        />

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:px-7 md:py-6 lg:px-8 lg:pb-8 space-y-6">
          <AdminTabContent activeTab={activeTab} />
        </main>
      </div>

      <MobileBottomNav
        items={adminFeatures}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
}

function AdminTabContent({ activeTab }: { activeTab: AdminFeatureId }) {
  switch (activeTab) {
    case 'roles':
      return <RolesTab />;
    case 'audit-logs':
      return <AuditLogsTab />;
    case 'users':
    default:
      return <UsersTab />;
  }
}