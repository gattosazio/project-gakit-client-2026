'use client';

import { useEffect, useRef, useState } from 'react';
import { PlusCircle, RotateCcw, Search } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'react-toastify';
import { FeaturePageShell } from '@/components/FeaturePageShell';
import { AdminPagination } from '../shared/AdminPagination';
import {
  shortenId,
  USER_STATUS_META,
} from '../shared/adminFormatting';
import {
  listRoles,
  listUsers as fetchUsers,
  updateUserRole,
  updateUserStatus,
} from '../../actions/admin';
import { InviteUserModal } from './InviteUserModal';
import type { AdminUser, RoleView, UserStatus } from '@/types/admin';
import { formatDateTime } from '@/lib/reports/reportFormatting';

const USERS_PER_PAGE = 10;

export function UsersTab({ active = true }: { active?: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);
  const [savingStatusFor, setSavingStatusFor] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
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
        })
        .catch((err: unknown) => {
          if (seq !== requestSeqRef.current) return;
          setError(err instanceof Error ? err.message : 'Failed to load users');
          setUsers([]);
          setTotal(0);
          setTotalPages(1);
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

  const handleRoleChange = async (user: AdminUser, role: string) => {
    if (role === user.role) return;
    setSavingRoleFor(user.id);
    try {
      await updateUserRole(user.id, role);
      toast.success(`Role changed to "${role}".`, {
        position: 'top-right',
        autoClose: 3000,
      });
      setRefreshKey((key) => key + 1);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update role.',
        { position: 'top-right', autoClose: 4000 }
      );
      setRefreshKey((key) => key + 1);
    } finally {
      setSavingRoleFor(null);
    }
  };

  const handleStatusChange = async (user: AdminUser, suspend: boolean) => {
    setSavingStatusFor(user.id);
    try {
      await updateUserStatus(user.id, suspend);
      toast.success(
        suspend
          ? `${user.email ?? 'User'} deactivated.`
          : `${user.email ?? 'User'} reactivated.`,
        { position: 'top-right', autoClose: 3000 }
      );
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

  return (
    <>
      <FeaturePageShell
        actions={
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-800"
          >
            <PlusCircle className="h-4 w-4" />
            Add User
          </button>
        }
        toolbar={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(14rem,1fr)_10rem_10rem] xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_auto]">
            <label className="flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search email"
                className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
              />
            </label>
            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2 text-sm text-slate-700 outline-none focus:border-gakit-maroon/40 focus:bg-white"
            >
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as 'all' | UserStatus);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2 text-sm text-slate-700 outline-none focus:border-gakit-maroon/40 focus:bg-white"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Deactivated</option>
            </select>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!canReset}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                canReset
                  ? 'border-canvas-grey bg-white text-slate-700 hover:bg-canvas-light hover:border-slate-300 cursor-pointer'
                  : 'border-canvas-grey/60 bg-canvas-light/60 text-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <RotateCcw
                className={`h-4 w-4 transition-colors ${
                  canReset ? 'text-gakit-maroon' : 'text-slate-400'
                }`}
              />
              Reset
            </button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">
          {error ? (
            <div className="p-6 text-sm text-red-700">{error}</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead className="bg-canvas-light text-slate-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">User</th>
                      <th className="px-5 py-3 text-left font-semibold">Role</th>
                      <th className="px-5 py-3 text-left font-semibold">Status</th>
                      <th className="px-5 py-3 text-left font-semibold">Last sign-in</th>
                      <th className="px-5 py-3 text-left font-semibold">Created</th>
                      <th className="px-5 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-canvas-grey">
                    {users.map((user) => {
                      const status = USER_STATUS_META[user.status];
                      const savingRole = savingRoleFor === user.id;
                      const savingStatus = savingStatusFor === user.id;
                      return (
                        <tr key={user.id} className="hover:bg-canvas-light/70">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">
                              {user.email ?? 'No email'}
                            </div>
                            <div className="font-mono text-xs text-slate-400">
                              {shortenId(user.id)}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <select
                              value={user.role ?? ''}
                              disabled={savingRole}
                              onChange={(event) =>
                                void handleRoleChange(user, event.target.value)
                              }
                              className="rounded-lg border border-canvas-grey bg-canvas-light px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-gakit-maroon/40 focus:bg-white disabled:opacity-50"
                            >
                              {roles.length === 0 && (
                                <option value={user.role ?? ''}>
                                  {user.role ?? '—'}
                                </option>
                              )}
                              {roles.map((role) => (
                                <option
                                  key={role.id}
                                  value={role.name}
                                  disabled={!role.isActive}
                                >
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {user.lastSignInAt
                              ? formatDateTime(user.lastSignInAt)
                              : 'Never'}
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {user.createdAt
                              ? formatDateTime(user.createdAt)
                              : '—'}
                          </td>
                          <td className="px-5 py-4">
                            {user.status === 'suspended' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleStatusChange(user, false)
                                }
                                disabled={savingStatus}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {savingStatus && (
                                  <Spinner size="sm" />
                                )}
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleStatusChange(user, true)}
                                disabled={savingStatus}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                {savingStatus && (
                                  <Spinner size="sm" />
                                )}
                                Deactivate
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {users.length === 0 && loading && (
                      <>
                        {Array.from({ length: 5 }).map((_, index) => (
                          <tr key={index}>
                            <td className="px-5 py-4"><Skeleton className="h-3.5 w-40 rounded-md" /></td>
                            <td className="px-5 py-4"><Skeleton className="h-3.5 w-24 rounded-md" /></td>
                            <td className="px-5 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                            <td className="px-5 py-4"><Skeleton className="h-6 w-24 rounded-md" /></td>
                            <td className="px-5 py-4"><Skeleton className="h-3.5 w-28 rounded-md" /></td>
                            <td className="px-5 py-4"><Skeleton className="h-8 w-24 rounded-lg" /></td>
                          </tr>
                        ))}
                      </>
                    )}
                    {users.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-10 text-center text-sm text-slate-500"
                        >
                          No users match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-canvas-grey lg:hidden">
                {users.map((user) => {
                  const status = USER_STATUS_META[user.status];
                  return (
                    <div key={user.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {user.email ?? 'No email'}
                          </div>
                          <div className="font-mono text-xs text-slate-400">
                            {shortenId(user.id)}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={user.role ?? ''}
                          disabled={savingRoleFor === user.id}
                          onChange={(event) =>
                            void handleRoleChange(user, event.target.value)
                          }
                          className="rounded-lg border border-canvas-grey bg-canvas-light px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none disabled:opacity-50"
                        >
                          {roles.length === 0 && (
                            <option value={user.role ?? ''}>
                              {user.role ?? '—'}
                            </option>
                          )}
                          {roles.map((role) => (
                            <option
                              key={role.id}
                              value={role.name}
                              disabled={!role.isActive}
                            >
                              {role.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            void handleStatusChange(user, user.status !== 'suspended')
                          }
                          disabled={savingStatusFor === user.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-grey px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-canvas-light disabled:opacity-50"
                        >
                          {user.status === 'suspended' ? 'Reactivate' : 'Deactivate'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {users.length === 0 && !loading && (
                  <div className="px-5 py-10 text-center text-sm text-slate-500">
                    No users match the current filters.
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
    </>
  );
}