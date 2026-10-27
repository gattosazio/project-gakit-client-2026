export type UserStatus = 'active' | 'suspended' | 'pending';

export interface AdminUser {
  id: string;
  email: string | null;
  /** Display name captured at invite time (Auth `user_metadata.full_name`). */
  name: string | null;
  role: string | null;
  status: UserStatus;
  lastSignInAt: string | null;
  createdAt: string | null;
  invitedAt: string | null;
}

export interface UserStatusCounts {
  active: number;
  pending: number;
  suspended: number;
}

export interface InviteResult extends AdminUser {
  /** One-time link the invitee uses to set their password. */
  inviteLink: string | null;
  /** True when the backend delivered the invitation by email. */
  emailSent: boolean;
}

export interface UserListResult {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: UserStatusCounts;
}

export interface RoleView {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogList {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}