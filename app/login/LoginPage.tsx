'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, ShieldCheck, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, homePathForRole } from '@/lib/auth/roles';
import { friendlyAuthError } from '@/lib/auth/authErrors';

export function LoginPage() {
  const router = useRouter();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setIsSubmitting(false);
      setError(friendlyAuthError(error));
      return;
    }

    const role = await getStaffRole(supabase, data.user.id);
    const home = homePathForRole(role);

    if (!home) {
      setIsSubmitting(false);
      setError(
        "Your account isn't linked to a portal role yet. Ask the GAKIT administrator for access."
      );
      return;
    }

    router.push(home);
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Middleware routes authenticated users to their role's portal.
      options: { redirectTo: `${window.location.origin}/login` },
    });

    if (error) {
      setError(friendlyAuthError(error));
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-maroon-50 via-white to-canvas-light md:flex-row">
      <section className="flex w-full items-center justify-center bg-white/90 px-6 py-10 backdrop-blur md:w-[43%] md:px-10 md:py-16">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-gakit-maroon"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-950">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Public flood reports are anonymous and don&apos;t require an account.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-canvas-grey px-4 py-3 font-semibold text-slate-700 transition-colors hover:border-gakit-maroon hover:bg-maroon-50"
          >
            <GoogleLogo />
            Continue with Gmail
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-canvas-grey" />
            <span className="text-xs font-medium text-slate-400">or</span>
            <div className="h-px flex-1 bg-canvas-grey" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-900">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-canvas-grey bg-white py-3 pl-10 pr-4 transition-colors placeholder:text-slate-400 focus:border-gakit-maroon focus:outline-none focus:ring-2 focus:ring-gakit-maroon/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-900">
                Password
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-canvas-grey bg-white py-3 pl-10 pr-11 transition-colors placeholder:text-slate-400 focus:border-gakit-maroon focus:outline-none focus:ring-2 focus:ring-gakit-maroon/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end text-sm">
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="font-semibold text-gakit-maroon underline-offset-4 transition-colors hover:text-maroon-800 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gakit-maroon px-6 py-3 font-semibold text-white shadow-lg shadow-gakit-maroon/20 transition-colors hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 border-t border-canvas-grey pt-6 text-center text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="font-semibold text-gakit-maroon hover:text-maroon-800"
            >
              Request Access
            </button>
          </div>
        </div>
      </section>

      <section className="relative hidden w-[57%] items-end overflow-hidden md:flex">
        <Image
          src="/images/flooded-image1.jpg"
          alt=""
          fill
          priority
          quality={70}
          sizes="60vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gakit-maroon/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="relative z-10 max-w-3xl p-12">
          <h2 className="font-heading text-5xl font-bold leading-tight text-white">
            Geohazard Assessment & Knowledge Integration Tool
          </h2>
          <p className="mt-5 text-lg text-white/85">
            Submit, validate, and monitor flood reports so communities and responders can make faster decisions.
          </p>
          <div className="mt-8 flex gap-3 text-sm font-medium text-white/90">
            <span className="rounded-full border border-white/25 bg-black/10 px-3 py-1.5">Secure access</span>
            <span className="rounded-full border border-white/25 bg-black/10 px-3 py-1.5">Operational tools</span>
          </div>
        </div>
      </section>

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
      />
      {isForgotModalOpen && (
        <ForgotPasswordModal
          onClose={() => setIsForgotModalOpen(false)}
          initialEmail={email}
        />
      )}
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function ForgotPasswordModal({
  onClose,
  initialEmail,
}: {
  onClose: () => void;
  initialEmail: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });

    setIsSubmitting(false);
    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    setSent(true);
};

  return (
    <Dialog
      isOpen
      onClose={onClose}
      ariaLabelledBy="forgot-password-title"
      panelClassName="max-h-[calc(100vh-2rem)] overflow-y-auto"
    >
      <div className="flex items-center justify-between border-b border-canvas-grey p-5">
        <div>
          <h2 id="forgot-password-title" className="text-lg font-bold text-slate-900">
            Reset your password
          </h2>
          <p className="mt-1 text-sm text-slate-600">We&apos;ll send a secure reset link.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-canvas-light"
          aria-label="Close password reset"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5">
        {sent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            If this email belongs to a GAKIT account, a password-reset link is on its way. Check your inbox and spam folder.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="mb-2 block text-sm font-semibold text-slate-900">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-canvas-grey py-3 pl-10 pr-4 placeholder:text-slate-400 focus:border-gakit-maroon focus:outline-none focus:ring-2 focus:ring-gakit-maroon/20"
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gakit-maroon px-5 py-3 font-semibold text-white transition-colors hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Sending link...' : 'Email reset link'}
            </button>
          </form>
        )}
      </div>
    </Dialog>
  );
}

function RequestAccessModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1300] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-canvas-grey">
          <h2 className="text-lg font-bold text-slate-900">Request account access</h2>
          <button onClick={onClose} className="p-1 hover:bg-canvas-light rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            This account is not registered yet. Please request access from the Project GAKIT administrator.
          </p>

          <div className="bg-maroon-50 border border-gakit-maroon/20 rounded-lg p-4">
            <div className="text-sm font-semibold text-slate-900">
              For now
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Contact your barangay, CDRRMO staff, or system admin to create an account.
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 px-6 rounded-lg font-semibold bg-gakit-maroon hover:bg-maroon-800 text-white transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
