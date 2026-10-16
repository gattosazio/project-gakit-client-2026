'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyAuthError } from '@/lib/auth/authErrors';
import { resolveRecoveryLink, stripCredentialParams } from '@/lib/auth/recoveryLink';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const resolvedRef = useRef(false);
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    let cancelled = false;
    const supabase = createClient();
    const invalid = 'This password reset link is invalid or was already used. Request a new one.';
    const expired = 'This password reset link has expired. Request a new one.';

    // Drop the link's credentials from the address bar on every terminal path
    // so a refresh cannot re-exchange a spent code or replay an error.
    const clearCredentials = () => {
      window.history.replaceState(
        window.history.state,
        '',
        stripCredentialParams(window.location.href)
      );
    };

    const resolveRecovery = async () => {
      const resolution = resolveRecoveryLink(window.location.search, window.location.hash);

      if (resolution.kind === 'expired' || resolution.kind === 'invalid') {
        clearCredentials();
        setStatus('error');
        setErrorMessage(resolution.kind === 'expired' ? expired : invalid);
        return;
      }

      if (resolution.kind === 'exchange-code') {
        const { error } = await supabase.auth.exchangeCodeForSession(resolution.code);
        if (cancelled) return;
        if (error) {
          clearCredentials();
          setStatus('error');
          setErrorMessage(friendlyAuthError(error));
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error || !data.session) {
        clearCredentials();
        setStatus('error');
        setErrorMessage(error ? friendlyAuthError(error) : invalid);
        return;
      }

      clearCredentials();
      setStatus('ready');
    };

    void resolveRecovery().catch((error: unknown) => {
      if (cancelled) return;
      clearCredentials();
      setStatus('error');
      setErrorMessage(friendlyAuthError(error instanceof Error ? error : null));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setLocalError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setLocalError(friendlyAuthError(error));
      setIsSubmitting(false);
      return;
    }

    setDone(true);
    await createClient().auth.signOut();
    window.setTimeout(() => {
      router.replace('/login');
      router.refresh();
    }, 1200);
  };

  if (status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas-light p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Spinner size="md" />
          Checking your reset link...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-maroon-50 via-white to-canvas-light px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-white bg-white p-6 shadow-xl shadow-slate-950/5 sm:p-8">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-gakit-maroon"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        {done ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <h1 className="mt-4 font-heading text-2xl font-bold text-slate-950">Password updated</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Taking you back to sign in...</p>
          </div>
        ) : status === 'error' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <h1 className="mt-4 font-heading text-2xl font-bold text-slate-950">Link can&apos;t be used</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{errorMessage}</p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-maroon-800"
            >
              Request another link
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="mb-4 inline-flex rounded-full bg-maroon-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-gakit-maroon">
                Secure recovery
              </div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-950">Choose a new password</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Use at least 8 characters and keep it private.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <PasswordField
                id="new-password"
                label="New password"
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
                autoComplete="new-password"
              />
              <PasswordField
                id="confirm-password"
                label="Confirm new password"
                value={confirm}
                onChange={setConfirm}
                show={showPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
                autoComplete="new-password"
              />

              {localError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {localError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gakit-maroon px-6 py-3 font-semibold text-white shadow-lg shadow-gakit-maroon/20 transition-colors hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          minLength={8}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="At least 8 characters"
          className="w-full rounded-xl border border-canvas-grey py-3 pl-10 pr-11 placeholder:text-slate-400 focus:border-gakit-maroon focus:outline-none focus:ring-2 focus:ring-gakit-maroon/20"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-600"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
