'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map } from 'lucide-react';
import { AdminHeader } from '@/components/AdminHeader';
import { SideBar } from '@/components/SideBar';
import type { PortalNavItem } from '@/components/portalTypes';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { monitoringFeatureMap, monitoringFeatures, type MonitoringFeatureId } from './features/monitoringFeatureConfig';
import { ReportsTab } from './features/reports/ReportsTab';
import { useRouteLoader } from '@/components/RouteLoader';
import './Monitoring.css';
export function MonitoringShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') as MonitoringFeatureId | null;
  const activeTab = requestedTab && monitoringFeatureMap[requestedTab] ? requestedTab : 'dashboard';
  const [criticalReportsOnly, setCriticalReportsOnly] = useState(false);
  const activeFeature = monitoringFeatureMap[activeTab];
  const handleTabChange = (tab: MonitoringFeatureId) => {
    setCriticalReportsOnly(false);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'dashboard') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    router.replace(query ? `/monitoring?${query}` : '/monitoring', { scroll: false });
  };
  const handleReviewCritical = () => {
    setCriticalReportsOnly(true);
    handleTabChange('reports');
  };
  return (
    <div className="h-screen bg-canvas-light flex overflow-hidden">
      <SideBar
        activeTab={activeTab}
        items={monitoringFeatures}
        portalSubtitle="Monitoring Portal"
        onTabChange={handleTabChange}
      />
      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
        <AdminHeader
          title={activeFeature.title}
          description={activeFeature.description}
          icon={activeFeature.icon}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 lg:pb-6 space-y-6">
          {activeTab === 'dashboard' && (
            <DashboardOverview onReviewCritical={handleReviewCritical} />
          )}
          <div className={activeTab === 'reports' ? '' : 'hidden'}>
            <ReportsTab initialCritical={criticalReportsOnly} />
          </div>
        </main>
      </div>
      <MobileBottomNav
        items={monitoringFeatures}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
}

function MobileBottomNav({
  items,
  activeTab,
  onTabChange,
}: {
  items: PortalNavItem<MonitoringFeatureId>[];
  activeTab: MonitoringFeatureId;
  onTabChange: (tab: MonitoringFeatureId) => void;
}) {
  const { navigate, loadingOverlay } = useRouteLoader();
  return (
    <>
    <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-[1200] px-4 pb-4 lg:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-sm items-center justify-center gap-1.5 rounded-2xl bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur">
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
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                isActive
                  ? 'bg-maroon-50 text-gakit-maroon'
                  : 'text-slate-500 hover:bg-maroon-50 hover:text-gakit-maroon'
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
