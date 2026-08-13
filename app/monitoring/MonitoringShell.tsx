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
import { ReviewQueueTab } from './features/review-queue/ReviewQueueTab';
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
          {activeTab === 'review-queue' && <ReviewQueueTab />}
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
    <nav className="fixed bottom-0 left-0 right-0 z-[1200] border-t border-canvas-grey bg-white shadow-lg lg:hidden">
      <div className="grid grid-cols-3 gap-1 px-2 py-1.5 sm:grid-cols-6">
        <button
          onClick={() => navigate('/')}
          className="flex flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Map className="w-5 h-5 text-slate-400" />
          <span className="truncate">Hazard Map</span>
        </button>
        {items.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeTab === feature.id;
          return (
            <button
              key={feature.id}
              onClick={() => onTabChange(feature.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold transition-colors ${
                isActive
                  ? 'bg-gakit-maroon text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{feature.mobileLabel ?? feature.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
    {loadingOverlay}
    </>
  );
}
