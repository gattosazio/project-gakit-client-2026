'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, ChevronLeft, BookOpen, Info, MapPinned, UserRound, Waves } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStaffRole, homePathForRole, type AuthSnapshot, type StaffRole } from '@/lib/auth/roles';
import { useActiveAlerts } from '@/lib/weather/weatherStore';
import { alertDescription, alertTitle } from '@/lib/weather/weatherCodes';
import { isPagasaAlert, pagasaSubtitle, shortTitle } from '@/lib/weather/pagasa';
import type { WeatherAlert } from '@/types/weather';
import { useRouteLoader } from './RouteLoader';
import { usePrefetchRoute } from '@/hooks/usePrefetchRoute';
import { SignOutConfirmDialog } from './SideBar';
import { NotificationBell } from './NotificationBell';
import type { NotificationItem } from './NotificationBell';
import { WeatherAlertModal } from './WeatherAlertModal';
import { LocationSearch, type SearchedLocation } from '@/app/public-view/components/LocationSearch';
import { HowToReportPopover } from '@/components/header/HowToReportPopover';
import { UserNavMenu } from '@/components/header/UserNavMenu';
import { BentoMenu } from './BentoMenu';
import { getBentoTilesForRole } from '@/lib/navigation/bentoMenu';

export function PublicHeader({
  activeSection,
  initialAuth,
  onNavigateSection,
  onSearchSelect,
  onLocate,
  showBentoMenu = false,
  showSectionNav = true,
  showBottomNav = true,
}: {
  activeSection?: 'hazard-map' | 'about';
  initialAuth?: AuthSnapshot;
  onNavigateSection?: (id: 'hazard-map' | 'about') => void;
  onSearchSelect?: (location: SearchedLocation) => void;
  onLocate?: () => void | Promise<void>;
  /** Adds the bento portals launcher left of the bell. */
  showBentoMenu?: boolean;
  /** Hides the About button and the account pill. For pages with no About
   *  section, where the bento home row is the way back to the portal. */
  showSectionNav?: boolean;
  /** Hides the mobile bottom bar. The bell moves into the top cluster when
   *  this is false, since the bottom bar is otherwise its only mobile home. */
  showBottomNav?: boolean;
}) {
  const router = useRouter();
  const { navigate, loadingOverlay } = useRouteLoader();
  const [role, setRole] = useState<StaffRole | null>(initialAuth?.role ?? null);
  const [isChecking, setIsChecking] = useState(initialAuth === undefined);
  const [email, setEmail] = useState<string | null>(initialAuth?.email ?? null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
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
        (!mobileUserMenuRef.current || !mobileUserMenuRef.current.contains(target))
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
       (activeAlerts ?? [])
        .filter((a) => a.alertType !== 'daily_digest')
        .map((a) => ({
        id: a.id,
        title: isPagasaAlert(a) ? shortTitle(a) || alertTitle(a) : alertTitle(a),
        subtitle: isPagasaAlert(a) ? pagasaSubtitle(a) : alertDescription(a),
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
  const bentoTiles = useMemo(() => getBentoTilesForRole(role), [role]);
  usePrefetchRoute(home ?? '/login');

  // Prefetch all portal routes during idle time for fast switching
  useEffect(() => {
    bentoTiles.forEach((tile) => {
      router.prefetch(tile.href);
    });
  }, [bentoTiles, router]);
  const accountLabel =
    home === '/admin' ? 'Admin' : home === '/monitoring' ? 'Monitoring' : 'Login';

  // Once signed in the bento launcher is the way back into a portal, so it
  // takes over from the pill. Anonymous visitors keep the pill, because it is
  // the only sign-in CTA in this header.
  const accountPillVisible = !showBentoMenu || !home;

  const handleAccountClick = () => {
    navigate(home ?? '/login');
  };

  const scrollToSection = (id: 'hazard-map' | 'about') => {
    if (onNavigateSection) {
      onNavigateSection(id);
    } else {
      router.push('/');
    }
  };

  // Escape shortcut to go back when on subpages (like /flood-scenarios)
  useEffect(() => {
    if (showSectionNav) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
        if (!isMenuOpen && !isInfoOpen && !showSignOutConfirm) {
          router.push('/');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSectionNav, isMenuOpen, isInfoOpen, showSignOutConfirm, router]);

  return (
    <>
    <header className="fixed top-3 inset-x-3 md:top-4 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-[calc(100%-3rem)] md:max-w-5xl z-[1200] isolate rounded-full bg-white shadow-[0_4px_20px_rgba(15,23,42,0.08)] border border-slate-200/90 ring-1 ring-slate-900/5 md:[background-color:var(--hud-bg-desktop)] md:[backdrop-filter:blur(var(--hud-blur-desktop))] md:border-white/80 md:shadow-[0_12px_36px_rgba(15,23,42,0.1),inset_0_1px_0_0_rgba(255,255,255,0.9)]">
      <div className="flex h-12 md:h-14 items-center justify-between px-3.5 md:px-5">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {!showSectionNav && (
            <button
              type="button"
              onClick={() => router.push('/')}
              aria-label="Back to Hazard Map"
              title="Back to Hazard Map"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all hover:bg-slate-200 hover:text-gakit-maroon active:scale-95 shrink-0 ring-1 ring-slate-200/80 shadow-xs"
            >
              <ChevronLeft className="h-4.5 w-4.5 stroke-[2.5]" />
            </button>
          )}

          {!showSectionNav && (
            <div className="flex items-center gap-1.5 md:hidden min-w-0 ml-3.5">
              <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-700 truncate">
                FLOOD SIM
              </span>
              <sup className="select-none rounded bg-amber-100/90 px-1 py-0.5 text-[7px] font-extrabold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200/70 leading-none shadow-xs shrink-0">
                BETA
              </sup>
            </div>
          )}

          <button
            type="button"
            onClick={() => (showSectionNav ? scrollToSection('hazard-map') : router.push('/'))}
            className={`group items-center rounded-lg transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 ${
              !showSectionNav ? 'hidden md:flex' : 'flex'
            }`}
            aria-label="Go to the GAKIT hazard map"
            title={showSectionNav ? undefined : 'Return to public map'}
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

        {/* Center: Title (for Scenario Simulator) OR Location Search (for Hazard Map) */}
        <div className="flex flex-1 items-center justify-center px-2 min-w-0">
          {!showSectionNav && (
            <div className="hidden md:inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-100/80 px-3.5 py-1 shadow-xs backdrop-blur-sm">
              <Waves className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-700">
                FLOOD SCENARIO SIMULATOR
              </span>
              <sup className="select-none rounded bg-amber-100/90 px-1 py-0.5 text-[7px] font-extrabold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200/70 leading-none shadow-xs shrink-0">
                BETA
              </sup>
            </div>
          )}
          {onSearchSelect && (
            <LocationSearch
              variant="header-compact"
              onSelect={onSearchSelect}
              onLocate={onLocate}
              className="w-full max-w-md lg:max-w-lg"
            />
          )}
        </div>

        {/* Desktop Navigation & Actions */}
        <div className="hidden items-center justify-end gap-1.5 md:flex shrink-0">
          {showSectionNav && !isChecking && accountPillVisible && (
            <button
              onClick={handleAccountClick}
              className="group relative inline-flex items-center justify-center rounded-full bg-gradient-to-r from-gakit-maroon to-maroon-800 px-3.5 py-1.5 font-heading text-xs font-bold text-white shadow-[0_2px_8px_rgba(123,17,19,0.28)] transition-all duration-150 hover:from-maroon-800 hover:to-maroon-900 hover:shadow-[0_4px_12px_rgba(123,17,19,0.35)] active:scale-95"
            >
              <span className="tracking-wide">{accountLabel}</span>
            </button>
          )}

          {/* Right cluster: info, notifications, account */}
          <div className="flex items-center gap-0.5">
            {showBentoMenu && (
              <BentoMenu
                items={bentoTiles}
                onNavigateSection={scrollToSection}
                activeSection={activeSection}
              />
            )}
            <HowToReportPopover
              isOpen={isInfoOpen}
              onToggle={() => {
                setIsInfoOpen((open) => !open);
                setIsMenuOpen(false);
              }}
              onNavigateAbout={() => scrollToSection('about')}
              containerRef={infoRef}
            />
            <NotificationBell
              notifications={weatherNotifications}
              onSelectAlert={setSelectedAlert}
              onMarkRead={markAlertRead}
              variant="header"
            />
            <UserNavMenu
              email={email}
              isOpen={isMenuOpen}
              onToggle={() => {
                setIsMenuOpen((isOpen) => !isOpen);
                setIsInfoOpen(false);
              }}
              onSignOutClick={() => {
                setIsMenuOpen(false);
                setShowSignOutConfirm(true);
              }}
              isSigningOut={isSigningOut}
              containerRef={userMenuRef}
            />
          </div>
        </div>

        {/* Mobile top-right cluster */}
        <div className="flex items-center gap-1 md:hidden">
          {/* Show bento menu in top header only when bottom nav is absent (e.g. on /flood-scenarios) */}
          {showBentoMenu && !showBottomNav && (
            <BentoMenu
              items={bentoTiles}
              onNavigateSection={scrollToSection}
              activeSection={activeSection}
            />
          )}
          {/* Without the bottom bar the bell has no mobile home, so it moves up here. */}
          {!showBottomNav && (
            <NotificationBell
              notifications={weatherNotifications}
              onSelectAlert={setSelectedAlert}
              onMarkRead={markAlertRead}
              variant="header"
            />
          )}
          <HowToReportPopover
            isOpen={isInfoOpen}
            onToggle={() => {
              setIsInfoOpen((v) => !v);
              setIsMenuOpen(false);
            }}
            onNavigateAbout={() => scrollToSection('about')}
            containerRef={mobileInfoRef}
          />
          {!isChecking && (
            email ? (
              <UserNavMenu
                email={email}
                isOpen={isMenuOpen}
                variant="header"
                onToggle={() => {
                  setIsMenuOpen((isOpen) => !isOpen);
                  setIsInfoOpen(false);
                }}
                onSignOutClick={() => {
                  setIsMenuOpen(false);
                  setShowSignOutConfirm(true);
                }}
                isSigningOut={isSigningOut}
                containerRef={mobileUserMenuRef}
              />
            ) : (
              <button
                type="button"
                onClick={handleAccountClick}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-gakit-maroon active:scale-95"
                title="Login"
                aria-label="Login"
              >
                <UserRound className="h-5 w-5" />
              </button>
            )
          )}
        </div>
      </div>
    </header>

    {showBottomNav && (
      <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-[1200] px-3 pb-2 md:hidden">
        <div className="pointer-events-auto mx-auto grid max-w-sm grid-cols-4 items-center gap-1 p-1.5 hud-card">
          {/* 1. Map */}
          <button
            onClick={() => scrollToSection('hazard-map')}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-95 ${
              activeSection === 'hazard-map'
                ? 'bg-slate-200 text-slate-900 font-bold'
                : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon active:bg-slate-100'
            }`}
          >
            <MapPinned className={`h-5 w-5 ${activeSection === 'hazard-map' ? 'text-gakit-maroon' : ''}`} />
            <span className="text-[10px] font-semibold">Map</span>
          </button>

          {/* 2. Alerts */}
          <NotificationBell
            notifications={weatherNotifications}
            onSelectAlert={setSelectedAlert}
            onMarkRead={markAlertRead}
            variant="mobile-nav"
            className="flex w-full flex-col items-center justify-center"
          />

          {/* 3. About */}
          <button
            onClick={() => scrollToSection('about')}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-95 ${
              activeSection === 'about'
                ? 'bg-slate-200 text-slate-900 font-bold'
                : 'text-slate-500 hover:bg-slate-50 hover:text-gakit-maroon active:bg-slate-100'
            }`}
          >
            <Info className={`h-5 w-5 ${activeSection === 'about' ? 'text-gakit-maroon' : ''}`} />
            <span className="text-[10px] font-semibold">About</span>
          </button>

          {/* 4. Apps (Rightmost) */}
          {showBentoMenu ? (
            <BentoMenu
              items={bentoTiles}
              variant="mobile-nav"
              onNavigateSection={scrollToSection}
              activeSection={activeSection}
            />
          ) : (
            <div />
          )}
        </div>
      </nav>
    )}
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
