import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canAccessPath,
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
  it('grants access only to the built-in admin and staff roles', () => {
    expect(roleGrantsPortalAccess('admin')).toBe(true);
    expect(roleGrantsPortalAccess('staff')).toBe(true);
    expect(roleGrantsPortalAccess('sentinel')).toBe(false);
    expect(roleGrantsPortalAccess('citizen')).toBe(false);
    expect(roleGrantsPortalAccess('dispatcher')).toBe(false);
    expect(roleGrantsPortalAccess('')).toBe(false);
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
  it('returns the role when it is a recognised built-in role', async () => {
    const admin = mockClient({ data: [{ role: 'admin' }], error: null });
    await expect(getStaffRole(admin.client, 'user-1')).resolves.toBe('admin');

    const staff = mockClient({ data: [{ role: 'staff' }], error: null });
    await expect(getStaffRole(staff.client, 'user-1')).resolves.toBe('staff');
  });

  it('fails closed to null for label-only or missing roles', async () => {
    const custom = mockClient({ data: [{ role: 'dispatcher' }], error: null });
    await expect(getStaffRole(custom.client, 'user-1')).resolves.toBeNull();

    const empty = mockClient({ data: [], error: null });
    await expect(getStaffRole(empty.client, 'user-1')).resolves.toBeNull();
  });

  it('fails closed to null on a query error', async () => {
    const failure = mockClient({ data: null, error: { message: 'boom' } });
    await expect(getStaffRole(failure.client, 'user-1')).resolves.toBeNull();
  });
});

describe('getBentoTilesForRole', () => {
  it('offers the Administration tile only to administrators', () => {
    const adminTiles = getBentoTilesForRole('admin');
    expect(adminTiles).toContainEqual(administrationBentoTile);

    expect(getBentoTilesForRole('staff')).not.toContainEqual(administrationBentoTile);
    expect(getBentoTilesForRole(null)).not.toContainEqual(administrationBentoTile);
  });
});
