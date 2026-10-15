'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, LockKeyhole } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError, friendlyInviteError } from '@/lib/auth/authErrors';

/**
 * Accepts a GoTrue invitation link (email → `{app}/auth/invite#...type=invite`).
 * Exchanges the token, then lets the invited user choose their own password.
 * Expired or invalid links render a friendly error instead of a raw hash.
 */
export default function InvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // React StrictMode runs effects twice in development. The invite token is
  // single-use, so a second `verifyOtp` call would fail and wrongly report the
  // link as invalid. Cache the in-flight promise so both effect runs share one
  // redemption.
  const redeemRef = useRef<Promise<{ error: { message?: string } | null }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const expiring = 'This invite link has expired. Ask the GAKIT administrator to send a new one.';
    const invalid =
      'This invite link is invalid or was already used. Ask the GAKIT administrator to send a new one.';

    const supabase = createClient();
    const hashParams = () =>
      new URLSearchParams((window.location.hash || '').replace(/^#/, ''));

    const resolveInvite = async () => {
      // Preferred path: token-hash link (?token_hash=...&type=invite). The
      // browser client uses the PKCE flow, which rejects Supabase's implicit
      // action_link (#access_token=...); the backend sends this form instead
      // so the client can redeem the token via verifyOtp.
      const search = new URLSearchParams(window.location.search);
      const tokenHash = search.get('token_hash');
      if (tokenHash) {
        if (!redeemRef.current) {
          redeemRef.current = supabase.auth.verifyOtp({
            type: search.get('type') ?? 'invite',
            token_hash: tokenHash,
          });
        }
        const { error } = await redeemRef.current;
        if (cancelled) return;
        if (error) {
          setStatus('error');
          setErrorMessage(friendlyInviteError(error));
          return;
        }
        const url = new URL(window.location.href);
        url.searchParams.delete('token_hash');
        url.searchParams.delete('type');
        window.history.replaceState(window.history.state, '', url.toString());
        setStatus('ready');
        return;
      }

      // Fallback: legacy implicit link handled from the URL hash.
      const params = hashParams();
      if (params.get('error_code') === 'otp_expired' || params.get('error')) {
        setStatus('error');
        setErrorMessage(params.get('error_code') === 'otp_expired' ? expiring : invalid);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setStatus('ready');
        return;
      }
      const after = hashParams();
      setStatus('error');
      setErrorMessage(after.get('error_code') === 'otp_expired' ? expiring : invalid);
    };

    void resolveInvite().catch((err: unknown) => {
      if (cancelled) return;
      setStatus('error');
      setErrorMessage(friendlyAuthError(err instanceof Error ? err : null));
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

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLocalError(friendlyAuthError(error));
      setIsSubmitting(false);
      return;
    }

    setDone(true);
    await supabase.auth.signOut();
    window.setTimeout(() => {
      router.push('/login');
      router.refresh();
    }, 1200);
  };

  if (status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas-light p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Spinner size="md" />
          Checking your invite…
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas-light md:flex-row">
      <section className="flex w-full items-center justify-center px-6 py-12 md:w-[45%]">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-gakit-maroon"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          {done ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <h1 className="mt-4 text-2xl font-bold text-slate-900">
                Password set successfully
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Your password is ready. Taking you to the sign-in page…
              </p>
            </div>
          ) : status === 'error' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <h1 className="mt-4 text-2xl font-bold text-slate-900">
                This invite link can&apos;t be used
              </h1>
              <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-maroon-800"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">
                  Set your password
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  You&apos;ve been invited to join GAKIT. Choose a password for
                  your account to continue.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-900"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-canvas-grey bg-white py-3 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-gakit-maroon focus:border-gakit-maroon"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm"
                    className="mb-2 block text-sm font-semibold text-slate-900"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="confirm"
                      type="password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-canvas-grey bg-white py-3 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-gakit-maroon focus:border-gakit-maroon"
                    />
                  </div>
                </div>

                {localError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {localError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-gakit-maroon py-3 px-6 font-semibold text-white transition-colors hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving…' : 'Set password'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      <section className="relative hidden w-[55%] items-end overflow-hidden md:flex">
        <Image
          src="/images/flooded-image1.jpg"
          alt=""
          fill
          priority
          quality={70}
          sizes="55vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gakit-maroon/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="relative z-10 p-12 max-w-3xl">
          <h2 className="text-5xl font-bold text-white leading-tight">
            Geohazard Assessment & Knowledge Integration Tool
          </h2>
          <p className="text-lg text-white/85 mt-5">
            Submit, validate, and monitor flood reports so communities and
            responders can make faster decisions.
          </p>
        </div>
      </section>
    </main>
  );
}