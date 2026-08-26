'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map } from 'lucide-react';
import { AdminHeader } from '@/components/AdminHeader';
import { SideBar } from '@/components/SideBar';
import { WeatherAlertModal } from '@/components/WeatherAlertModal';
import type { WeatherAlert } from '@/types/weather';
import type { PortalNavItem } from '@/types/portal';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { monitoringFeatureMap, monitoringFeatures, type MonitoringFeatureId } from './features/monitoringFeatureConfig';
import { useRouteLoader } from '@/components/RouteLoader';
import type { AuthSnapshot } from '@/lib/auth/roles';
import './Monitoring.css';

const TabFallback = () => (
  <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
);

const AlertsTab = dynamic(
  () => import('./features/alerts/AlertsTab').then((m) => ({ default: m.AlertsTab })),
  { loading: () => <TabFallback />, ssr: false }
);
const ReportsTab = dynamic(
  () => import('./features/reports/ReportsTab').then((m) => ({ default: m.ReportsTab })),
  { loading: () => <TabFallback />, ssr: false }
);
export function MonitoringShell({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') as MonitoringFeatureId | null;
  const tabFromParams =
    requestedTab && monitoringFeatureMap[requestedTab] ? requestedTab : 'dashboard';
  const [activeTab, setActiveTab] = useState<MonitoringFeatureId>(tabFromParams);
  const [criticalReportsOnly, setCriticalReportsOnly] = useState(false);
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [selectedWeatherAlert, setSelectedWeatherAlert] = useState<WeatherAlert | null>(null);
  const activeFeature = monitoringFeatureMap[activeTab];

  // Keep the active tab in sync with URL changes made outside this component
  // (notification bell, browser back/forward). Our handlers set state first,
  // so this is a no-op for tab switches we initiated ourselves.
  useEffect(() => {
    setActiveTab(tabFromParams);
  }, [tabFromParams]);

  const handleTabChange = (tab: MonitoringFeatureId) => {
    setActiveTab(tab);
    setCriticalReportsOnly(false);
    setHighlightedReportId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('notification');
    if (tab === 'dashboard') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    router.replace(query ? `/monitoring?${query}` : '/monitoring', { scroll: false });
  };
  const handleReviewCritical = () => {
    setCriticalReportsOnly(true);
    setHighlightedReportId(null);
    setActiveTab('reports');
    router.replace('/monitoring?tab=reports', { scroll: false });
  };
  const handleOpenReport = (reportId?: string) => {
    setCriticalReportsOnly(false);
    setHighlightedReportId(reportId ?? null);
    setActiveTab('reports');
    router.replace('/monitoring?tab=reports', { scroll: false });
  };
  const handleOpenNotification = (notificationId: string) => {
    setCriticalReportsOnly(false);
    setHighlightedReportId(null);
    setActiveTab('alerts');
    router.replace(`/monitoring?tab=alerts&notification=${encodeURIComponent(notificationId)}`, { scroll: false });
  };
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/80">
      <SideBar
        activeTab={activeTab}
        items={monitoringFeatures}
        portalSubtitle="Monitoring Portal"
        onTabChange={handleTabChange}
        initialAuth={initialAuth}
      />
      <div className="h-full min-w-0 flex-1 flex flex-col overflow-hidden bg-white lg:rounded-[2rem] lg:rounded-l-[2.75rem]">
        <AdminHeader
          title={activeFeature.title}
          description={activeFeature.description}
          icon={activeFeature.icon}
          onNotificationClick={handleOpenNotification}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:px-7 md:py-6 lg:px-8 lg:pb-8 space-y-6">
          <div className={activeTab === 'dashboard' ? 'space-y-4' : 'hidden'}>
            <DashboardOverview active={activeTab === 'dashboard'} onReviewCritical={handleReviewCritical} />
          </div>
          <div className={activeTab === 'alerts' ? 'space-y-4' : 'hidden'}>
            <AlertsTab active={activeTab === 'alerts'} onOpenReports={handleOpenReport} onSelectWeatherAlert={setSelectedWeatherAlert} />
          </div>
          <div className={activeTab === 'reports' ? 'space-y-4' : 'hidden'}>
            <ReportsTab
              active={activeTab === 'reports'}
              initialCritical={criticalReportsOnly}
              highlightedReportId={highlightedReportId}
            />
          </div>
        </main>
      </div>
      <MobileBottomNav
        items={monitoringFeatures}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      {selectedWeatherAlert && (
        <WeatherAlertModal
          alert={selectedWeatherAlert}
          onClose={() => setSelectedWeatherAlert(null)}
        />
      )}
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
