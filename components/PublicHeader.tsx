'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { BookOpen, Info, LogOut, MapPinned, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, homePathForRole, type AuthSnapshot, type StaffRole } from '@/lib/auth/roles';
import { useActiveAlerts } from '@/lib/weather/weatherStore';
import { alertDescription, alertTitle } from '@/lib/weather/weatherCodes';
import type { WeatherAlert } from '@/types/weather';
import { useRouteLoader } from './RouteLoader';
import { usePrefetchRoute } from '@/hooks/usePrefetchRoute';
import { SignOutConfirmDialog } from './SideBar';
import { NotificationBell } from './NotificationBell';
import type { NotificationItem } from './NotificationBell';
import { WeatherAlertModal } from './WeatherAlertModal';
import { LocationSearch, type SearchedLocation } from '@/app/public-view/components/LocationSearch';

export function PublicHeader({
  activeSection,
  initialAuth,
  onNavigateSection,
  onSearchSelect,
  onLocate,
}: {
  activeSection?: 'hazard-map' | 'about';
  initialAuth?: AuthSnapshot;
  onNavigateSection?: (id: 'hazard-map' | 'about') => void;
  onSearchSelect?: (location: SearchedLocation) => void;
  onLocate?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const { navigate, loadingOverlay } = useRouteLoader();
  const [role, setRole] = useState<StaffRole | null>(initialAuth?.role ?? null);
  const [isChecking, setIsChecking] = useState(initialAuth === undefined);
  const [email, setEmail] = useState<string | null>(initialAuth?.email ?? null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const activeAlerts = useActiveAlerts();
  const [readAlertIds, setReadAlertIds] = useState<string[]>([]);

  const infoRef = useRef<HTMLDivElement>(null);
  const mobileInfoRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen && !isInfoOpen) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(target) &&
        mobileUserMenuRef.current &&
        !mobileUserMenuRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
      if (
        infoRef.current &&
        !infoRef.current.contains(target) &&
        mobileInfoRef.current &&
        !mobileInfoRef.current.contains(target)
      ) {
        setIsInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [isMenuOpen, isInfoOpen]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const stored = localStorage.getItem('gakit:read-alerts');
        if (stored) setReadAlertIds(JSON.parse(stored));
      } catch {
        /* ignore malformed storage */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markAlertRead = useCallback((id: string) => {
    setReadAlertIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      try {
        localStorage.setItem('gakit:read-alerts', JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, []);
  const weatherNotifications = useMemo<NotificationItem[]>(
    () =>
       (activeAlerts ?? []).map((a) => ({
        id: a.id,
        title: alertTitle(a),
        subtitle: alertDescription(a),
        severity: a.severity,
        alertType: a.alertType,
        sentAt: a.createdAt,
        validFrom: a.validFrom,
        validTo: a.validTo,
        data: a.data ?? null,
        read: readAlertIds.includes(a.id),
      })),
    [activeAlerts, readAlertIds]
  );
  const [selectedAlert, setSelectedAlert] = useState<WeatherAlert | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const hydratedFromServer = initialAuth !== undefined;

    const resolveRole = (userId: string) =>
      getStaffRole(supabase, userId).then((staffRole) => {
        if (!cancelled) {
          setRole(staffRole);
          setIsChecking(false);
        }
      });

    if (!hydratedFromServer) {
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
    }

    let sawInitialEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // onAuthStateChange replays the current session as INITIAL_SESSION; when
      // the server already hydrated us, that replay is redundant work.
      if (event === 'INITIAL_SESSION') {
        sawInitialEvent = true;
        if (hydratedFromServer) return;
      } else if (!sawInitialEvent && hydratedFromServer) {
        sawInitialEvent = true;
      }
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
  }, [initialAuth]);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsMenuOpen(false);
    router.push('/login');
    router.refresh();
  }

  const home = role ? homePathForRole(role) : null;
  usePrefetchRoute(home ?? '/login');
  const accountLabel =
    home === '/admin' ? 'Admin' : home === '/monitoring' ? 'Monitoring' : 'Login';

  const handleAccountClick = () => {
    navigate(home ?? '/login');
  };

  const scrollToSection = (id: 'hazard-map' | 'about') => {
    onNavigateSection?.(id);
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
    <header className="fixed top-3 inset-x-3 md:top-4 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-[calc(100%-3rem)] md:max-w-5xl z-[1200] isolate rounded-full bg-white/92 border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.08)] md:bg-white/90 md:backdrop-blur-xl md:border-white/80 md:shadow-[0_12px_36px_rgba(15,23,42,0.1),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-slate-900/5">
      <div className="flex h-12 md:h-14 items-center justify-between px-3.5 md:px-5">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => scrollToSection('hazard-map')}
            className="group flex items-center rounded-lg transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
            aria-label="Go to the GAKIT hazard map"
          >
            <div className="flex h-8 md:h-9 items-center justify-center">
              <Image
                src="/images/gakit_logo_adobe.svg"
                alt="GAKIT logo"
                width={140}
                height={40}
                priority
                className="h-7 md:h-8 w-auto object-contain"
              />
            </div>
            <div className="hidden h-9 pl-2 flex-col justify-center text-left font-heading text-[9px] font-bold uppercase tracking-wider leading-tight text-slate-500 xl:flex">
              <div>Geohazard Assessment &amp;</div>
              <div>Knowledge Integration Tool</div>
            </div>
          </button>
        </div>

        {/* Center: Integrated Location Search (Single Responsive Instance) */}
        {onSearchSelect && (
          <LocationSearch
            variant="header-compact"
            onSelect={onSearchSelect}
            onLocate={onLocate}
            className="mx-1.5 flex-1 min-w-0 md:mx-2 md:flex-initial md:w-64 lg:w-80"
          />
        )}

        {/* Desktop Navigation & Actions */}
        <div className="hidden items-center gap-2 md:flex">
          <nav className="flex items-center gap-1.5 text-sm font-semibold">
            <button
              onClick={() => scrollToSection('about')}
              className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 font-heading text-xs font-bold transition-all duration-150 active:scale-95 ${
                activeSection === 'about'
                  ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              About
            </button>
            {!isChecking && (
              <button
                onClick={handleAccountClick}
                className="group relative inline-flex items-center justify-center rounded-full bg-gradient-to-r from-gakit-maroon to-maroon-800 px-4 py-1.5 font-heading text-xs font-bold text-white shadow-[0_2px_8px_rgba(123,17,19,0.28)] transition-all duration-150 hover:from-maroon-800 hover:to-maroon-900 hover:shadow-[0_4px_12px_rgba(123,17,19,0.35)] active:scale-95"
              >
                <span className="tracking-wide">{accountLabel}</span>
              </button>
            )}
          </nav>

          <span className="mx-1 h-5 w-px bg-slate-200/80" />

          {/* Right cluster: info, notifications, account */}
          <div className="flex items-center gap-1">
            <div ref={infoRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsInfoOpen((open) => !open);
                  setIsMenuOpen(false);
                  setIsNotifOpen(false);
                }}
                className={`rounded-full p-2 text-slate-500 transition-all duration-150 hover:bg-slate-100/80 hover:text-gakit-maroon active:scale-95 ${
                  isInfoOpen
                    ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80 font-bold'
                    : ''
                }`}
                aria-expanded={isInfoOpen}
                aria-label="How to report guide"
              >
                <Info className="h-4.5 w-4.5" />
              </button>
              {isInfoOpen && (
                <div className="absolute right-0 top-12 w-72 z-[1201]">
                  <div className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.12),inset_0_1px_0_0_rgba(255,255,255,0.9)] backdrop-blur-xl ring-1 ring-slate-200/80">
                    <div className="mb-2.5 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-maroon-50 text-gakit-maroon font-bold text-[11px]">
                        ?
                      </div>
                      <div className="text-xs font-bold text-slate-900">How to report a flood hazard</div>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700">1</span>
                        <span>Set location (search, tap, or use GPS).</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700">2</span>
                        <span>Choose scale reference & estimate waterline.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700">3</span>
                        <span>Submit report to alert responders & community.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <NotificationBell
              notifications={weatherNotifications}
              onSelectAlert={setSelectedAlert}
              onMarkRead={markAlertRead}
              variant="header"
              isOpen={isNotifOpen}
              onOpenChange={(next) => {
                setIsNotifOpen(next);
                if (next) {
                  setIsMenuOpen(false);
                  setIsInfoOpen(false);
                }
              }}
            />
            {email && (
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen((isOpen) => !isOpen);
                    setIsNotifOpen(false);
                    setIsInfoOpen(false);
                  }}
                  className={`flex items-center justify-center rounded-full p-2 text-slate-500 transition-all duration-150 hover:bg-slate-100/80 hover:text-gakit-maroon active:scale-95 ${
                    isMenuOpen
                      ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80 font-bold'
                      : ''
                  }`}
                  aria-expanded={isMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                >
                  <UserRound className="h-4.5 w-4.5" />
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl ring-1 ring-slate-200/80">
                    {userMenuContent}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile top-right cluster */}
        <div className="flex items-center gap-1 md:hidden">
          <div ref={mobileInfoRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsInfoOpen((v) => !v);
                setIsMenuOpen(false);
                setIsNotifOpen(false);
              }}
              className={`flex items-center justify-center rounded-full p-2 text-slate-500 transition-all duration-150 hover:bg-slate-100/80 hover:text-gakit-maroon active:scale-95 ${
                isInfoOpen
                  ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80'
                  : ''
              }`}
              aria-label="How to report guide"
            >
              <Info className="h-4.5 w-4.5" />
            </button>
            {isInfoOpen && (
              <div className="absolute right-0 top-12 w-64 z-[1201]">
                <div className="rounded-2xl border border-white/80 bg-white/95 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl ring-1 ring-slate-200/80">
                  <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-maroon-50 text-gakit-maroon font-bold text-[11px]">
                      ?
                    </div>
                    <div className="text-xs font-bold text-slate-900">How to report a hazard</div>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[9px] text-slate-700">1</span>
                      <span>Set location by tapping map or GPS.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[9px] text-slate-700">2</span>
                      <span>Estimate waterline reference depth.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[9px] text-slate-700">3</span>
                      <span>Submit to alert community.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {email && (
            <div ref={mobileUserMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen((isOpen) => !isOpen);
                  setIsInfoOpen(false);
                  setIsNotifOpen(false);
                }}
                className={`flex items-center justify-center rounded-full p-2 text-slate-500 transition-all duration-150 hover:bg-slate-100/80 hover:text-gakit-maroon active:scale-95 ${
                  isMenuOpen
                    ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80'
                    : ''
                }`}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
              >
                <UserRound className="h-4.5 w-4.5" />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl ring-1 ring-slate-200/80">
                  {userMenuContent}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>

    <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-[1200] px-4 pb-2 md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-sm items-center justify-center gap-1.5 rounded-2xl bg-white/92 p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] border border-slate-200/80 ring-1 ring-slate-200/80">
        <button
          onClick={() => scrollToSection('hazard-map')}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-150 active:scale-95 ${
            activeSection === 'hazard-map'
              ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80 font-bold'
              : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon active:bg-maroon-50/70'
          }`}
        >
          <MapPinned className={`h-5 w-5 ${activeSection === 'hazard-map' ? 'text-gakit-maroon' : ''}`} />
          <span className="text-[10px] font-semibold">Map</span>
        </button>
        <button
          onClick={() => scrollToSection('about')}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-150 active:scale-95 ${
            activeSection === 'about'
              ? 'bg-maroon-50 text-gakit-maroon ring-1 ring-maroon-200/80 font-bold'
              : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon active:bg-maroon-50/70'
          }`}
        >
          <BookOpen className={`h-5 w-5 ${activeSection === 'about' ? 'text-gakit-maroon' : ''}`} />
          <span className="text-[10px] font-semibold">About</span>
        </button>
        <NotificationBell
          notifications={weatherNotifications}
          onSelectAlert={setSelectedAlert}
          onMarkRead={markAlertRead}
          variant="mobile-nav"
          onOpenChange={(next) => {
            if (next) {
              setIsMenuOpen(false);
              setIsInfoOpen(false);
            }
          }}
        />
        {!isChecking && (
          <button
            onClick={handleAccountClick}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-slate-500 transition-all duration-150 hover:bg-slate-50 hover:text-gakit-maroon active:bg-maroon-50/70 active:scale-95"
          >
            <UserRound className="h-5 w-5" />
            <span className="text-[10px] font-semibold">{accountLabel}</span>
          </button>
        )}
      </div>
    </nav>
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
