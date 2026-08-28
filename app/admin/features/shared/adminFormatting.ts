import type { UserStatus } from '@/types/admin';

export const ROLE_BADGE_CLASS: Record<string, string> = {
  admin: 'bg-maroon-50 text-gakit-maroon border-gakit-maroon/20',
  staff: 'bg-blue-50 text-blue-700 border-blue-200',
  sentinel: 'bg-purple-50 text-purple-700 border-purple-200',
  citizen: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function roleBadgeClass(role: string | null): string {
  return (role && ROLE_BADGE_CLASS[role]) || 'bg-slate-100 text-slate-600 border-slate-200';
}

export const USER_STATUS_META: Record<UserStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  suspended: { label: 'Deactivated', className: 'bg-red-50 text-red-700 border-red-200' },
};

export const AUDIT_ACTION_META: Record<string, { label: string; className: string }> = {
  'user.invited': { label: 'Invitation sent', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  'user.role_changed': { label: 'Role changed', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  'user.suspended': { label: 'User deactivated', className: 'bg-red-50 text-red-700 border-red-200' },
  'user.activated': { label: 'User reactivated', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'role.created': { label: 'Role created', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  'role.updated': { label: 'Role updated', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export function auditActionMeta(action: string): { label: string; className: string } {
  return AUDIT_ACTION_META[action] ?? {
    label: action,
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  };
}

export const AUDIT_ACTION_OPTIONS = Object.keys(AUDIT_ACTION_META);

export function shortenId(id: string | null): string {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function formatJsonDetails(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  const entries = Object.entries(details)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  return entries.length > 0 ? entries.join(', ') : '—';
}