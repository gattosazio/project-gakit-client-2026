'use client';

import { useState } from 'react';
import { AdminHeader } from '@/components/AdminHeader';
import { SideBar } from '@/components/SideBar';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { HazardMapTab } from './features/hazard-map/HazardMapTab';
import { monitoringFeatureMap, monitoringFeatures, type MonitoringFeatureId } from './features/monitoringFeatureConfig';
import { ReportsTab } from './features/reports/ReportsTab';
import { ReviewQueueTab } from './features/review-queue/ReviewQueueTab';
import './Monitoring.css';

export function MonitoringShell() {
  const [activeTab, setActiveTab] = useState<MonitoringFeatureId>('dashboard');
  const activeFeature = monitoringFeatureMap[activeTab];

  return (
    <div className="h-screen bg-canvas-light flex overflow-hidden">
      <SideBar
        activeTab={activeTab}
        items={monitoringFeatures}
        portalSubtitle="Monitoring Portal"
        onTabChange={setActiveTab}
      />

      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
        <AdminHeader
          title={activeFeature.title}
          description={activeFeature.description}
          searchPlaceholder="Search reports, locations, or queue items"
          profileLabel="Staff"
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <MonitoringTabContent activeTab={activeTab} />
        </main>
      </div>
    </div>
  );
}

function MonitoringTabContent({ activeTab }: { activeTab: MonitoringFeatureId }) {
  switch (activeTab) {
    case 'reports':
      return <ReportsTab />;
    case 'hazard-map':
      return <HazardMapTab />;
    case 'review-queue':
      return <ReviewQueueTab />;
    case 'dashboard':
    default:
      return <DashboardOverview />;
  }
}
