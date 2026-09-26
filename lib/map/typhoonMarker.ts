import type * as MapLibreGL from 'maplibre-gl';

export interface StormPointFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    typhoon_name?: string;
    local_name?: string;
    international_name?: string;
    typhoon_type?: string;
    date?: string;
    time?: string;
    datetime?: string;
    date_label?: string;
    is_current?: boolean;
    windspeed?: number;
    pressure?: number;
    radius?: number;
    [key: string]: any;
  };
}

/**
 * Creates the DOM element for the current storm callout:
 * - A 0x0 container anchored to the storm coordinates.
 * - Minimal, unobtrusive date text in slate (e.g. "Aug 30, 8:00 AM") with a soft white text halo.
 * - No card background, no "Current" text, no category badge, no bullet `●`, no line.
 */
export function createCurrentStormMarkerElement(
  feature: StormPointFeature,
  onClick?: (feature: StormPointFeature, lngLat: [number, number]) => void
): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const props = feature.properties || {};
  const [lng, lat] = feature.geometry.coordinates;
  const dateLabel = props.date_label || '';
  if (!dateLabel) return null;

  // Container (0x0 anchor at storm coordinates)
  const container = document.createElement('div');
  container.className = 'gakit-typhoon-marker-container';
  container.style.position = 'relative';
  container.style.width = '0px';
  container.style.height = '0px';
  container.style.pointerEvents = 'none';
  container.style.userSelect = 'none';

  // Minimal Date Label in Slate (no line, no card, no "Current", soft halo for legibility)
  const label = document.createElement('div');
  label.className = 'gakit-typhoon-date-label';
  label.setAttribute(
    'style',
    'position: absolute; left: 12px; top: -14px; font-family: var(--font-inter), system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 600; color: #475569; cursor: pointer; pointer-events: auto; white-space: nowrap; user-select: none; font-variant-numeric: tabular-nums; text-shadow: 0 0 3px #ffffff, 0 0 4px #ffffff, 0 1px 2px rgba(255, 255, 255, 0.9); transition: color 0.15s ease;'
  );
  label.textContent = dateLabel;

  // Hover states
  label.addEventListener('mouseenter', () => {
    label.style.color = '#0f172a';
  });

  label.addEventListener('mouseleave', () => {
    label.style.color = '#475569';
  });

  if (onClick) {
    label.addEventListener('click', (e) => {
      e?.stopPropagation?.();
      onClick(feature, [lng, lat]);
    });
  }

  container.appendChild(label);
  return container;
}

/**
 * Synchronizes current storm DOM markers with the track GeoJSON.
 * Finds all points where `is_current === true` and attaches the minimal date marker.
 */
export function syncCurrentStormMarkers(
  map: any,
  maplibreglInstance: typeof MapLibreGL | any,
  trackGeoJson: any,
  onClick?: (feature: StormPointFeature, lngLat: [number, number]) => void
): any[] {
  if (!map || !maplibreglInstance || !trackGeoJson?.features) return [];

  const markers: any[] = [];
  const currentPoints = trackGeoJson.features.filter(
    (f: any) => f?.geometry?.type === 'Point' && f?.properties?.is_current === true
  );

  for (const feature of currentPoints) {
    const coords = feature.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const el = createCurrentStormMarkerElement(feature, onClick);
    if (!el) continue;

    const marker = new maplibreglInstance.Marker({
      element: el,
      anchor: 'center',
    })
      .setLngLat(coords)
      .addTo(map);

    markers.push(marker);
  }

  return markers;
}

/**
 * Removes and destroys all active storm markers.
 */
export function clearCurrentStormMarkers(markers: any[]): void {
  if (!Array.isArray(markers)) return;
  for (const marker of markers) {
    try {
      marker.remove();
    } catch {}
  }
}
