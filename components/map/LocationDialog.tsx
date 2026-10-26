'use client';

import { useId, type ReactNode } from 'react';
import { MapPin, X, type LucideIcon } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import type { SelectedLocation } from '@/types/report';

export const LOCATION_DIALOG_PRIMARY_BUTTON = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';
export const LOCATION_DIALOG_SECONDARY_BUTTON = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 disabled:opacity-50';

/** Shared presentation for the map's assessment and reporting flows. */
export function LocationDialog({ isOpen, onClose, title, subtitle, icon: Icon, closeLabel, busy = false, suspended = false, guide, tour, helpCta, children, footer }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  closeLabel: string;
  busy?: boolean;
  suspended?: boolean;
  /** Compact first-run guidance rendered above the footer, outside the scroll area. */
  guide?: ReactNode;
  /** Modal-scoped guided overlay rendered above the dialog content. */
  tour?: ReactNode;
  /** Small contextual help action rendered alongside the primary footer action. */
  helpCta?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  const titleId = useId();
  const showTour = Boolean(tour);
  return <Dialog isOpen={isOpen} onClose={onClose} ariaLabelledBy={titleId} suspended={suspended}
    maxWidthClass="max-w-lg" panelClassName="relative flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
    <header className="flex shrink-0 items-center gap-3 bg-gakit-maroon px-5 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="font-heading text-lg font-bold tracking-tight text-white">{title}</h2>
        <p className="mt-0.5 text-xs text-rose-100">{subtitle}</p>
      </div>
      <button type="button" onClick={onClose} disabled={busy} aria-label={closeLabel}
        inert={showTour || undefined}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-rose-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </header>
    <div data-location-dialog-body inert={showTour || undefined}
      className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 selection:bg-maroon-100 selection:text-maroon-900 sm:px-5">
      {children}
    </div>
    {guide && (
      <div inert={showTour || undefined} className="shrink-0 border-t border-amber-200 bg-amber-50/70 px-4 py-2.5 sm:px-5">
        {guide}
      </div>
    )}
    {tour}
    <footer inert={showTour || undefined} className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
      {helpCta}
      {footer}
    </footer>
  </Dialog>;
}

export function LocationSummary({ location, address }: {
  location: Pick<SelectedLocation, 'lat' | 'lng' | 'address'> | null;
  address?: string;
}) {
  return <section data-tour="assessment-location" className="flex items-start gap-2 border-b border-slate-200 pb-3" aria-label="Selected location">
    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gakit-maroon" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="break-words text-sm font-semibold leading-snug text-slate-900">{address || location?.address || 'Select a location on the map'}</p>
      {location && <p className="mt-1 text-[11px] tabular-nums text-slate-500">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>}
    </div>
  </section>;
}
