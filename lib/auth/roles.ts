import type { SupabaseClient } from '@supabase/supabase-js';

export const ROLE_ADMIN = 'admin';
export const ROLE_STAFF = 'staff';

export type StaffRole = 'admin' | 'staff';

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

export function homePathForRole(role: StaffRole | null): string | null {
  if (role === ROLE_ADMIN) return '/admin';
  if (role === ROLE_STAFF) return '/monitoring';
  return null;
}

export function canAccessPath(pathname: string, role: StaffRole | null): boolean {
  if (pathname.startsWith('/admin')) return role === ROLE_ADMIN;
  if (pathname.startsWith('/monitoring')) return role === ROLE_STAFF;
  return true;
}
