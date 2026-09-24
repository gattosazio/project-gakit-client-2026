import {
  BellRing,
  LayoutDashboard,
  Table2,
  Waves,
} from 'lucide-react';
import { PortalNavItem } from '@/types/portal';

export type MonitoringFeatureId =
  | 'dashboard'
  | 'alerts'
  | 'reports'
  | 'scenarios';

export const monitoringFeatures: PortalNavItem<MonitoringFeatureId>[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    mobileLabel: 'Dashboard',
    title: 'Operations Dashboard',
    description: 'Review what needs attention, see live conditions, and track reports over the last 24 hours.',
    icon: LayoutDashboard,
    contents: [
      'Live conditions and active advisories',
      'Pending, flagged, and critical reports requiring a decision',
      'Hourly inflow, depth distribution, and top reported locations for the last 24 hours',
      'Historical archive of monthly report volume',
    ],
  },
  {
    id: 'alerts',
    label: 'Alerts & Notifications',
    mobileLabel: 'Alerts',
    title: 'Alerts & Notifications',
    description: 'Monitor new, flagged, and critical reports requiring staff attention.',
    icon: BellRing,
    contents: [
      'Critical reports awaiting validation',
      'Flagged reports requiring review',
      'New reports awaiting validation',
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
    id: 'scenarios',
    label: 'Flood Scenarios',
    mobileLabel: 'Scenarios',
    title: 'Flood Scenario Simulator',
    description: 'Replay historical disaster events and simulate hydrodynamic flood scenarios across Iligan City.',
    icon: Waves,
    badge: 'BETA',
    contents: [
      'Historical storm hindcasts (Typhoon Sendong 2011, Odette 2021)',
      'Official UP NOAH / PAGASA return-period design storms (5-Year, 25-Year, 100-Year)',
      'Hourly flood wave propagation and corridor overtopping analysis',
      'Peak discharge, depth stratification, and affected barangay telemetry',
    ],
  },
];

export const monitoringFeatureMap = Object.fromEntries(
  monitoringFeatures.map((feature) => [feature.id, feature])
) as Record<MonitoringFeatureId, PortalNavItem<MonitoringFeatureId>>;
