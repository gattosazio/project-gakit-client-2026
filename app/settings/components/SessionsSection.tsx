'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { Dialog } from '@/components/ui/Dialog';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError } from '@/lib/auth/authErrors';

type Scope = 'others' | 'global';

const COPY: Record<Scope, { title: string; body: string; confirm: string }> = {
  others: {
    title: 'Sign out other devices?',
    body: 'You will stay signed in on this browser. Every other device will be signed out.',
    confirm: 'Sign out others',
  },
  global: {
    title: 'Sign out everywhere?',
    body: 'You will be signed out on every device, including this one.',
    confirm: 'Sign out everywhere',
  },
};

export function SessionsSection() {
  const router = useRouter();
  const titleId = useId();
  const [pending, setPending] = useState<Scope | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(scope: Scope) {
    setBusy(true);
    const { error } = await createClient().auth.signOut({ scope });
    if (error) {
      toast.error(friendlyAuthError(error));
      setBusy(false);
      setPending(null);
      return;
    }

    if (scope === 'global') {
      router.replace('/login');
      router.refresh();
      return;
    }

    toast.success('Signed out of your other devices');
    setBusy(false);
    setPending(null);
  }

  const copy = pending ? COPY[pending] : null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-canvas-grey px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-slate-700">Other devices</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Keep this browser signed in and end every other session.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPending('others')}
            className="rounded-lg border border-canvas-grey px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Sign out others
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-red-700">All devices</p>
            <p className="mt-0.5 text-xs text-red-600/80">
              End every session, including this one, and return to sign in.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPending('global')}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Sign out everywhere
          </button>
        </div>
      </div>

      <Dialog
        isOpen={pending !== null}
        onClose={() => {
          if (!busy) setPending(null);
        }}
        ariaLabelledBy={titleId}
        maxWidthClass="max-w-sm"
      >
        <h2 id={titleId} className="text-base font-semibold text-slate-900">
          {copy?.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{copy?.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPending(null)}
            disabled={busy}
            className="rounded-lg border border-canvas-grey px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => pending && void run(pending)}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Working…' : copy?.confirm}
          </button>
        </div>
      </Dialog>
    </>
  );
}
