import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canAccessPath,
  getDisplayName,
  getStaffRole,
  homePathForRole,
  roleGrantsPortalAccess,
} from '@/lib/auth/roles';
import {
  administrationBentoTile,
  getBentoTilesForRole,
} from '@/lib/navigation/bentoMenu';

function mockClient(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, from, select, eq, limit };
}

describe('roleGrantsPortalAccess', () => {
  it('grants access to any assigned catalog role', () => {
    expect(roleGrantsPortalAccess('admin')).toBe(true);
    expect(roleGrantsPortalAccess('staff')).toBe(true);
    // Custom roles are staff-equivalent until granular permissions exist.
    expect(roleGrantsPortalAccess('sentinel')).toBe(true);
    expect(roleGrantsPortalAccess('dispatcher')).toBe(true);
    expect(roleGrantsPortalAccess('')).toBe(false);
    expect(roleGrantsPortalAccess('   ')).toBe(false);
  });
});

describe('homePathForRole', () => {
  it('sends admin and staff to the monitoring portal', () => {
    expect(homePathForRole('admin')).toBe('/monitoring');
    expect(homePathForRole('staff')).toBe('/monitoring');
  });

  it('returns no home for anonymous or label-only roles', () => {
    expect(homePathForRole(null)).toBeNull();
  });
});

describe('canAccessPath', () => {
  it('restricts the admin portal to administrators', () => {
    expect(canAccessPath('/admin', 'admin')).toBe(true);
    expect(canAccessPath('/admin/roles', 'admin')).toBe(true);
    expect(canAccessPath('/admin', 'staff')).toBe(false);
    expect(canAccessPath('/admin', null)).toBe(false);
  });

  it('allows admin and staff into monitoring and settings', () => {
    for (const role of ['admin', 'staff'] as const) {
      expect(canAccessPath('/monitoring', role)).toBe(true);
      expect(canAccessPath('/settings', role)).toBe(true);
    }
    expect(canAccessPath('/monitoring', null)).toBe(false);
    expect(canAccessPath('/settings', null)).toBe(false);
  });

  it('leaves public routes reachable by everyone', () => {
    expect(canAccessPath('/', null)).toBe(true);
    expect(canAccessPath('/flood-scenarios', null)).toBe(true);
    expect(canAccessPath('/login', null)).toBe(true);
  });
});

describe('getStaffRole', () => {
  it('returns the built-in role when it is recognised', async () => {
    const admin = mockClient({ data: [{ role: 'admin' }], error: null });
    await expect(getStaffRole(admin.client, 'user-1')).resolves.toBe('admin');

    const staff = mockClient({ data: [{ role: 'staff' }], error: null });
    await expect(getStaffRole(staff.client, 'user-1')).resolves.toBe('staff');
  });

  it('maps any custom catalog role to staff-level access', async () => {
    const custom = mockClient({ data: [{ role: 'dispatcher' }], error: null });
    await expect(getStaffRole(custom.client, 'user-1')).resolves.toBe('staff');
  });

  it('fails closed to null for missing or blank roles', async () => {
    const empty = mockClient({ data: [], error: null });
    await expect(getStaffRole(empty.client, 'user-1')).resolves.toBeNull();

    const blank = mockClient({ data: [{ role: '   ' }], error: null });
    await expect(getStaffRole(blank.client, 'user-1')).resolves.toBeNull();
  });

  it('fails closed to null on a query error', async () => {
    const failure = mockClient({ data: null, error: { message: 'boom' } });
    await expect(getStaffRole(failure.client, 'user-1')).resolves.toBeNull();
  });
});

describe('getDisplayName', () => {
  it('prefers full_name then name from metadata', () => {
    expect(getDisplayName({ full_name: '  Jane Cruz ' }, null)).toBe('Jane Cruz');
    expect(getDisplayName({ name: 'Jane Cruz' }, null)).toBe('Jane Cruz');
    expect(getDisplayName({ full_name: '', name: 'Fallback' }, null)).toBe('Fallback');
  });

  it('falls back to email when no name is present', () => {
    expect(getDisplayName(null, 'jane@example.gov')).toBe('jane@example.gov');
    expect(getDisplayName({}, 'jane@example.gov')).toBe('jane@example.gov');
    expect(getDisplayName({ full_name: '   ' }, 'jane@example.gov')).toBe('jane@example.gov');
  });

  it('returns null when neither name nor email exist', () => {
    expect(getDisplayName(null, null)).toBeNull();
    expect(getDisplayName(undefined, undefined)).toBeNull();
  });
});

describe('getBentoTilesForRole', () => {
  it('replaces Monitoring with Login for guests without changing signed-in menus', () => {
    const guest = getBentoTilesForRole(null);
    expect(guest).toContainEqual({ id: 'login', label: 'Login', href: '/login' });
    expect(guest.some(tile => tile.id === 'monitoring-portal')).toBe(false);
    expect(getBentoTilesForRole('staff').some(tile => tile.id === 'monitoring-portal')).toBe(true);
    expect(getBentoTilesForRole('admin').some(tile => tile.id === 'login')).toBe(false);
  });

  it('offers the Administration tile only to administrators', () => {
    const adminTiles = getBentoTilesForRole('admin');
    expect(adminTiles).toContainEqual(administrationBentoTile);

    expect(getBentoTilesForRole('staff')).not.toContainEqual(administrationBentoTile);
    expect(getBentoTilesForRole(null)).not.toContainEqual(administrationBentoTile);
  });
});
