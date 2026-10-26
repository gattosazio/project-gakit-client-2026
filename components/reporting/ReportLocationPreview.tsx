'use client';

import { LocationMiniMap } from '@/components/map/LocationMiniMap';
import type { SelectedLocation } from '@/types/report';

/** Always-visible location confirmation using the report-management imagery. */
export function ReportLocationPreview({ location, address, onAdjust, disabled }: {
  location: SelectedLocation;
  address?: string;
  onAdjust?: () => void;
  disabled: boolean;
}) {
  return <section data-tour="report-location" aria-label="Report location preview" className="relative h-32 overflow-hidden rounded-xl sm:h-36">
    <LocationMiniMap latitude={location.lat} longitude={location.lng} onViewOnMap={onAdjust}
      disabled={disabled} attributionPosition="top" actionLabel={onAdjust ? 'Adjust report location on map' : 'Report location on satellite map'} />
    {onAdjust && <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-gakit-maroon shadow-sm">Adjust</span>}
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/65 to-transparent px-3 pb-2.5 pt-5 text-white">
      <p title={address || location.address} className="line-clamp-2 text-sm font-semibold leading-snug">{address || location.address}</p>
      <p className="mt-0.5 text-[11px] tabular-nums text-white/80">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>
    </div>
  </section>;
}
