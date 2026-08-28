export type UserStatus = 'active' | 'suspended';

export interface AdminUser {
  id: string;
  email: string | null;
  role: string | null;
  status: UserStatus;
  lastSignInAt: string | null;
  createdAt: string | null;
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