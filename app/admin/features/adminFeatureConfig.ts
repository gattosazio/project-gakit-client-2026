import {
  ClipboardList,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react';
import { PortalNavItem } from '@/types/portal';

export type AdminFeatureId =
  | 'dashboard'
  | 'access-requests'
  | 'users-roles'
  | 'system-settings'
  | 'audit-logs';

export const adminFeatures: PortalNavItem<AdminFeatureId>[] = [
  {
    id: 'dashboard',
    label: 'Platform Overview',
    title: 'Platform Overview',
    description: 'Manage access, governance, and configuration across the GAKIT platform.',
    icon: LayoutDashboard,
    contents: [
      'Summary of user counts, active roles, pending access requests, and system health',
      'Quick links into user administration and platform configuration',
      'Operational overview of account approvals and audit activity',
      'High-level administrative alerts and configuration reminders',
    ],
  },
  {
    id: 'access-requests',
    label: 'Access Requests',
    title: 'Access Requests',
    description: 'Review and approve staff, sentinel, or admin access requests before accounts are activated.',
    icon: ClipboardList,
    contents: [
      'Pending account request list with applicant role and organization',
      'Approve, reject, or defer actions with reviewer notes',
      'Validation of requester details before granting access',
      'Status tracking for processed access requests',
    ],
  },
  {
    id: 'users-roles',
    label: 'Users & Roles',
    title: 'Users and Roles',
    description: 'Manage platform users, their roles, and permission boundaries.',
    icon: Users,
    contents: [
      'User directory with role, status, and last activity',
      'Role assignment and permission scope management',
      'Account activation, suspension, and reset actions',
      'Trusted sentinel and admin privilege controls',
    ],
  },
  {
    id: 'system-settings',
    label: 'System Settings',
    title: 'System Settings',
    description: 'Control platform-level defaults, thresholds, and administrative preferences.',
    icon: Settings,
    contents: [
      'Flood depth labels and status threshold management',
      'Validation tuning references and global defaults',
      'Portal behavior, notification, and metadata settings',
      'Administrative configuration history and safeguards',
    ],
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    title: 'Audit Logs',
    description: 'Inspect governance-critical actions taken across accounts, roles, and configuration.',
    icon: ScrollText,
    contents: [
      'Record of account approvals, suspensions, and role changes',
      'Configuration update history with actor and timestamp',
      'Administrative action trail for compliance and investigation',
      'Search and filter tools for governance review',
    ],
  },
];

export const adminFeatureMap = Object.fromEntries(
  adminFeatures.map((feature) => [feature.id, feature])
) as Record<AdminFeatureId, PortalNavItem<AdminFeatureId>>;
