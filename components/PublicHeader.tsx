'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LogOut, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, homePathForRole, type StaffRole } from '@/lib/auth/roles';
import { useRouteLoader } from './RouteLoader';

export function PublicHeader() {
  const router = useRouter();
  const { navigate, loadingOverlay } = useRouteLoader();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const resolveRole = (userId: string) =>
      getStaffRole(supabase, userId).then((staffRole) => {
        if (!cancelled) {
          setRole(staffRole);
          setIsChecking(false);
        }
      });

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user) {
        if (!cancelled) setEmail(data.user.email ?? null);
        void resolveRole(data.user.id);
      } else {
        setRole(null);
        setIsChecking(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        if (!cancelled) setEmail(session.user.email ?? null);
        void resolveRole(session.user.id);
      } else {
        setRole(null);
        setEmail(null);
        setIsChecking(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsMenuOpen(false);
    router.push('/login');
    router.refresh();
  }

  const home = role ? homePathForRole(role) : null;
  const accountLabel =
    home === '/admin' ? 'Admin' : home === '/monitoring' ? 'Monitoring' : 'Login';

  const handleAccountClick = () => {
    navigate(home ?? '/login');
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const userMenuContent = (
    <>
      <div className="break-all border-b border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700">
        {email}
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        <LogOut className="h-4 w-4 text-red-500" />
        {isSigningOut ? 'Signing out...' : 'Sign out'}
      </button>
    </>
  );

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-[1200] isolate bg-white opacity-100 shadow-md border-b border-canvas-grey">
      <div className="mx-auto flex h-16 items-center justify-center px-6 md:px-10">
        <div className="flex items-center justify-center gap-8 lg:gap-14">
          <button
            type="button"
            onClick={() => scrollToSection('hazard-map')}
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
            aria-label="Go to the GAKIT hazard map"
          >
            <div className="flex h-10 w-24 items-center justify-center sm:w-28">
              <Image
                src="/images/gakit_logo2.svg"
                alt="GAKIT logo"
                width={160}
                height={48}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="hidden text-left text-xs font-medium leading-tight text-slate-600 xl:block">
              Geohazard Assessment &amp;
              <br />
              Knowledge Integration Tool
            </span>
          </button>

          <nav className="hidden items-center gap-3 text-sm font-semibold md:flex">
            <button
              onClick={() => scrollToSection('about')}
              className="px-4 py-2.5 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
            >
              About
            </button>
            {!isChecking && (
              <button
                onClick={handleAccountClick}
                className="rounded-full border-2 border-gakit-maroon px-6 py-2.5 text-gakit-maroon bg-white transition-colors hover:bg-maroon-50 inline-flex items-center gap-2"
              >
                {accountLabel}
              </button>
            )}
            {email && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
                  className={`flex items-center justify-center rounded-lg border p-2 text-gakit-maroon transition-colors ${
                    isMenuOpen
                      ? 'border-gakit-maroon bg-maroon-50'
                      : 'border-canvas-grey hover:bg-slate-50'
                  }`}
                  aria-expanded={isMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                >
                  <UserRound className="h-5 w-5" />
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border border-canvas-grey bg-white p-2 shadow-lg">
                    {userMenuContent}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </div>

      {email && (
        <div className="absolute right-4 top-3 z-[1201] md:hidden">
          <button
            type="button"
            onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
            className={`flex items-center justify-center rounded-lg border p-2 text-gakit-maroon transition-colors ${
              isMenuOpen
                ? 'border-gakit-maroon bg-maroon-50'
                : 'border-canvas-grey hover:bg-slate-50'
            }`}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            <UserRound className="h-5 w-5" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border border-canvas-grey bg-white p-2 shadow-lg">
              {userMenuContent}
            </div>
          )}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-[1200] border-t border-canvas-grey bg-white px-4 py-3 text-xs font-semibold shadow-lg md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <button
            onClick={() => scrollToSection('about')}
            className="px-4 py-2.5 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
          >
            About
          </button>
          {!isChecking && (
            <button
              onClick={handleAccountClick}
              className="rounded-lg border-2 border-gakit-maroon px-6 py-2.5 text-gakit-maroon bg-white transition-colors hover:bg-maroon-50 inline-flex items-center justify-center gap-2"
            >
              {accountLabel}
            </button>
          )}
        </div>
      </nav>
    </header>
    {loadingOverlay}
    </>
  );
}
