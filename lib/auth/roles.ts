import type { SupabaseClient } from '@supabase/supabase-js';

export const ROLE_ADMIN = 'admin';
export const ROLE_STAFF = 'staff';

export type StaffRole = 'admin' | 'staff';

/**
 * Serializable auth state resolved on the server so client shells can hydrate
 * user-dependent UI (account buttons, role badges) without post-hydration
 * network waterfalls.
 */
export interface AuthSnapshot {
  email: string | null;
  role: StaffRole | null;
}

export async function getStaffRole(
  client: SupabaseClient,
  userId: string
): Promise<StaffRole | null> {
  const { data, error } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const role: unknown = data[0]?.role;
  return role === ROLE_ADMIN || role === ROLE_STAFF ? role : null;
}

/**
 * Whether a named role grants access to any protected portal route. Only the
 * built-in `admin` and `staff` roles do; every other catalog role is an
 * organizational label that confers no access (see `canAccessPath`).
 */
export function roleGrantsPortalAccess(roleName: string): boolean {
  return roleName === ROLE_ADMIN || roleName === ROLE_STAFF;
}

export function homePathForRole(role: StaffRole | null): string | null {
  if (role === ROLE_ADMIN || role === ROLE_STAFF) return '/monitoring';
  return null;
}

export function canAccessPath(pathname: string, role: StaffRole | null): boolean {
  if (pathname.startsWith('/admin')) return role === ROLE_ADMIN;
  if (pathname.startsWith('/monitoring')) return role === ROLE_ADMIN || role === ROLE_STAFF;
  if (pathname.startsWith('/settings')) return role === ROLE_ADMIN || role === ROLE_STAFF;
  return true;
}
