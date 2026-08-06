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
  const [criticalReportsOnly, setCriticalReportsOnly] = useState(false);
  const activeFeature = monitoringFeatureMap[activeTab];

  const handleTabChange = (tab: MonitoringFeatureId) => {
    setCriticalReportsOnly(false);
    setActiveTab(tab);
  };

  const handleReviewCritical = () => {
    setCriticalReportsOnly(true);
    setActiveTab('reports');
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
          profileLabel="Staff"
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <MonitoringTabContent
            activeTab={activeTab}
            criticalReportsOnly={criticalReportsOnly}
            onReviewCritical={handleReviewCritical}
          />
        </main>
      </div>
    </div>
  );
}

function MonitoringTabContent({
  activeTab,
  criticalReportsOnly,
  onReviewCritical,
}: {
  activeTab: MonitoringFeatureId;
  criticalReportsOnly: boolean;
  onReviewCritical: () => void;
}) {
  switch (activeTab) {
    case 'reports':
      return <ReportsTab initialCritical={criticalReportsOnly} />;
    case 'hazard-map':
      return <HazardMapTab />;
    case 'review-queue':
      return <ReviewQueueTab />;
    case 'dashboard':
    default:
      return <DashboardOverview onReviewCritical={onReviewCritical} />;
  }
}
