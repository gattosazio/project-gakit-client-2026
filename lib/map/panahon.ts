import { buildFullForecastCone } from '@/lib/map/forecastCone';
import crypto from 'crypto';
import {
  buildColoredTrackLines,
  formatTyphoonDisplayName,
  isCoordInPar,
  normalizeTyphoonCategory,
} from '@/lib/map/typhoon';

export interface PanahonCycloneNode {
  cyclone_type?: string;
  date?: string;
  time?: string;
  latitude?: string | number;
  longitude?: string | number;
  radius?: string | number;
  windspeed?: string | number;
  pressure?: string | number;
}

export interface PanahonCycloneItem {
  cyclone_name?: string;
  info?: Record<string, PanahonCycloneNode>;
}

/**
 * Checks if a Panahon cyclone payload item is expired according to PAGASA/Panahon rules.
 * Panahon hides storms where Date.parse(last_node) + 25 hours <= now.
 */
export function isCycloneExpired(
  info?: Record<string, PanahonCycloneNode>,
  maxAgeMs = 25 * 3600 * 1000
): boolean {
  if (!info || Object.keys(info).length === 0) return true;
  const sortedKeys = Object.keys(info).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const lastKey = sortedKeys[sortedKeys.length - 1];
  const lastNode = info[lastKey];
  if (!lastNode) return true;
  const rawDate =
    lastNode.date && lastNode.time
      ? `${lastNode.date}T${lastNode.time}:00`
      : lastNode.date || lastKey;
  const normalized =
    rawDate.includes(' ') && !rawDate.includes('T') ? rawDate.replace(' ', 'T') : rawDate;
  const formatted =
    normalized.includes('+') || normalized.includes('Z') ? normalized : `${normalized}+08:00`;
  const parsedTime = Date.parse(formatted);
  if (Number.isNaN(parsedTime)) return false;
  return Date.now() > parsedTime + maxAgeMs;
}

