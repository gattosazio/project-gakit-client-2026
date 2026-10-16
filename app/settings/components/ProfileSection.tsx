'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/auth/authErrors';


export function ProfileSection({
  initialName,
  onSaved,
}: {
  initialName: string;
  onSaved: (name: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const dirty = trimmed !== initialName.trim();
  const canSave = dirty && trimmed !== '' && !saving;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    const { error: updateError } = await createClient().auth.updateUser({
      data: { full_name: trimmed },
    });
    if (updateError) {
      setError(friendlyAuthError(updateError));
      setSaving(false);
      return;
    }

    onSaved(trimmed);
    toast.success('Profile updated');
    router.refresh();
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={saving} className="space-y-4">
      <div>
        <label
          htmlFor="display-name"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Display name
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoComplete="name"
          placeholder="e.g. Juan Dela Cruz"
          className="w-full rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-gakit-maroon/40 focus:bg-white focus:ring-2 focus:ring-gakit-maroon/10"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Shown in the portal header, sidebar, and user management.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {saving ? 'Saving profile changes' : ''}
      </p>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSave}
          className="rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
