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
import { DashboardOverview, type DashboardReviewOptions } from './features/dashboard/DashboardOverview';
import { applyReportDeepLinkParams, consumeReportDeepLinkParams } from './reportDeepLink';
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
export function MonitoringShell({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') as MonitoringFeatureId | null;
  const tabFromParams =
    requestedTab && monitoringFeatureMap[requestedTab] ? requestedTab : 'dashboard';
  const [activeTab, setActiveTab] = useState<MonitoringFeatureId>(tabFromParams);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const navigationItems = monitoringFeatures.map(feature => feature.id === 'alerts'
    ? { ...feature, unreadCount: unreadAlertCount } : feature);
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [highlightedNotificationId, setHighlightedNotificationId] = useState<string | null>(
    () => searchParams.get('notification')
  );
  const [selectedWeatherAlert, setSelectedWeatherAlert] = useState<WeatherAlert | null>(null);
  const activeFeature = monitoringFeatureMap[activeTab];
  const [reportsFullscreen, setReportsFullscreen] = useState(false);
  const reportsActive = activeTab === 'reports';
  const focusedReports = reportsActive && reportsFullscreen;

  const STATUS_VALUES = new Set<ReportStatus>([
    'UNVERIFIED',
    'VERIFIED',
    'REJECTED',
  ]);
  const requestedStatus = searchParams.get('status');
  const rawStatus = requestedStatus === 'ANOMALY' ? 'UNVERIFIED' : requestedStatus;
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

  useEffect(() => {
    const prefetchTabs = () => {
      void import('./features/alerts/AlertsTab');
      void import('./features/reports/ReportsTab');
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

  useEffect(() => {
    const handlePopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const tabParam = currentParams.get('tab') as MonitoringFeatureId | null;
      const resolvedTab = tabParam && monitoringFeatureMap[tabParam] ? tabParam : 'dashboard';
      setActiveTab(resolvedTab);
      if (resolvedTab !== 'reports') setReportsFullscreen(false);
      setHighlightedNotificationId(currentParams.get('notification'));
      setHighlightedReportId(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab: MonitoringFeatureId) => {
    setActiveTab(tab);
    if (tab !== 'reports') setReportsFullscreen(false);
    setHighlightedReportId(null);
    setHighlightedNotificationId(null);
    updateUrl(tab, (params) => {
      params.delete('notification');
      // Entering any other tab consumes the dashboard's reports deep link so
      // it cannot be re-applied when the user comes back to Reports later.
      if (tab !== 'reports') consumeReportDeepLinkParams(params);
    });
  };

  const handleReviewReports = (options?: DashboardReviewOptions) => {
    setActiveTab('reports');
    setHighlightedReportId(options?.reportId ?? null);
    setHighlightedNotificationId(null);
    updateUrl('reports', (params) => {
      params.delete('notification');
      applyReportDeepLinkParams(params, options);
    });
  };

  const handleOpenReport = (reportId?: string) => {
    setActiveTab('reports');
    setHighlightedReportId(reportId ?? null);
    setHighlightedNotificationId(null);
    updateUrl('reports', (params) => {
      params.delete('notification');
      // A stale deep link's status filter could hide the very report being
      // opened (e.g. a VERIFIED report under a pinned UNVERIFIED filter).
      consumeReportDeepLinkParams(params);
    });
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50/80">
      <div className={focusedReports ? 'hidden' : 'contents'}>
      <SideBar
        activeTab={activeTab}
        items={navigationItems}
        portalSubtitle="Monitoring Portal"
        onTabChange={handleTabChange}
        initialAuth={initialAuth}
        showTopo
      />
      </div>
      <div className={`h-full min-w-0 flex-1 flex flex-col overflow-hidden bg-white ${focusedReports ? '' : 'lg:rounded-[2rem] lg:rounded-l-[2.75rem]'}`}>
        <div className={focusedReports ? 'hidden' : 'contents'}>
        <AdminHeader
          title={activeFeature.title}
          description={activeFeature.description}
          icon={activeFeature.icon}
          badge={activeFeature.badge}
          compact
          showTopo
          hideNotifications
        />
        </div>
        <main className={`min-h-0 flex-1 ${reportsActive
          ? focusedReports ? 'overflow-hidden' : 'overflow-hidden p-2 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:p-3'
          : activeTab === 'alerts' ? 'overflow-y-auto overflow-x-hidden p-3 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:px-7 lg:px-8 xl:overflow-hidden xl:pb-3'
          : `overflow-y-auto overflow-x-hidden p-4 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:px-7 lg:px-8 space-y-6 ${activeTab === 'dashboard' ? 'md:pt-4 lg:pb-4' : 'md:pt-6 lg:pb-8'}`} `}>
          <div className={activeTab === 'dashboard' ? 'min-w-0 space-y-4' : 'hidden'}>
            <DashboardOverview active={activeTab === 'dashboard'} onReviewReports={handleReviewReports} />
          </div>
          <div className={activeTab === 'alerts' ? 'min-h-0 xl:h-full' : 'hidden'}>
            <AlertsTab
              onUnreadCountChange={setUnreadAlertCount}
              active={activeTab === 'alerts'}
              highlightedNotificationId={highlightedNotificationId}
              onOpenReports={handleOpenReport}
              onSelectWeatherAlert={setSelectedWeatherAlert}
            />
          </div>
          <div className={reportsActive ? 'h-full min-h-0' : 'hidden'}>
            <ReportsTab
              active={activeTab === 'reports'}
              highlightedReportId={highlightedReportId}
              initialStatus={initialStatus}
              initialTime={initialTime}
              fullscreenMode={focusedReports}
              onFullscreenModeChange={setReportsFullscreen}
            />
          </div>
        </main>
      </div>
      <div className={focusedReports ? 'hidden' : 'contents'}>
      <MobileBottomNav
        items={navigationItems}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        role={initialAuth?.role ?? null}
      />
      </div>
      {selectedWeatherAlert && (
        <WeatherAlertModal
          alert={selectedWeatherAlert}
          onClose={() => setSelectedWeatherAlert(null)}
        />
      )}
    </div>
  );
}
