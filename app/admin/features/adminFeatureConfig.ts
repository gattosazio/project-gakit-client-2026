import { ScrollText, ShieldCheck, Users } from 'lucide-react';
import { PortalNavItem } from '@/types/portal';

export type AdminFeatureId = 'users' | 'roles' | 'audit-logs';

export const adminFeatures: PortalNavItem<AdminFeatureId>[] = [
  {
    id: 'users',
    label: 'User Management',
    mobileLabel: 'Users',
    title: 'User Management',
    description: 'Invite users, change roles, and deactivate or reactivate accounts.',
    icon: Users,
    contents: [
      'Invite new platform users by email via Supabase Auth',
      'Assign and change roles from the roles catalog',
      'Deactivate or reactivate accounts with ban controls',
    ],
  },
  {
    id: 'roles',
    label: 'Role Management',
    mobileLabel: 'Roles',
    title: 'Role Management',
    description: 'Define the named roles that govern platform access and membership.',
    icon: ShieldCheck,
    contents: [
      'Create named roles for user assignment',
      'Edit role descriptions and activation state',
      'View live member counts per role',
    ],
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    mobileLabel: 'Audit',
    title: 'Audit Logs',
    description: 'Review governance actions across users, roles, and access.',
    icon: ScrollText,
    contents: [
      'Record of user invitations, role changes, and account deactivations',
      'Role catalog changes with actor and timestamp',
      'Search and filter tools for governance review',
    ],
  },
];

export const adminFeatureMap = Object.fromEntries(
  adminFeatures.map((feature) => [feature.id, feature])
) as Record<AdminFeatureId, PortalNavItem<AdminFeatureId>>;