import type { AdminUser } from '@/types/admin';
import { timeAgo } from '@/lib/reports/reportFormatting';

export interface UserIdentity {
  primary: string;
  secondary: string | null;
}

export interface UserActivity {
  label: string;
  timestamp: string | null;
}

/** Primary display name with an email fallback, plus the email as sub-text. */
export function userIdentity(user: AdminUser): UserIdentity {
  const name = user.name?.trim() || '';
  if (name) return { primary: name, secondary: user.email };
  return { primary: user.email || 'No email', secondary: null };
}

/** Two-letter initials for the row avatar, derived from name or email. */
export function userInitials(user: AdminUser): string {
  const source = user.name?.trim() || user.email?.trim() || '';
  if (!source) return '?';

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function activityTimestamp(value: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return value;
}

/**
 * One activity label that adapts to the account's lifecycle state:
 * pending accounts are defined by when they were invited, while active and
 * deactivated accounts are defined by when they last signed in.
 */
export function userActivity(user: AdminUser, now = Date.now()): UserActivity {
  if (user.status === 'pending') {
    const timestamp = activityTimestamp(user.invitedAt ?? user.createdAt);
    return timestamp
      ? { label: `Invited ${timeAgo(timestamp, now)}`, timestamp }
      : { label: 'Invitation pending', timestamp: null };
  }

  if (user.status === 'suspended') {
    const timestamp = activityTimestamp(user.lastSignInAt);
    return timestamp
      ? { label: `Last seen ${timeAgo(timestamp, now)}`, timestamp }
      : { label: 'No sign-in recorded', timestamp: null };
  }

  const timestamp = activityTimestamp(user.lastSignInAt);
  return timestamp
    ? { label: `Signed in ${timeAgo(timestamp, now)}`, timestamp }
    : { label: 'Not signed in yet', timestamp: null };
}
