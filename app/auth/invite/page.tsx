'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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

  useEffect(() => {
    let cancelled = false;
    const expiring = 'This invite link has expired. Ask the GAKIT administrator to send a new one.';
    const invalid =
      'This invite link is invalid or was already used. Ask the GAKIT administrator to send a new one.';

    const hashParams = () =>
      new URLSearchParams((window.location.hash || '').replace(/^#/, ''));

    const initial = hashParams();
    if (initial.get('error_code') === 'otp_expired' || initial.get('error')) {
      setStatus('error');
      setErrorMessage(initial.get('error_code') === 'otp_expired' ? expiring : invalid);
      return;
    }

    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setStatus('ready');
        return;
      }
const after = hashParams();
      setStatus('error');
      setErrorMessage(after.get('error_code') === 'otp_expired' ? expiring : invalid);
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
      setLocalError(error.message);
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
          <Loader2 className="h-5 w-5 animate-spin text-gakit-maroon" />
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