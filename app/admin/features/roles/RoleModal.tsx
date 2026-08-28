'use client';

import { useState } from 'react';
import { Loader2, Shield, X } from 'lucide-react';
import { createRole, updateRole } from '../../actions/admin';
import type { RoleView } from '@/types/admin';

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
  const [slugError, setSlugError] = useState<string | null>(null);

  const trimmedName = name.trim().toLowerCase();
  const canSubmit =
    trimmedName.length >= 2 &&
    trimmedName.length <= 50 &&
    SLUG_RE.test(trimmedName) &&
    !submitting;

  const handleNameChange = (value: string) => {
    const normalized = value.trim().toLowerCase();
    setName(value);
    setSlugError(
      normalized && !SLUG_RE.test(normalized)
        ? 'Use lowercase letters, digits, and underscores only.'
        : null
    );
  };

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
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit role' : 'Add a role'}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon-50">
              <Shield className="h-5 w-5 text-gakit-maroon" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isEditing ? 'Edit role' : 'Add a role'}
              </h2>
              <p className="text-sm text-slate-500">
                {isEditing
                  ? 'Update the description or activation state.'
                  : 'A role is a named group users can be assigned to.'}
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
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="e.g. dispatcher"
                autoFocus
                className="mt-1.5 w-full rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2.5 font-mono text-sm text-slate-700 outline-none transition-colors placeholder:font-sans placeholder:text-slate-400 focus:border-gakit-maroon/40 focus:bg-white focus:ring-2 focus:ring-gakit-maroon/10"
              />
              {slugError && (
                <span className="mt-1 block text-xs text-red-600">{slugError}</span>
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

          <label className="flex items-center justify-between gap-4 rounded-lg border border-canvas-grey px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-700">
              Active role
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Inactive roles can&apos;t be assigned to new users.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((value) => !value)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                isActive ? 'bg-gakit-maroon' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  isActive ? 'left-[1.375rem]' : 'left-0.5'
                }`}
              />
            </button>
          </label>
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
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create role'}
          </button>
        </div>
      </div>
    </div>
  );
}