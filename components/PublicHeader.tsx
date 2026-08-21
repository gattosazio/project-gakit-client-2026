'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Info, LogOut, MapPinned, UserRound, BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, homePathForRole, type StaffRole } from '@/lib/auth/roles';
import { fetchActiveAlerts } from '@/lib/weather';
import type { WeatherAlert } from '@/types/weather';
import { useRouteLoader } from './RouteLoader';
import { SignOutConfirmDialog } from './SideBar';
import { NotificationBell } from './NotificationBell';
import type { NotificationItem } from './NotificationBell';
import { WeatherAlertModal } from './WeatherAlertModal';

export function PublicHeader({ activeSection }: { activeSection?: 'hazard-map' | 'about' }) {
  const router = useRouter();
  const { navigate, loadingOverlay } = useRouteLoader();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [weatherNotifications, setWeatherNotifications] = useState<NotificationItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<WeatherAlert | null>(null);

  useEffect(() => {
    const loadWeather = async () => {
      try {
        const alerts = await fetchActiveAlerts();
        setWeatherNotifications(
          alerts.map((a) => ({
            id: a.id,
            title: a.title,
            subtitle: a.description,
            severity: a.severity,
            alertType: a.alertType,
            sentAt: a.createdAt,
            validFrom: a.validFrom,
            validTo: a.validTo,
          }))
        );
      } catch {
        // Silently fail
      }
    };
    void loadWeather();
    const interval = setInterval(loadWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
        onClick={() => {
          setIsMenuOpen(false);
          setShowSignOutConfirm(true);
        }}
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
              className={`rounded-lg px-4 py-2.5 transition-colors ${
                activeSection === 'about'
                  ? 'bg-maroon-50 text-gakit-maroon'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-gakit-maroon'
              }`}
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
            <NotificationBell
              notifications={weatherNotifications}
              onSelectAlert={setSelectedAlert}
              variant="header"
            />
            <div className="group relative">
              <button
                type="button"
                className="rounded-lg p-2.5 text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon transition-colors"
              >
                <Info className="h-5 w-5" />
              </button>
              <div className="hidden group-hover:block absolute right-0 top-12 w-56 z-[1201]">
                <div className="bg-white border border-canvas-grey rounded-lg shadow-lg px-3 py-2 text-xs text-slate-600 leading-relaxed">
                  <div className="font-semibold text-slate-900 mb-1">How to report a flood hazard</div>
                  1. Set your location (search, tap, or use GPS).<br />2. Select the flood depth.<br />3. Attach image (optional).<br />4. Submit report.
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>

      {email && (
        <div className="absolute right-4 top-3 z-[1201] md:hidden flex items-center gap-2">
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
          <div className="relative">
            <button
              type="button"
              onClick={() => { setIsMobileInfoOpen((v) => !v); setIsMenuOpen(false); }}
              className={`flex items-center justify-center rounded-lg border p-2 transition-colors ${
                isMobileInfoOpen
                  ? 'border-gakit-maroon bg-maroon-50 text-gakit-maroon'
                  : 'border-canvas-grey text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Info className="h-5 w-5" />
            </button>
            {isMobileInfoOpen && (
              <div className="absolute right-0 top-12 w-56 z-[1201]">
                <div className="bg-white border border-canvas-grey rounded-lg shadow-lg px-3 py-2 text-xs text-slate-600 leading-relaxed">
                  <div className="font-semibold text-slate-900 mb-1">How to report a flood hazard</div>
                  1. Set your location (search, tap, or use GPS).<br />2. Select the flood depth.<br />3. Attach image (optional).<br />4. Submit report.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-[1200] px-4 pb-2 md:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-sm items-center justify-center gap-1.5 rounded-2xl bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur">
          <button
            onClick={() => scrollToSection('hazard-map')}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
              activeSection === 'hazard-map'
                ? 'bg-maroon-50 text-gakit-maroon'
                : 'text-slate-500 hover:bg-maroon-50 hover:text-gakit-maroon'
            }`}
          >
            <MapPinned className={`h-5 w-5 ${activeSection === 'hazard-map' ? 'text-gakit-maroon' : ''}`} />
            <span className="text-[10px] font-semibold">Map</span>
          </button>
          <button
            onClick={() => scrollToSection('about')}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
              activeSection === 'about'
                ? 'bg-maroon-50 text-gakit-maroon'
                : 'text-slate-500 hover:bg-maroon-50 hover:text-gakit-maroon'
            }`}
          >
            <BookOpen className={`h-5 w-5 ${activeSection === 'about' ? 'text-gakit-maroon' : ''}`} />
            <span className="text-[10px] font-semibold">About</span>
          </button>
          <NotificationBell
            notifications={weatherNotifications}
            onSelectAlert={setSelectedAlert}
            variant="mobile-nav"
          />
          {!isChecking && (
            <button
              onClick={handleAccountClick}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-slate-500 transition-colors hover:bg-maroon-50 hover:text-gakit-maroon"
            >
              <UserRound className="h-5 w-5" />
              <span className="text-[10px] font-semibold">{accountLabel}</span>
            </button>
          )}
        </div>
      </nav>
    </header>
    <SignOutConfirmDialog
      isOpen={showSignOutConfirm}
      isSigningOut={isSigningOut}
      onConfirm={handleSignOut}
      onCancel={() => setShowSignOutConfirm(false)}
    />
    {selectedAlert && (
      <WeatherAlertModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
    )}
    {loadingOverlay}
    </>
  );
}
