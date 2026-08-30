import crypto from 'node:crypto';

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
 * Great-circle destination point calculation (geodesic spherical forward azimuth)
 */
function fnp(latDeg: number, lngDeg: number, dKm: number, bearingDeg: number): [number, number] {
  const r = 6378.14;
  const lat = (latDeg * Math.PI) / 180;
  const lng = (lngDeg * Math.PI) / 180;
  const b = (bearingDeg * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat) * Math.cos(dKm / r) + Math.cos(lat) * Math.sin(dKm / r) * Math.cos(b)
  );
  const lng2 =
    lng +
    Math.atan2(
      Math.sin(b) * Math.sin(dKm / r) * Math.cos(lat),
      Math.cos(dKm / r) - Math.sin(lat) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

function crossProduct(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * 2D Monotone chain convex hull algorithm
 * Returns closed ring of [lng, lat] coordinates
 */
function convexHull2D(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length <= 1) return points;

  // Deduplicate and sort by lng then lat
  const pts = Array.from(
    new Map(points.map((p) => [`${p[0].toFixed(5)},${p[1].toFixed(5)}`, p])).values()
  ).sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

  if (pts.length <= 2) {
    return [...pts, pts[0]];
  }

  const lower: Array<[number, number]> = [];
  for (const p of pts) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Array<[number, number]> = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  hull.push(hull[0]);
  return hull;
}

/**
 * Builds the continuous official PAGASA forecast uncertainty cone starting from current storm position
 */
function buildFullForecastCone(milestones: Array<{ lat: number; lon: number; radius: number }>): Array<[number, number]> {
  if (!milestones || !milestones.length) return [];

  let currentAnchor: { lat: number; lon: number } | null = null;
  const forecastNodes: Array<{ lat: number; lon: number; radius: number }> = [];

  for (const m of milestones) {
    if (m.radius === 0) {
      currentAnchor = { lat: m.lat, lon: m.lon };
    } else if (m.radius > 0) {
      forecastNodes.push(m);
    }
  }

  if (!forecastNodes.length) return [];
  if (!currentAnchor) currentAnchor = { lat: forecastNodes[0].lat, lon: forecastNodes[0].lon };

  const allPoints: Array<[number, number]> = [];
  // Current storm center anchor
  allPoints.push([currentAnchor.lon, currentAnchor.lat]);

  // Connect current storm center to first forecast node with interpolated circle points
  for (const t of [0.25, 0.5, 0.75]) {
    const interLat = currentAnchor.lat + (forecastNodes[0].lat - currentAnchor.lat) * t;
    const interLon = currentAnchor.lon + (forecastNodes[0].lon - currentAnchor.lon) * t;
    const interRad = forecastNodes[0].radius * t;
    for (let angle = 0; angle < 360; angle += 15) {
      const [pLat, pLon] = fnp(interLat, interLon, interRad, angle);
      allPoints.push([Number(pLon.toFixed(5)), Number(pLat.toFixed(5))]);
    }
  }

  // Add perimeter circle points for every forecast node
  for (let i = 0; i < forecastNodes.length; i++) {
    const fn = forecastNodes[i];
    for (let angle = 0; angle < 360; angle += 10) {
      const [pLat, pLon] = fnp(fn.lat, fn.lon, fn.radius, angle);
      allPoints.push([Number(pLon.toFixed(5)), Number(pLat.toFixed(5))]);
    }

    // Add intermediate tangent interpolation between consecutive forecast milestones
    if (i < forecastNodes.length - 1) {
      const nextFn = forecastNodes[i + 1];
      for (const t of [0.25, 0.5, 0.75]) {
        const interLat = fn.lat + (nextFn.lat - fn.lat) * t;
        const interLon = fn.lon + (nextFn.lon - fn.lon) * t;
        const interRad = fn.radius + (nextFn.radius - fn.radius) * t;
        for (let angle = 0; angle < 360; angle += 15) {
          const [pLat, pLon] = fnp(interLat, interLon, interRad, angle);
          allPoints.push([Number(pLon.toFixed(5)), Number(pLat.toFixed(5))]);
        }
      }
    }
  }

  return convexHull2D(allPoints);
}

/**
 * Converts Panahon live JSON array into MapLibre-compatible GeoJSON FeatureCollection
 */
export function convertPanahonToGeoJSON(panahonData: PanahonCycloneItem[]): GeoJSON.FeatureCollection {
  if (!Array.isArray(panahonData) || !panahonData.length) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features: GeoJSON.Feature[] = [];

  for (const cyclone of panahonData) {
    const rawName = cyclone.cyclone_name || '';
    const match = rawName.match(/^([^{}]*)?(?:\{([^{}]*)\})?$/);
    const localPart = match?.[1]?.trim() || '';
    const intlPart = match?.[2]?.trim() || '';
    const localName = localPart || intlPart || 'Tropical Cyclone';
    const internationalName = intlPart;
    const name = internationalName && internationalName !== localName
      ? `${localName} (${internationalName})`
      : localName;

    const info = cyclone.info || {};
    const sortedKeys = Object.keys(info).sort();

    const lineCoords: number[][] = [];
    const allMilestones: Array<{ lat: number; lon: number; radius: number }> = [];

    for (const key of sortedKeys) {
      const node = info[key];
      const lat = typeof node.latitude === 'string' ? parseFloat(node.latitude) : Number(node.latitude || 0);
      const lon = typeof node.longitude === 'string' ? parseFloat(node.longitude) : Number(node.longitude || 0);
      const radius = typeof node.radius === 'string' ? parseFloat(node.radius) : Number(node.radius || 0);
      const ctype = (node.cyclone_type || 'TD').trim().toUpperCase();

      if (Number.isNaN(lat) || Number.isNaN(lon) || (lat === 0 && lon === 0)) continue;

      lineCoords.push([lon, lat]);
      allMilestones.push({ lat, lon, radius });

      features.push({
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
        },
      });
    }

    // Add Track Line
    if (lineCoords.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: lineCoords,
        },
        properties: {
          type: 'track_line',
          typhoon_name: name,
        },
      });
    }

    // Add Uncertainty Forecast Cone
    const coneCoords = buildFullForecastCone(allMilestones);
    if (coneCoords.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[coneCoords]],
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
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });

    if (!baseRes.ok) return null;

    const html = await baseRes.text();
    const rawSetCookie = (baseRes.headers as any).getSetCookie?.() || [baseRes.headers.get('set-cookie') || ''];
    const cookieHeader = rawSetCookie.map((c: string) => c.split(';')[0]).filter(Boolean).join('; ');

    const csrfMatch = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
    const apiSigMatch = html.match(/<meta\s+name=["']api-sig["']\s+content=["']([^"']+)["']/i);

    if (!csrfMatch || !apiSigMatch) return null;

    const csrfToken = csrfMatch[1];
    const apiSig = apiSigMatch[1];
    const cleanPath = 'api/v1/cyclone-track';
    const ts = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = ['GET', cleanPath, ts, nonce].join('\n');
    const sig = crypto.createHmac('sha256', apiSig).update(message).digest('hex');

    const apiUrl = `https://www.panahon.gov.ph/${cleanPath}?token=${encodeURIComponent(csrfToken)}`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://www.panahon.gov.ph/',
        'Cookie': cookieHeader,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*',
        'X-Ts': ts,
        'X-Nonce': nonce,
        'X-Sig': sig,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!apiRes.ok) return null;
    const rawData = await apiRes.json();
    if (!Array.isArray(rawData) || !rawData.length) return null;

    return convertPanahonToGeoJSON(rawData);
  } catch (err) {
    console.error('Panahon live cyclone fetch error:', err);
    return null;
  }
}
