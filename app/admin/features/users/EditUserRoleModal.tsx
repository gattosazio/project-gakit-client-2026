'use client';

import { useId, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { updateUserRole } from '../../actions/admin';
import type { AdminUser, RoleView } from '@/types/admin';

/**
 * Assigns a single role to an existing user. Kept as a focused modal (rather
 * than an inline select) so the action is deliberate and the user's identity is
 * confirmed before the change is saved.
 */
export function EditUserRoleModal({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  roles: RoleView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState(user.role ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const titleId = useId();

  const displayName = user.name?.trim() || user.email || 'this user';
  const currentRole = user.role ?? '';
  const canSubmit = role !== '' && role !== currentRole && !submitting;

  // Keep the current role selectable even when the catalog has not loaded yet or
  // no longer lists it, so the user is never silently reassigned.
  const roleNames = new Set(roles.map((item) => item.name));
  const hasOrphanRole = currentRole !== '' && !roleNames.has(currentRole);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await updateUserRole(user.id, role);
      toast.success(`Role updated for ${displayName}.`, {
        position: 'top-right',
        autoClose: 3000,
      });
      onSaved();
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to update the role.'
      );
      setSubmitting(false);
    }
  };

  return (
    <Dialog isOpen onClose={onClose} ariaLabelledBy={titleId} maxWidthClass="max-w-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon-50">
            <ShieldCheck className="h-5 w-5 text-gakit-maroon" />
          </div>
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Edit role
            </h2>
            <p className="text-sm text-slate-500">Change what this user can access.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-canvas-light hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2.5">
        <div className="text-sm font-semibold text-slate-900">
          {user.name?.trim() || 'No name'}
        </div>
        <div className="text-xs text-slate-500">{user.email ?? 'No email'}</div>
      </div>

      {serverError && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <label className="mt-5 block">
        <span className="text-sm font-semibold text-slate-700">Role</span>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-gakit-maroon/40 focus:bg-white focus:ring-2 focus:ring-gakit-maroon/10"
        >
          {role === '' && <option value="">Select a role…</option>}
          {hasOrphanRole && <option value={currentRole}>{currentRole}</option>}
          {roles.map((item) => (
            <option
              key={item.id}
              value={item.name}
              disabled={!item.isActive && item.name !== currentRole}
            >
              {item.isActive ? item.name : `${item.name} (inactive)`}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-3 text-xs text-slate-500">
        Custom roles have the same access as staff. Only the built-in{' '}
        <span className="font-semibold">admin</span> role unlocks the
        Administration portal.
      </p>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg border border-canvas-grey px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && <Spinner size="sm" iconClassName="bg-white" />}
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Dialog>
  );
}
