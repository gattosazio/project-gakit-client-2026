import {
  LayoutDashboard,
  ShieldAlert,
  Table2,
} from 'lucide-react';
import { PortalNavItem } from '@/components/portalTypes';

export type MonitoringFeatureId =
  | 'dashboard'
  | 'reports'
  | 'review-queue';

export const monitoringFeatures: PortalNavItem<MonitoringFeatureId>[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    mobileLabel: 'Dashboard',
    title: 'Operations Dashboard',
    description: 'Track live report volume, validation pressure, and current emergency posture.',
    icon: LayoutDashboard,
    contents: [
      'KPI cards for report counts, pending validation, critical reports, and verified reports',
      'Report activity heatmap over time',
      'Latest public reports table',
      'Emergency status summary with quick action entry point',
    ],
  },
  {
    id: 'reports',
    label: 'Report Management',
    mobileLabel: 'Reports',
    title: 'Report Management',
    description: 'Review all submitted flood reports, filter by state, and inspect details for action.',
    icon: Table2,
    contents: [
      'Searchable report table with status, depth, location, and submission time',
      'Filters for pending, verified, anomaly, and critical reports',
      'Report detail panel with photo, coordinates, and audit status',
      'Manual actions to verify, reject, or escalate a report',
    ],
  },
  {
    id: 'review-queue',
    label: 'Review Queue',
    mobileLabel: 'Review Queue',
    title: 'Review Queue',
    description: 'Handle reports flagged by rules or AI before they affect trusted public views.',
    icon: ShieldAlert,
    contents: [
      'Flagged report list with confidence and anomaly reasons',
      'Validation evidence summary from terrain, rainfall, and nearby reports',
      'Override, approve, reject, or defer actions',
      'Reviewer notes and resolution status tracking',
    ],
  },
];

export const monitoringFeatureMap = Object.fromEntries(
  monitoringFeatures.map((feature) => [feature.id, feature])
) as Record<MonitoringFeatureId, PortalNavItem<MonitoringFeatureId>>;
