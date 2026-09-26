'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminHeader } from '@/components/AdminHeader';
import { SideBar } from '@/components/SideBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { WeatherAlertModal } from '@/components/WeatherAlertModal';
import type { WeatherAlert } from '@/types/weather';
import type { ReportStatus } from '@/types/report';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { monitoringFeatureMap, monitoringFeatures, type MonitoringFeatureId } from './features/monitoringFeatureConfig';
import { TabLoading } from '@/components/ui/TabLoading';
import type { AuthSnapshot } from '@/lib/auth/roles';
import './Monitoring.css';

const AlertsTab = dynamic(
  () => import('./features/alerts/AlertsTab').then((m) => ({ default: m.AlertsTab })),
  { loading: () => <TabLoading />, ssr: false }
);
const ReportsTab = dynamic(
  () => import('./features/reports/ReportsTab').then((m) => ({ default: m.ReportsTab })),
  { loading: () => <TabLoading />, ssr: false }
);
const ScenariosTab = dynamic(
  () => import('./features/scenarios/ScenariosTab').then((m) => ({ default: m.ScenariosTab })),
  { loading: () => <TabLoading />, ssr: false }
);
export function MonitoringShell({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') as MonitoringFeatureId | null;
  const tabFromParams =
    requestedTab && monitoringFeatureMap[requestedTab] ? requestedTab : 'dashboard';
  const [activeTab, setActiveTab] = useState<MonitoringFeatureId>(tabFromParams);
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [highlightedNotificationId, setHighlightedNotificationId] = useState<string | null>(
    () => searchParams.get('notification')
  );
  const [selectedWeatherAlert, setSelectedWeatherAlert] = useState<WeatherAlert | null>(null);
  const activeFeature = monitoringFeatureMap[activeTab];

  const STATUS_VALUES = new Set<ReportStatus>([
    'UNVERIFIED',
    'VERIFIED',
    'ANOMALY',
    'REJECTED',
  ]);
  const rawStatus = searchParams.get('status');
  const initialStatus =
    rawStatus && STATUS_VALUES.has(rawStatus as ReportStatus)
      ? (rawStatus as ReportStatus)
      : undefined;
  const initialTime = searchParams.get('time') ?? undefined;

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const htmlOverflow = html.style.overflow;
    const bodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = htmlOverflow;
      body.style.overflow = bodyOverflow;
    };
  }, []);

  // Idle-prefetch tab component chunks so first click is instantaneous
  useEffect(() => {
    const prefetchTabs = () => {
      void import('./features/alerts/AlertsTab');
      void import('./features/reports/ReportsTab');
      void import('./features/scenarios/ScenariosTab');
    };

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        const id = (window as any).requestIdleCallback(prefetchTabs, { timeout: 2000 });
        return () => (window as any).cancelIdleCallback?.(id);
      } else {
        const timer = setTimeout(prefetchTabs, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // URL updater: modifies browser address bar with 0ms latency and 0 server round-trips
  const updateUrl = (newTab: MonitoringFeatureId, queryMutator?: (params: URLSearchParams) => void) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (newTab === 'dashboard') {
      params.delete('tab');
    } else {
      params.set('tab', newTab);
    }
    if (queryMutator) {
      queryMutator(params);
    }
    const query = params.toString();
    const url = query ? `/monitoring?${query}` : '/monitoring';
    window.history.replaceState(null, '', url);
  };

  // Support browser Back and Forward navigation without server round-trips
  useEffect(() => {
    const handlePopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const tabParam = currentParams.get('tab') as MonitoringFeatureId | null;
      const resolvedTab = tabParam && monitoringFeatureMap[tabParam] ? tabParam : 'dashboard';
      setActiveTab(resolvedTab);
      setHighlightedNotificationId(currentParams.get('notification'));
      setHighlightedReportId(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab: MonitoringFeatureId) => {
    setActiveTab(tab);
    setHighlightedReportId(null);
    setHighlightedNotificationId(null);
    updateUrl(tab, (params) => {
      params.delete('notification');
    });
  };

  const handleReviewReports = (options?: { status?: ReportStatus; reportId?: string }) => {
    setActiveTab('reports');
    setHighlightedReportId(options?.reportId ?? null);
    setHighlightedNotificationId(null);
    updateUrl('reports', (params) => {
      params.delete('notification');
      if (options?.status) params.set('status', options.status);
      else params.delete('status');
      params.set('time', '24h');
    });
  };

  const handleOpenReport = (reportId?: string) => {
    setActiveTab('reports');
    setHighlightedReportId(reportId ?? null);
    setHighlightedNotificationId(null);
    updateUrl('reports', (params) => {
      params.delete('notification');
    });
  };

  const handleOpenNotification = (notificationId: string) => {
    setActiveTab('alerts');
    setHighlightedReportId(null);
    setHighlightedNotificationId(notificationId);
    updateUrl('alerts', (params) => {
      params.set('notification', notificationId);
    });
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
          badge={activeFeature.badge}
          role={initialAuth?.role ?? null}
          onNotificationClick={handleOpenNotification}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-20 md:px-7 md:py-6 lg:px-8 lg:pb-8 space-y-6">
          <div className={activeTab === 'dashboard' ? 'min-w-0 space-y-4' : 'hidden'}>
            <DashboardOverview active={activeTab === 'dashboard'} onReviewReports={handleReviewReports} />
          </div>
          <div className={activeTab === 'alerts' ? 'space-y-4' : 'hidden'}>
            <AlertsTab
              active={activeTab === 'alerts'}
              highlightedNotificationId={highlightedNotificationId}
              onOpenReports={handleOpenReport}
              onSelectWeatherAlert={setSelectedWeatherAlert}
            />
          </div>
          <div className={activeTab === 'reports' ? 'space-y-4' : 'hidden'}>
            <ReportsTab
              active={activeTab === 'reports'}
              highlightedReportId={highlightedReportId}
              initialStatus={initialStatus}
              initialTime={initialTime}
            />
          </div>
          <div className={activeTab === 'scenarios' ? 'h-full min-w-0 space-y-4' : 'hidden'}>
            <ScenariosTab active={activeTab === 'scenarios'} />
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
