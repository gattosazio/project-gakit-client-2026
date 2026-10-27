'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  RotateCcw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'react-toastify';
import { FeaturePageShell } from '@/components/FeaturePageShell';
import { AdminPagination } from '../shared/AdminPagination';
import { USER_STATUS_META, formatRoleLabel } from '../shared/adminFormatting';
import {
  listRoles,
  listUsers as fetchUsers,
  updateUserStatus,
} from '../../actions/admin';
import { InviteUserModal } from './InviteUserModal';
import { EditUserRoleModal } from './EditUserRoleModal';
import { ResendInviteModal } from './ResendInviteModal';
import { UserRowActions } from './UserRowActions';
import { UserStatusTabs } from './UserStatusTabs';
import { userActivity, userIdentity, userInitials } from './userDisplay';
import type {
  AdminUser,
  RoleView,
  UserStatus,
  UserStatusCounts,
} from '@/types/admin';
import { formatDateTime } from '@/lib/reports/reportFormatting';

const USERS_PER_PAGE = 10;

const secondaryActionClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon/40 focus-visible:ring-offset-2';
const primaryActionClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-3 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2';

function UserAvatar({ user }: { user: AdminUser }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-200"
    >
      {userInitials(user)}
    </span>
  );
}

function UserRoleLabel({ role }: { role: string | null }) {
  if (!role) {
    return <span className="text-xs text-slate-400">No role</span>;
  }

  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gakit-maroon">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {formatRoleLabel(role)}
      </span>
    );
  }

  return (
    <span className="text-xs font-medium text-slate-600">
      {formatRoleLabel(role)}
    </span>
  );
}

