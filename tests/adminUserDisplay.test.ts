import { describe, expect, it } from 'vitest';
import type { AdminUser } from '@/types/admin';
import { formatRoleLabel } from '@/app/admin/features/shared/adminFormatting';
import {
  userActivity,
  userIdentity,
  userInitials,
} from '@/app/admin/features/users/userDisplay';

const NOW = Date.parse('2026-10-27T12:00:00Z');

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-1',
    email: 'juan@example.gov',
    name: 'Juan Dela Cruz',
    role: 'staff',
    status: 'active',
    lastSignInAt: null,
    createdAt: '2026-10-20T08:00:00Z',
    invitedAt: null,
    ...overrides,
  };
}

describe('user display helpers', () => {
  it('builds identity and initials from name or email', () => {
    expect(userIdentity(makeUser())).toEqual({
      primary: 'Juan Dela Cruz',
      secondary: 'juan@example.gov',
    });
    expect(userInitials(makeUser())).toBe('JC');

    expect(userIdentity(makeUser({ name: null }))).toEqual({
      primary: 'juan@example.gov',
      secondary: null,
    });
    expect(userInitials(makeUser({ name: null }))).toBe('JU');
  });

  it('describes activity by lifecycle state', () => {
    expect(
      userActivity(
        makeUser({ status: 'pending', invitedAt: '2026-10-24T12:00:00Z' }),
        NOW
      ).label
    ).toBe('Invited 3d ago');

    expect(
      userActivity(
        makeUser({ lastSignInAt: '2026-10-27T10:00:00Z' }),
        NOW
      ).label
    ).toBe('Signed in 2h ago');

    expect(userActivity(makeUser(), NOW).label).toBe('Not signed in yet');

    expect(
      userActivity(
        makeUser({
          status: 'suspended',
          lastSignInAt: '2026-10-22T12:00:00Z',
        }),
        NOW
      ).label
    ).toBe('Last seen 5d ago');

    expect(
      userActivity(makeUser({ status: 'suspended' }), NOW).label
    ).toBe('No sign-in recorded');
  });

  it('falls back to createdAt for pending invitations', () => {
    expect(
      userActivity(
        makeUser({ status: 'pending', createdAt: '2026-10-25T12:00:00Z' }),
        NOW
      ).label
    ).toBe('Invited 2d ago');
  });

  it('humanizes role labels', () => {
    expect(formatRoleLabel('admin')).toBe('Admin');
    expect(formatRoleLabel('field_validator')).toBe('Field validator');
    expect(formatRoleLabel('field-validator')).toBe('Field validator');
    expect(formatRoleLabel(null)).toBe('No role');
  });
});
