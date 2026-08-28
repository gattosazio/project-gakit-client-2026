'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, PlusCircle } from 'lucide-react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleView | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    setError(null);
    void listRoles()
      .then((result) => {
        setRoles(result);
        setToggleError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load roles');
        setRoles([]);
      })
      .finally(() => setLoading(false));
  }, [active, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(roles.length / ROLES_PER_PAGE));
  const startIndex = (currentPage - 1) * ROLES_PER_PAGE;
  const pageRoles = roles.slice(startIndex, startIndex + ROLES_PER_PAGE);

  const handleToggleActive = async (role: RoleView) => {
    setToggling(role.id);
    setToggleError(null);
    try {
      await updateRole(role.id, { is_active: !role.isActive });
      toast.success(
        role.isActive ? `Role "${role.name}" deactivated.` : `Role "${role.name}" activated.`,
        { position: 'top-right', autoClose: 3000 }
      );
      setRefreshKey((key) => key + 1);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update the role.';
      setToggleError(message);
      toast.error(message, { position: 'top-right', autoClose: 4000 });
    } finally {
      setToggling(null);
    }
  };

  const handleSaved = () => {
    setIsModalOpen(false);
    setEditingRole(null);
    setRefreshKey((key) => key + 1);
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
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-800"
          >
            <PlusCircle className="h-4 w-4" />
            Add Role
          </button>
        }
      >
        {error ? (
          <div className="rounded-2xl border border-canvas-grey bg-white p-6 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="bg-canvas-light text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Role</th>
                    <th className="px-5 py-3 text-left font-semibold">Members</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                    <th className="px-5 py-3 text-left font-semibold">Created</th>
                    <th className="px-5 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-grey">
                  {pageRoles.map((role) => {
                    const isBuiltin = BUILTIN_ROLES.has(role.name);
                    const isToggling = toggling === role.id;
                    return (
                      <tr key={role.id} className="hover:bg-canvas-light/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-slate-900">
                              {role.name}
                            </span>
                            {isBuiltin && (
                              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                Built-in
                              </span>
                            )}
                          </div>
                          {role.description && (
                            <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                              {role.description}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {role.memberCount} member{role.memberCount === 1 ? '' : 's'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              role.isActive
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-100 text-slate-500'
                            }`}
                          >
                            {role.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {formatDateTime(role.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRole(role);
                                setIsModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-grey bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-canvas-light"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleActive(role)}
                              disabled={isBuiltin || isToggling}
                              title={
                                isBuiltin
                                  ? 'Built-in roles cannot be deactivated.'
                                  : role.isActive
                                  ? 'Deactivate role'
                                  : 'Activate role'
                              }
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                role.isActive
                                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {isToggling && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              )}
                              {role.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pageRoles.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-sm text-slate-500"
                      >
                        No roles have been defined yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-canvas-grey lg:hidden">
              {pageRoles.map((role) => {
                const isBuiltin = BUILTIN_ROLES.has(role.name);
                return (
                  <div key={role.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm font-semibold text-slate-900">
                          {role.name}
                        </div>
                        {role.description && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            {role.description}
                          </div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          role.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        }`}
                      >
                        {role.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {role.memberCount} member{role.memberCount === 1 ? '' : 's'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRole(role);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-grey bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-canvas-light"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(role)}
                        disabled={isBuiltin || toggling === role.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-grey px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {role.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {pageRoles.length === 0 && !loading && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  No roles have been defined yet.
                </div>
              )}
            </div>

            <AdminPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={roles.length}
              pageSize={ROLES_PER_PAGE}
              itemLabel="roles"
              onPageChange={setCurrentPage}
            />
          </div>
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