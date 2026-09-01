'use client';

import { useState } from 'react';
import { Check, Copy, Mail, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { inviteUser } from '../../actions/admin';
import type { InviteResult, RoleView } from '@/types/admin';

export function InviteUserModal({
  roles,
  onClose,
  onInvited,
}: {
  roles: RoleView[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = email.trim() !== '' && role !== '' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    setCopied(false);
    try {
      const invite = await inviteUser({ email: email.trim(), role });
      setResult(invite);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to send the invitation.'
      );
      setSubmitting(false);
    }
  };

  const copyInviteLink = async () => {
    if (!result?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(result.inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (e.g. non-secure context); nothing to do.
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Invite a user"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon-50">
              {result ? (
                <Check className="h-5 w-5 text-emerald-600" />
              ) : (
                <Mail className="h-5 w-5 text-gakit-maroon" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {result ? 'Invitation sent' : 'Invite a user'}
              </h2>
              <p className="text-sm text-slate-500">
                {result
                  ? `An invitation was created for ${result.email ?? 'the user'}.`
                  : 'An invitation email will be sent to the address below.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onInvited}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-canvas-light hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            {result.emailSent ? (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                A setup email with a link to choose a password was sent to{' '}
                <span className="font-semibold">{result.email}</span>.
              </div>
            ) : result.inviteLink ? (
              <div className="space-y-2">
                <div className="text-sm text-amber-800">
                  An invitation was created, but the email could not be sent.
                  Share this one-time link with the user so they can set their
                  password:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={result.inviteLink}
                    onFocus={(event) => event.currentTarget.select()}
                    className="w-full rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2 text-xs text-slate-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void copyInviteLink()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-canvas-grey px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-canvas-light"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  The link expires in 24 hours.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                The account was created. Have the user reset their password to
                begin.
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onInvited}
                className="rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-800"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {serverError && (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@organization.gov.ph"
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-gakit-maroon/40 focus:bg-white focus:ring-2 focus:ring-gakit-maroon/10"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Role</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-gakit-maroon/40 focus:bg-white focus:ring-2 focus:ring-gakit-maroon/10"
                >
                  <option value="">Select a role…</option>
                  {roles.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
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
                {submitting && <Spinner size="sm" iconClassName="bg-white" />}
                {submitting ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}