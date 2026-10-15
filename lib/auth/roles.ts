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
  name: string | null;
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
  if (typeof role !== 'string' || role.trim() === '') return null;
  // Only the built-in `admin` role unlocks the Administration portal; every
  // other catalog role is staff-equivalent (custom roles share the staff
  // permission set until a granular permission system exists).
  return role === ROLE_ADMIN ? ROLE_ADMIN : ROLE_STAFF;
}

/**
 * Whether a named role grants access to any protected portal route. Every
 * catalog role does: custom roles are staff-equivalent, so any non-empty role
 * name confers staff-level access (see `canAccessPath`).
 */
export function roleGrantsPortalAccess(roleName: string): boolean {
  return roleName.trim() !== '';
}

/**
 * Extracts a display name from a Supabase Auth user's metadata. Falls back to
 * `email` so existing users without a name still have something to show.
 */
export function getDisplayName(
  metadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined
): string | null {
  if (metadata) {
    for (const key of ['full_name', 'name']) {
      const value = metadata[key];
      if (typeof value === 'string' && value.trim() !== '') return value.trim();
    }
  }
  return email ?? null;
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
