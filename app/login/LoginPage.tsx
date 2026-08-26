'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, homePathForRole } from '@/lib/auth/roles';

export function LoginPage() {
  const router = useRouter();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
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
      setError(error.message);
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
      setError(error.message);
    }
  };

  return (
    <main className="min-h-screen bg-canvas-light flex flex-col md:flex-row">
      <section className="w-full md:w-[40%] bg-white flex items-center justify-center px-6 py-10 md:py-16">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-gakit-maroon mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <Link href="/" className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 bg-gakit-maroon rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">GK</span>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 leading-tight">
                Project GAKIT
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Flood Assessment Reporting
              </div>
            </div>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Staff Sign in</h1>
            <p className="text-sm text-slate-600 mt-2">
              This sign in is for GAKIT staff and responders. Public flood reports are
              anonymous and don&apos;t require an account.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 rounded-lg border border-canvas-grey hover:border-gakit-maroon hover:bg-maroon-50 transition-colors flex items-center justify-center gap-2 font-semibold text-slate-700"
          >
            <GoogleLogo />
            Continue with Gmail
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-canvas-grey" />
            <span className="text-xs font-medium text-slate-400">or</span>
            <div className="h-px flex-1 bg-canvas-grey" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-3 rounded-lg border border-canvas-grey focus:outline-none focus:ring-2 focus:ring-gakit-maroon focus:border-gakit-maroon"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-11 rounded-lg border border-canvas-grey focus:outline-none focus:ring-2 focus:ring-gakit-maroon focus:border-gakit-maroon"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="rounded border-canvas-grey" />
                Remember me
              </label>
              <button type="button" className="font-semibold text-gakit-maroon hover:text-maroon-800">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-6 rounded-lg font-semibold bg-gakit-maroon hover:bg-maroon-800 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <Link href="/" className="font-semibold text-gakit-maroon hover:text-maroon-800">
              Submit a public flood report &mdash; no account needed
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-canvas-grey text-center text-sm text-slate-600">
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

      <section className="relative hidden md:flex w-[60%] items-end overflow-hidden">
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
        <div className="relative z-10 p-12 max-w-3xl">
          <div className="text-sm font-semibold text-white/80 mb-3">
            Project GAKIT
          </div>
          <h2 className="text-5xl font-bold text-white leading-tight">
            Geohazard Assessment & Knowledge Integration Tool
          </h2>
          <p className="text-lg text-white/85 mt-5">
            Submit, validate, and monitor flood reports so communities and responders can make faster decisions.
          </p>
        </div>
      </section>

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
      />
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
