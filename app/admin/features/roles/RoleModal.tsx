'use client';

import { useId, useState } from 'react';
import { Shield, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { createRole, updateRole } from '../../actions/admin';
import { roleGrantsPortalAccess } from '@/lib/auth/roles';
import type { RoleView } from '@/types/admin';

const MIN_ROLE_NAME_LENGTH = 2;
const MAX_ROLE_NAME_LENGTH = 50;
const SLUG_RE = /^[a-z0-9_]+$/;

export function RoleModal({
  role,
  onClose,
  onSaved,
}: {
  role?: RoleView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(role);
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [isActive, setIsActive] = useState(role?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const titleId = useId();

  const trimmedName = name.trim().toLowerCase();
  const nameError = !trimmedName
    ? null
    : trimmedName.length < MIN_ROLE_NAME_LENGTH
    ? `Use at least ${MIN_ROLE_NAME_LENGTH} characters.`
    : trimmedName.length > MAX_ROLE_NAME_LENGTH
    ? `Use at most ${MAX_ROLE_NAME_LENGTH} characters.`
    : !SLUG_RE.test(trimmedName)
    ? 'Use lowercase letters, digits, and underscores only.'
    : null;
  const canSubmit = trimmedName.length > 0 && !nameError && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setServerError(null);
    try {
      if (isEditing && role) {
        await updateRole(role.id, {
          description: description.trim() || null,
          is_active: isActive,
        });
      } else {
        await createRole({
          name: trimmedName,
          description: description.trim() || null,
        });
      }
      onSaved();
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to save the role.'
      );
      setSubmitting(false);
    }
  };

  return (
    <Dialog isOpen onClose={onClose} ariaLabelledBy={titleId} maxWidthClass="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon-50">
              <Shield className="h-5 w-5 text-gakit-maroon" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                {isEditing ? 'Edit role' : 'Add a role'}
              </h2>
              <p className="text-sm text-slate-500">
                {isEditing
                  ? 'Update the description or activation state.'
                  : 'A role is an organizational label users can be assigned to.'}
              </p>
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

        {(!isEditing || (role && !roleGrantsPortalAccess(role.name))) && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Roles are organizational labels. Only the built-in{' '}
            <span className="font-semibold">admin</span> and{' '}
            <span className="font-semibold">staff</span> roles grant access to
            the admin and monitoring portals, so users assigned this role will
            not be able to sign in to protected areas.
          </div>
        )}

        {serverError && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="mt-5 space-y-4">
          {!isEditing && (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. dispatcher"
                maxLength={MAX_ROLE_NAME_LENGTH}
                autoFocus
                className="mt-1.5 w-full rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2.5 font-mono text-sm text-slate-700 outline-none transition-colors placeholder:font-sans placeholder:text-slate-400 focus:border-gakit-maroon/40 focus:bg-white focus:ring-2 focus:ring-gakit-maroon/10"
              />
              {nameError && (
                <span className="mt-1 block text-xs text-red-600">{nameError}</span>
              )}
            </label>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Optional description of what this role is for."
              className="mt-1.5 w-full resize-none rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-gakit-maroon/40 focus:bg-white focus:ring-2 focus:ring-gakit-maroon/10"
            />
          </label>

          {isEditing && (
            <Switch
              checked={isActive}
              onChange={setIsActive}
              label="Active role"
              description="Inactive roles can't be assigned to new users."
            />
          )}
        </div>

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
            {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create role'}
          </button>
        </div>
    </Dialog>
  );
}