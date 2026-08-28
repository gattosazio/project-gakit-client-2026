'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminHeader } from '@/components/AdminHeader';
import { SideBar } from '@/components/SideBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { WeatherAlertModal } from '@/components/WeatherAlertModal';
import type { WeatherAlert } from '@/types/weather';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { monitoringFeatureMap, monitoringFeatures, type MonitoringFeatureId } from './features/monitoringFeatureConfig';
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
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [selectedWeatherAlert, setSelectedWeatherAlert] = useState<WeatherAlert | null>(null);
  const activeFeature = monitoringFeatureMap[activeTab];

  // Keep the active tab in sync with URL changes made outside this component
  // (notification bell, browser back/forward). Our handlers set state first, so
  // this is a no-op for tab switches we initiated ourselves. Deferred to a
  // microtask so it isn't a synchronous setState inside the effect body.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setActiveTab(tabFromParams);
    });
    return () => {
      cancelled = true;
    };
  }, [tabFromParams]);

  const handleTabChange = (tab: MonitoringFeatureId) => {
    setActiveTab(tab);
    setHighlightedReportId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('notification');
    if (tab === 'dashboard') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    router.replace(query ? `/monitoring?${query}` : '/monitoring', { scroll: false });
  };
  const handleOpenReports = () => {
    setActiveTab('reports');
    setHighlightedReportId(null);
    router.replace('/monitoring?tab=reports', { scroll: false });
  };
  const handleOpenReport = (reportId?: string) => {
    setActiveTab('reports');
    setHighlightedReportId(reportId ?? null);
    router.replace('/monitoring?tab=reports', { scroll: false });
  };
  const handleOpenNotification = (notificationId: string) => {
    setActiveTab('alerts');
    setHighlightedReportId(null);
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
          role={initialAuth?.role ?? null}
          onNotificationClick={handleOpenNotification}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:px-7 md:py-6 lg:px-8 lg:pb-8 space-y-6">
          <div className={activeTab === 'dashboard' ? 'space-y-4' : 'hidden'}>
            <DashboardOverview active={activeTab === 'dashboard'} onOpenReports={handleOpenReports} />
          </div>
          <div className={activeTab === 'alerts' ? 'space-y-4' : 'hidden'}>
            <AlertsTab active={activeTab === 'alerts'} onOpenReports={handleOpenReport} onSelectWeatherAlert={setSelectedWeatherAlert} />
          </div>
          <div className={activeTab === 'reports' ? 'space-y-4' : 'hidden'}>
            <ReportsTab
              active={activeTab === 'reports'}

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
