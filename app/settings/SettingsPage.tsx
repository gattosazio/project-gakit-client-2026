'use client';

import { ArrowLeft, Settings } from 'lucide-react';
import { useRouteLoader } from '@/components/RouteLoader';
import { homePathForRole, type AuthSnapshot } from '@/lib/auth/roles';

export function SettingsPage({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  const { navigate, loadingOverlay } = useRouteLoader();
  const role = initialAuth?.role ?? null;
  const home = homePathForRole(role);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <header className="flex h-24 shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 md:px-9">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(home ?? '/')}
            aria-label="Back to portal"
            className="rounded-full bg-slate-50 p-2.5 text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-maroon-50 hover:text-gakit-maroon hover:ring-maroon-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-[-0.02em] text-slate-900 md:text-[1.75rem]">
              Settings
            </h1>
            <p className="mt-1 hidden truncate text-sm text-slate-500 md:block">
              Your account settings and portal preferences
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-20 md:px-7 md:py-6 lg:py-8">
        <section className="rounded-2xl border border-canvas-grey bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon-50">
            <Settings className="h-6 w-6 text-gakit-maroon" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Account settings are coming soon
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Profile, notification, and portal preferences will live here. For
            now you can manage platform users, roles, and audit history from
            the administration portal.
          </p>
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-800"
            >
              Open Administration
            </button>
          )}
        </section>
      </main>

      {loadingOverlay}
    </div>
  );
}