export function formatTrackDateLabel(dateStr?: string, timeStr?: string, datetimeStr?: string): string {
  try {
    const raw = datetimeStr || (dateStr && timeStr ? `${dateStr}T${timeStr}:00` : dateStr || '');
    if (!raw) return '';
    const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      const monthDay = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const time = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${monthDay}, ${time}`;
    }
  } catch {}
  return [dateStr, timeStr].filter(Boolean).join(' ');
}

/**
 * Converts Panahon live JSON array into MapLibre-compatible GeoJSON FeatureCollection
 */
export function convertPanahonToGeoJSON(
  panahonData: PanahonCycloneItem[],
  filterExpired = false
): GeoJSON.FeatureCollection {
  if (!Array.isArray(panahonData) || !panahonData.length) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features: GeoJSON.Feature[] = [];

  for (const cyclone of panahonData) {
    if (filterExpired && isCycloneExpired(cyclone.info)) {
      continue;
    }
    const rawName = cyclone.cyclone_name || '';
    const match = rawName.match(/^([^{}]*)?(?:\{([^{}]*)\})?$/);
    const localPart = match?.[1]?.trim() || '';
    const intlPart = match?.[2]?.trim() || '';
    const cleanLocalPart = localPart.replace(/^bagyong\s+/i, '').trim();
    const cleanIntlPart = intlPart.replace(/^bagyong\s+/i, '').trim();
    const localName = cleanLocalPart || cleanIntlPart || 'Tropical Cyclone';
    const internationalName = cleanIntlPart;
    const name = formatTyphoonDisplayName(localName, internationalName);

    const info = cyclone.info || {};
    const sortedKeys = Object.keys(info).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        return na - nb;
      }
      return a.localeCompare(b);
    });

    // Identify the latest current/anchor observation node (last one with radius === 0)
    let currentKey: string | null = null;
    for (const key of sortedKeys) {
      const node = info[key];
      const radius = typeof node.radius === 'string' ? parseFloat(node.radius) : Number(node.radius || 0);
      if (radius === 0) {
        currentKey = key;
      }
    }
    if (!currentKey && sortedKeys.length > 0) {
      currentKey = sortedKeys[0];
    }

    const stormPoints: any[] = [];
    const allMilestones: Array<{ lat: number; lon: number; radius: number }> = [];
    let currentIdx = -1;

    for (const key of sortedKeys) {
      const node = info[key];
      const lat = typeof node.latitude === 'string' ? parseFloat(node.latitude) : Number(node.latitude || 0);
      const lon = typeof node.longitude === 'string' ? parseFloat(node.longitude) : Number(node.longitude || 0);
      const radius = typeof node.radius === 'string' ? parseFloat(node.radius) : Number(node.radius || 0);
      const ctype = normalizeTyphoonCategory(node.cyclone_type);

      if (Number.isNaN(lat) || Number.isNaN(lon) || (lat === 0 && lon === 0)) continue;

      const isCurrent = key === currentKey;
      if (isCurrent) currentIdx = stormPoints.length;

      allMilestones.push({ lat, lon, radius });

      const dateLabel = formatTrackDateLabel(
        node.date,
        node.time,
        node.date && node.time ? `${node.date}T${node.time}:00` : key
      );

      const ptFeature: any = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        properties: {
          typhoon_name: name,
          local_name: localName,
          international_name: internationalName,
          typhoon_type: ctype,
          latitude: lat,
          longitude: lon,
          radius,
          date: node.date,
          time: node.time,
          datetime: node.date && node.time ? `${node.date}T${node.time}:00` : key,
          date_label: dateLabel,
          is_current: isCurrent,
          current_label: isCurrent ? (dateLabel ? `Current: ${dateLabel}` : 'Current Position') : '',
          is_inside_par: isCoordInPar(lon, lat),
          isInsidePar: isCoordInPar(lon, lat),
        },
      };

      stormPoints.push(ptFeature);
      features.push(ptFeature);
    }

    // Add Colored Track Lines (Solid before current track, dashed forecast, colored by category)
    if (currentIdx === -1 && stormPoints.length > 0) currentIdx = 0;
    const trackLines = buildColoredTrackLines(stormPoints, currentIdx, name);
    features.push(...trackLines);

    // Add Uncertainty Forecast Cone
    const coneCoords = buildFullForecastCone(allMilestones);
    if (coneCoords.length > 0) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: coneCoords,
        },
        properties: {
          type: 'smoothed_hull',
          typhoon_name: name,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Server-side fetcher with HMAC-SHA256 handshake to DOST-PAGASA Panahon portal
 */
export async function fetchPanahonLiveCyclone(): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const baseRes = await fetch('https://www.panahon.gov.ph/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });

    if (!baseRes.ok) return null;

    const html = await baseRes.text();
    const rawSetCookie = (baseRes.headers as any).getSetCookie?.() || [baseRes.headers.get('set-cookie') || ''];
    const cookieHeader = rawSetCookie.map((c: string) => c.split(';')[0]).filter(Boolean).join('; ');

    const csrfMatch = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
    const apiSigMatch = html.match(/<meta\s+name=["'](?:api-sig|api-sig-handle)["']\s+content=["']([^"']+)["']/i);

    if (!csrfMatch) return null;

    const csrfToken = csrfMatch[1];
    const apiSig = apiSigMatch?.[1];
    const cleanPath = 'api/v1/cyclone-track';

    const buildSignedHeaders = (): Record<string, string> => {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://www.panahon.gov.ph/',
        'Cookie': cookieHeader,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*',
      };
      if (apiSig) {
        const ts = String(Math.floor(Date.now() / 1000));
        const nonce = crypto.randomBytes(16).toString('hex');
        const message = ['GET', cleanPath, ts, nonce].join('\n');
        const sig = crypto.createHmac('sha256', apiSig).update(message).digest('hex');
        headers['X-Ts'] = ts;
        headers['X-Nonce'] = nonce;
        headers['X-Sig'] = sig;
      }
      return headers;
    };

    const apiUrl = `https://www.panahon.gov.ph/${cleanPath}?token=${encodeURIComponent(csrfToken)}`;
    let apiRes = await fetch(apiUrl, {
      headers: buildSignedHeaders(),
      signal: AbortSignal.timeout(10000),
    });

    // Transient 5xx retry: if Panahon is briefly locking the database during bulletin generation, retry once after 800ms
    if (!apiRes.ok && apiRes.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      apiRes = await fetch(apiUrl, {
        headers: buildSignedHeaders(),
        signal: AbortSignal.timeout(8000),
      });
    }

    if (!apiRes.ok) return null;
    const rawData = await apiRes.json();
    if (!Array.isArray(rawData) || !rawData.length) return null;

    return convertPanahonToGeoJSON(rawData, true);
  } catch (err) {
    console.error('Panahon live cyclone fetch error:', err);
    return null;
  }
}
