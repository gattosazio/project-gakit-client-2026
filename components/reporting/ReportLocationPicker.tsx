'use client';

import { useEffect, useId, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Locate, MapPin, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { BASEMAP_STYLES } from '@/constants/publicMap';
import { reverseGeocode } from '@/lib/map/geoUtils';
import { LocationSearch } from '@/app/public-view/components/LocationSearch';
import type { SelectedLocation } from '@/types/report';
import { adjustedReportLocation, locationFromGps } from '@/lib/reports/observationMetadata';
import 'maplibre-gl/dist/maplibre-gl.css';

export function ReportLocationPicker({ initialLocation, onClose, onConfirm }: {
  initialLocation: SelectedLocation;
  onClose: () => void;
  onConfirm: (location: SelectedLocation) => Promise<void>;
}) {
  const titleId = useId();
  const initial = useRef(initialLocation);
  const gpsTarget = useRef<SelectedLocation | null>(null);
  const origin = useRef(initialLocation);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const alive = useRef(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [candidate, setCandidate] = useState(initialLocation);
  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!container) return;
    alive.current = true;
    let generation = 0;
    maplibregl.setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs');
    const map = new maplibregl.Map({ container, style: BASEMAP_STYLES.light,
      center: [initial.current.lng, initial.current.lat], zoom: 16, attributionControl: { compact: true } });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    map.on('load', () => { if (alive.current) setReady(true); });
    map.on('movestart', () => { generation++; setMoving(true); });
    map.on('moveend', () => {
      const center = map.getCenter();
      const current = ++generation;
      setMoving(false);
      const target = gpsTarget.current;
      const atGpsTarget = target && Math.abs(target.lat - center.lat) < 1e-7 && Math.abs(target.lng - center.lng) < 1e-7;
      const location = atGpsTarget ? target : adjustedReportLocation(origin.current, center.lat, center.lng);
      if (atGpsTarget) origin.current = target;
      gpsTarget.current = null;
      setCandidate(location);
      void reverseGeocode(location.lat, location.lng).then(address => {
        if (alive.current && current === generation) setCandidate({ ...location, address });
      }).catch(() => undefined);
    });
    return () => { alive.current = false; generation++; observer.disconnect(); mapRef.current = null; map.remove(); };
  }, [container]);

  const locate = () => {
    if (!navigator.geolocation) { setError('Location access is unavailable. Move the map or search instead.'); return; }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(position => {
      if (!alive.current) return;
      setLocating(false);
      const location = locationFromGps(position);
      gpsTarget.current = location;
      origin.current = location;
      setCandidate(location);
      mapRef.current?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 17 });
    }, () => {
      if (!alive.current) return;
      setLocating(false);
      setError('Could not get your location. Allow location access, or move the map to the flooded area.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  };

  const confirm = async () => {
    if (!ready || moving || saving || locating) return;
    setSaving(true);
    setError(null);
    try { await onConfirm(candidate); }
    catch (caught) { if (alive.current) setError(caught instanceof Error ? caught.message : 'Could not confirm this location. Try again.'); }
    finally { if (alive.current) setSaving(false); }
  };

  return <Dialog isOpen onClose={() => { if (!saving) onClose(); }} ariaLabelledBy={titleId} maxWidthClass="max-w-lg" panelClassName="flex max-h-[90dvh] flex-col overflow-hidden">
    <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <div><h2 id={titleId} className="text-sm font-bold text-slate-900">Adjust report location</h2><p className="mt-1 text-[11px] text-slate-500">Move the map until the pin marks the flooded spot.</p></div>
      <button type="button" onClick={onClose} disabled={saving} aria-label="Cancel location adjustment" className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
    </div>
    <div className="min-h-0 overflow-y-auto">
      <div className={`px-4 py-2 ${saving || locating ? 'pointer-events-none opacity-50' : ''}`}>
        <LocationSearch onSelect={location => mapRef.current?.flyTo({ center: [location.lng, location.lat], zoom: 17 })} placeholder="Search street or barangay…" />
      </div>
      <div className={`relative h-[min(42dvh,20rem)] min-h-40 bg-slate-100 ${saving ? 'pointer-events-none' : ''}`}>
        <div ref={setContainer} className="h-full w-full" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <MapPin className="h-9 w-9 -translate-y-1/2 fill-white text-gakit-maroon drop-shadow-md" />
        </div>
        {!ready && <div role="status" className="absolute inset-0 flex items-center justify-center bg-white/80"><Spinner size="sm" /><span className="ml-2 text-xs text-slate-500">Loading map…</span></div>}
      </div>
      <div className="space-y-2 px-4 py-3">
        <div><p className="text-xs font-semibold leading-5 text-slate-800">{moving ? 'Positioning pin…' : candidate.address}</p><p className="mt-0.5 text-[10px] tabular-nums text-slate-400">{candidate.lat.toFixed(5)}, {candidate.lng.toFixed(5)}</p></div>
        <button type="button" onClick={locate} disabled={!ready || locating || saving} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{locating ? <Spinner size="xs" /> : <Locate className="h-3.5 w-3.5" />}Use current location</button>
        {error && <p role="alert" className="text-xs leading-4 text-red-700">{error}</p>}
      </div>
    </div>
    <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-4 py-3">
      <button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">Cancel</button>
      <button type="button" onClick={() => void confirm()} disabled={!ready || moving || saving || locating} className="inline-flex h-9 items-center gap-2 rounded-lg bg-gakit-maroon px-3 text-xs font-semibold text-white hover:bg-maroon-800 disabled:opacity-50">{saving && <Spinner size="xs" />}{saving ? 'Checking location…' : 'Confirm location'}</button>
    </div>
  </Dialog>;
}
