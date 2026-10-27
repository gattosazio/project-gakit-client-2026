'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * Delivery summary shared by the invite and resend flows: confirms the email
 * was sent, or surfaces the one-time link when SMTP delivery failed.
 */
export function InviteResultNotice({
  email,
  emailSent,
  inviteLink,
}: {
  email: string | null;
  emailSent: boolean;
  inviteLink: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (e.g. non-secure context); nothing to do.
    }
  };

  if (emailSent) {
    return (
      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        A setup email with a link to choose a password was sent to{' '}
        <span className="font-semibold">{email}</span>.
      </div>
    );
  }

  if (inviteLink) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-amber-800">
          The invitation link is ready, but the email could not be sent. Share
          this one-time link with the user so they can set their password:
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={inviteLink}
            aria-label="One-time invitation link"
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
        <p className="text-xs text-slate-400">The link expires in 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
      The invitation is active, but no delivery link was returned. Ask the user
      to use Forgot password on the sign-in page.
    </div>
  );
}
