import { apiRequest } from '@/lib/backend/http';
import { cachedGet, invalidateApiCache } from '@/lib/backend/apiCache';
import type {
  AdminUser,
  AuditLogList,
  InviteResult,
  RoleView,
  UserListResult,
  UserStatus,
} from '@/types/admin';

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: UserStatus;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  action?: string;
  actor_email?: string;
  resource_type?: string;
  from_date?: string;
  to_date?: string;
}

const USERS_URL = '/api/v1/admin/users';
const ROLES_URL = '/api/v1/admin/roles';
const AUDIT_URL = '/api/v1/admin/audit-logs';

export async function listUsers(query: UserListQuery = {}): Promise<UserListResult> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null) params.set(key, String(value));
  });
  const queryString = params.toString();
  const url = `${USERS_URL}${queryString ? `?${queryString}` : ''}`;
  return cachedGet<UserListResult>(url, 30_000, () => apiRequest<UserListResult>(url));
}

export async function inviteUser(input: {
  email: string;
  role?: string;
}): Promise<InviteResult> {
  const result = await apiRequest<InviteResult>('/api/v1/admin/users/invite', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  invalidateApiCache(USERS_URL);
  return result;
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  await apiRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  invalidateApiCache(USERS_URL);
}

export async function updateUserStatus(
  userId: string,
  suspend: boolean
): Promise<void> {
  await apiRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ action: suspend ? 'suspend' : 'activate' }),
  });
  invalidateApiCache(USERS_URL);
}

export async function listRoles(): Promise<RoleView[]> {
  return cachedGet<RoleView[]>(ROLES_URL, 60_000, () =>
    apiRequest<RoleView[]>(ROLES_URL)
  );
}

export async function createRole(input: {
  name: string;
  description?: string | null;
}): Promise<RoleView> {
  const role = await apiRequest<RoleView>(ROLES_URL, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  invalidateApiCache(ROLES_URL);
  return role;
}

export async function updateRole(
  roleId: string,
  input: { description?: string | null; is_active?: boolean }
): Promise<RoleView> {
  const role = await apiRequest<RoleView>(
    `/api/v1/admin/roles/${encodeURIComponent(roleId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
  invalidateApiCache(ROLES_URL);
  return role;
}

export async function listAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogList> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null) params.set(key, String(value));
  });
  const queryString = params.toString();
  const url = `${AUDIT_URL}${queryString ? `?${queryString}` : ''}`;
  return cachedGet<AuditLogList>(url, 15_000, () => apiRequest<AuditLogList>(url));
}