function UserStatusBadge({ status }: { status: UserStatus }) {
  const meta = USER_STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function UserActivityLabel({ user }: { user: AdminUser }) {
  const activity = userActivity(user);

  if (!activity.timestamp) {
    return <span>{activity.label}</span>;
  }

  return (
    <time
      dateTime={activity.timestamp}
      title={formatDateTime(activity.timestamp)}
    >
      {activity.label}
    </time>
  );
}

function UsersEmptyState({
  canReset,
  onReset,
  onInvite,
}: {
  canReset: boolean;
  onReset: () => void;
  onInvite: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Users className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">
        {canReset ? 'No users match these filters' : 'No users yet'}
      </p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {canReset
          ? 'Try a different name, role, or status.'
          : 'Invite your first user to get started.'}
      </p>
      {canReset ? (
        <button
          type="button"
          onClick={onReset}
          className={`mt-4 ${secondaryActionClass}`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Clear filters
        </button>
      ) : (
        <button
          type="button"
          onClick={onInvite}
          className={`mt-4 ${primaryActionClass}`}
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Invite user
        </button>
      )}
    </div>
  );
}

export function UsersTab({ active = true }: { active?: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState<UserStatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [savingStatusFor, setSavingStatusFor] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [resendingUser, setResendingUser] = useState<AdminUser | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void listRoles()
      .then((result) => {
        if (!cancelled) setRoles(result);
      })
      .catch(() => {
        if (!cancelled) setRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const seq = requestSeqRef.current + 1;
      requestSeqRef.current = seq;
      setLoading(true);
      setError(null);

      void fetchUsers({
        page: currentPage,
        limit: USERS_PER_PAGE,
        search: query.trim() || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
        .then((result) => {
          if (seq !== requestSeqRef.current) return;
          setUsers(result.items);
          setTotal(result.total);
          setTotalPages(Math.max(1, result.totalPages));
          setCounts(result.counts ?? null);
        })
        .catch((err: unknown) => {
          if (seq !== requestSeqRef.current) return;
          console.error('Failed to load users:', err);
          setError(err instanceof Error ? err.message : 'Failed to load users');
          setUsers([]);
          setTotal(0);
          setTotalPages(1);
          setCounts(null);
        })
        .finally(() => {
          if (seq === requestSeqRef.current) setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [active, currentPage, query, roleFilter, statusFilter, refreshKey]);

  const canReset =
    query.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all';

  const resetFilters = () => {
    setQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleStatusChange = async (user: AdminUser, suspend: boolean) => {
    setSavingStatusFor(user.id);
    try {
      await updateUserStatus(user.id, suspend);
      const label = user.name?.trim() || user.email || 'User';
      toast.success(suspend ? `${label} deactivated.` : `${label} reactivated.`, {
        position: 'top-right',
        autoClose: 3000,
      });
      setRefreshKey((key) => key + 1);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update status.',
        { position: 'top-right', autoClose: 4000 }
      );
    } finally {
      setSavingStatusFor(null);
    }
  };

  const handleInvited = () => {
    setIsInviteOpen(false);
    setCurrentPage(1);
    setRefreshKey((key) => key + 1);
  };

  const handleRoleSaved = () => {
    setEditingUser(null);
    setRefreshKey((key) => key + 1);
  };

  const handleInviteResent = () => {
    setResendingUser(null);
    setRefreshKey((key) => key + 1);
  };

  const renderRowActions = (user: AdminUser) => (
    <UserRowActions
      userLabel={userIdentity(user).primary}
      status={user.status}
      busy={savingStatusFor === user.id}
      onEditRole={() => setEditingUser(user)}
      onResendInvite={() => setResendingUser(user)}
      onToggleStatus={() =>
        void handleStatusChange(user, user.status !== 'suspended')
      }
    />
  );

  return (
    <>
      <FeaturePageShell bare>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 transition-colors focus-within:border-gakit-maroon/40 focus-within:ring-2 focus-within:ring-gakit-maroon/10 sm:min-w-[16rem]">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search name or email"
              aria-label="Search users by name or email"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCurrentPage(1);
                }}
                aria-label="Clear search"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon/30"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="relative sm:w-44">
            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by role"
              className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-gakit-maroon/40 focus:ring-2 focus:ring-gakit-maroon/10"
            >
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {formatRoleLabel(role.name)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
          </div>

          {canReset && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon/40 focus-visible:ring-offset-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 active:scale-[0.98] sm:ml-auto"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Invite user
          </button>
        </div>

        <div
          aria-busy={loading}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.02]"
        >
          <UserStatusTabs
            value={statusFilter}
            counts={counts}
            busy={loading}
            onChange={(next) => {
              if (next === statusFilter) return;
              setStatusFilter(next);
              setCurrentPage(1);
            }}
          />

          {error ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Unable to load users
                </p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Check your connection and try again. If the problem continues,
                  contact support.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                className={secondaryActionClass}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">Users</caption>
                  <thead>
                    <tr className="border-b border-slate-200 bg-white">
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 xl:px-5"
                      >
                        User
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 xl:px-5"
                      >
                        Role
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 xl:px-5"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 xl:px-5"
                      >
                        Activity
                      </th>
                      <th
                        scope="col"
                        className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 xl:table-cell xl:px-5"
                      >
                        Created
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 xl:px-5"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => {
                      const identity = userIdentity(user);
                      return (
                        <tr
                          key={user.id}
                          className="transition-colors hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-3.5 xl:px-5">
                            <div className="flex min-w-0 items-center gap-3">
                              <UserAvatar user={user} />
                              <div className="min-w-0 max-w-[22rem]">
                                <div className="truncate text-sm font-semibold text-slate-900">
                                  {identity.primary}
                                </div>
                                {identity.secondary && (
                                  <div className="truncate text-xs text-slate-500">
                                    {identity.secondary}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 xl:px-5">
                            <UserRoleLabel role={user.role} />
                          </td>
                          <td className="px-4 py-3.5 xl:px-5">
                            <UserStatusBadge status={user.status} />
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 xl:px-5">
                            <UserActivityLabel user={user} />
                          </td>
                          <td className="hidden px-4 py-3.5 text-xs tabular-nums text-slate-500 xl:table-cell xl:px-5">
                            {user.createdAt ? (
                              <time
                                dateTime={user.createdAt}
                                title={formatDateTime(user.createdAt)}
                              >
                                {formatDateTime(user.createdAt)}
                              </time>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right xl:px-5">
                            {renderRowActions(user)}
                          </td>
                        </tr>
                      );
                    })}

                    {users.length === 0 &&
                      loading &&
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3.5 xl:px-5">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-9 w-9 rounded-xl" />
                              <div>
                                <Skeleton className="h-3.5 w-40 rounded-md" />
                                <Skeleton className="mt-2 h-3 w-52 rounded-md" />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 xl:px-5">
                            <Skeleton className="h-3.5 w-16 rounded-md" />
                          </td>
                          <td className="px-4 py-3.5 xl:px-5">
                            <Skeleton className="h-6 w-24 rounded-full" />
                          </td>
                          <td className="px-4 py-3.5 xl:px-5">
                            <Skeleton className="h-3.5 w-24 rounded-md" />
                          </td>
                          <td className="hidden px-4 py-3.5 xl:table-cell xl:px-5">
                            <Skeleton className="h-3.5 w-28 rounded-md" />
                          </td>
                          <td className="px-4 py-3.5 xl:px-5">
                            <div className="flex justify-end">
                              <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                          </td>
                        </tr>
                      ))}

                    {users.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="px-6 py-14">
                          <UsersEmptyState
                            canReset={canReset}
                            onReset={resetFilters}
                            onInvite={() => setIsInviteOpen(true)}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {users.map((user) => {
                  const identity = userIdentity(user);
                  return (
                    <div key={user.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <UserAvatar user={user} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {identity.primary}
                            </div>
                            {identity.secondary && (
                              <div className="truncate text-xs text-slate-500">
                                {identity.secondary}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <UserStatusBadge status={user.status} />
                          {renderRowActions(user)}
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Role
                          </dt>
                          <dd className="mt-0.5">
                            <UserRoleLabel role={user.role} />
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Activity
                          </dt>
                          <dd className="mt-0.5 text-slate-600">
                            <UserActivityLabel user={user} />
                          </dd>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Created
                          </dt>
                          <dd className="mt-0.5 tabular-nums text-slate-600">
                            {user.createdAt ? (
                              <time
                                dateTime={user.createdAt}
                                title={formatDateTime(user.createdAt)}
                              >
                                {formatDateTime(user.createdAt)}
                              </time>
                            ) : (
                              '—'
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}

                {users.length === 0 &&
                  loading &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-xl" />
                          <div>
                            <Skeleton className="h-3.5 w-36 rounded-md" />
                            <Skeleton className="mt-2 h-3 w-48 rounded-md" />
                          </div>
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                      <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                        <Skeleton className="h-3 w-16 rounded-md" />
                        <Skeleton className="h-3 w-20 rounded-md" />
                        <Skeleton className="h-3 w-16 rounded-md" />
                      </div>
                    </div>
                  ))}

                {users.length === 0 && !loading && (
                  <div className="px-5 py-14">
                    <UsersEmptyState
                      canReset={canReset}
                      onReset={resetFilters}
                      onInvite={() => setIsInviteOpen(true)}
                    />
                  </div>
                )}
              </div>

              <AdminPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={total}
                pageSize={USERS_PER_PAGE}
                itemLabel="users"
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </FeaturePageShell>

      {isInviteOpen && (
        <InviteUserModal
          roles={roles}
          onClose={() => setIsInviteOpen(false)}
          onInvited={handleInvited}
        />
      )}

      {editingUser && (
        <EditUserRoleModal
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onSaved={handleRoleSaved}
        />
      )}

      {resendingUser && (
        <ResendInviteModal
          user={resendingUser}
          onClose={() => setResendingUser(null)}
          onResent={handleInviteResent}
        />
      )}
    </>
  );
}
