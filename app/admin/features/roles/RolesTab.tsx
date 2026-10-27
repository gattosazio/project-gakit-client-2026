'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'react-toastify';
import { FeaturePageShell } from '@/components/FeaturePageShell';
import { AdminPagination } from '../shared/AdminPagination';
import { listRoles, updateRole } from '../../actions/admin';
import { RoleModal } from './RoleModal';
import { formatDateTime } from '@/lib/reports/reportFormatting';
import type { RoleView } from '@/types/admin';

const ROLES_PER_PAGE = 10;
const BUILTIN_ROLES = new Set(['admin', 'staff']);

export function RolesTab({ active = true }: { active?: boolean }) {
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleView | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    void listRoles()
      .then((result) => {
        setRoles(result);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load roles');
        setRoles([]);
      })
      .finally(() => setLoading(false));
  }, [active, refreshKey]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRoles = roles.filter((role) => {
    const matchesQuery =
      !normalizedQuery ||
      role.name.toLowerCase().includes(normalizedQuery) ||
      role.description?.toLowerCase().includes(normalizedQuery);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? role.isActive : !role.isActive);
    return matchesQuery && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / ROLES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ROLES_PER_PAGE;
  const pageRoles = filteredRoles.slice(startIndex, startIndex + ROLES_PER_PAGE);

  const refreshRoles = () => {
    setLoading(true);
    setError(null);
    setRefreshKey((key) => key + 1);
  };

  const handleToggleActive = async (role: RoleView) => {
    setToggling(role.id);
    try {
      await updateRole(role.id, { is_active: !role.isActive });
      toast.success(
        role.isActive ? `Role "${role.name}" deactivated.` : `Role "${role.name}" activated.`,
        { position: 'top-right', autoClose: 3000 }
      );
      refreshRoles();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update the role.';
      toast.error(message, { position: 'top-right', autoClose: 4000 });
    } finally {
      setToggling(null);
    }
  };

  const handleSaved = () => {
    setIsModalOpen(false);
    setEditingRole(null);
    refreshRoles();
  };

  return (
    <>
      <FeaturePageShell
        bare
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingRole(null);
              setIsModalOpen(true);
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add role
          </button>
        }
      >
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Unable to load roles
              </p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={refreshRoles}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon/40 focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : (
          <section
            aria-label="Roles"
            aria-busy={loading}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.02]"
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Role directory
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Manage role availability and membership.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                <div className="relative min-w-0 sm:w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search roles"
                    aria-label="Search roles"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-gakit-maroon/40 focus:ring-2 focus:ring-gakit-maroon/10"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setCurrentPage(1);
                      }}
                      aria-label="Clear role search"
                      className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon/30"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="relative sm:w-40">
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      const nextFilter = event.target.value;
                      setStatusFilter(
                        nextFilter === 'active' || nextFilter === 'inactive'
                          ? nextFilter
                          : 'all'
                      );
                      setCurrentPage(1);
                    }}
                    aria-label="Filter roles by status"
                    className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-gakit-maroon/40 focus:ring-2 focus:ring-gakit-maroon/10"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {pageRoles.map((role) => {
                const isBuiltin = BUILTIN_ROLES.has(role.name);
                const hasRoleIcon = role.name === 'admin';
                const isToggling = toggling === role.id;
                const hasMembers = role.memberCount > 0;
                const deactivateBlocked = isBuiltin || hasMembers;
                const blockedReason = isBuiltin
                  ? 'Built-in roles cannot be deactivated.'
                  : hasMembers
                    ? `Reassign the ${role.memberCount} member${
                        role.memberCount === 1 ? '' : 's'
                      } before deactivating this role.`
                    : null;

                return (
                  <article
                    key={role.id}
                    className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-slate-50/70 sm:px-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div className={`flex min-w-0 items-start ${hasRoleIcon ? 'gap-3' : ''}`}>
                      {hasRoleIcon && (
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
                        >
                          <Shield className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-all text-sm font-semibold text-slate-900">
                            {role.name}
                          </h3>
                          {isBuiltin && (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              Built-in
                            </span>
                          )}
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              role.isActive
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                            }`}
                          >
                            {role.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {role.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                            {role.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Users
                              className="h-3.5 w-3.5 text-slate-400"
                              aria-hidden="true"
                            />
                            {role.memberCount} member
                            {role.memberCount === 1 ? '' : 's'}
                          </span>
                          <span>
                            Created{' '}
                            <time
                              dateTime={role.createdAt}
                              title={formatDateTime(role.createdAt)}
                            >
                              {formatDateTime(role.createdAt)}
                            </time>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`flex shrink-0 items-center gap-2 ${
                        hasRoleIcon ? 'pl-[52px]' : ''
                      } md:pl-0`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRole(role);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon/40 focus-visible:ring-offset-2"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(role)}
                        disabled={
                          isToggling || (role.isActive && deactivateBlocked)
                        }
                        aria-label={
                          role.isActive && deactivateBlocked
                            ? `Role ${role.name} cannot be deactivated`
                            : `${role.isActive ? 'Deactivate' : 'Activate'} role ${role.name}`
                        }
                        title={
                          role.isActive && deactivateBlocked
                            ? blockedReason ?? undefined
                            : `${role.isActive ? 'Deactivate' : 'Activate'} role`
                        }
                        className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                          role.isActive
                            ? 'border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {isToggling && <Spinner size="sm" />}
                        {role.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </article>
                );
              })}

              {pageRoles.length === 0 && (
                <div
                  role={loading ? 'status' : undefined}
                  className="flex flex-col items-center px-5 py-12 text-center"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Shield className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    {loading
                      ? 'Loading roles…'
                      : roles.length === 0
                        ? 'No roles have been defined yet.'
                        : filteredRoles.length === 0
                          ? 'No roles match these filters.'
                          : 'No roles on this page.'}
                  </p>
                  {!loading && roles.length === 0 && (
                    <p className="mt-1 text-sm text-slate-500">
                      Add a role to organize access for your team.
                    </p>
                  )}
                  {!loading && roles.length > 0 && filteredRoles.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setStatusFilter('all');
                        setCurrentPage(1);
                      }}
                      className="mt-3 text-sm font-semibold text-gakit-maroon hover:text-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon/30"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <AdminPagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredRoles.length}
              pageSize={ROLES_PER_PAGE}
              itemLabel="roles"
              onPageChange={setCurrentPage}
            />
          </section>
        )}
      </FeaturePageShell>

      {isModalOpen && (
        <RoleModal
          key={editingRole?.id ?? 'new'}
          role={editingRole}
          onClose={() => {
            setIsModalOpen(false);
            setEditingRole(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
