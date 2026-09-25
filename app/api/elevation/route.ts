import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { ElevationMeta } from '@/lib/map/elevation';

let elevationBuffer: Buffer | null = null;
let elevationMeta: ElevationMeta | null = null;

function loadElevationData(): { buffer: Buffer; meta: ElevationMeta } | null {
  if (elevationBuffer && elevationMeta) {
    return { buffer: elevationBuffer, meta: elevationMeta };
  }

  try {
    const binPath = path.join(process.cwd(), 'public', 'data', 'iligan-elevation.bin');
    const metaPath = path.join(process.cwd(), 'public', 'data', 'iligan-elevation-meta.json');

    if (fs.existsSync(binPath) && fs.existsSync(metaPath)) {
      elevationBuffer = fs.readFileSync(binPath);
      const rawMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      elevationMeta = {
        min_lat: rawMeta.min_lat ?? rawMeta.bounds?.lat_min,
        max_lat: rawMeta.max_lat ?? rawMeta.bounds?.lat_max,
        min_lng: rawMeta.min_lng ?? rawMeta.bounds?.lng_min,
        max_lng: rawMeta.max_lng ?? rawMeta.bounds?.lng_max,
        rows: rawMeta.rows ?? rawMeta.shape?.[0],
        cols: rawMeta.cols ?? rawMeta.shape?.[1],
        scale: rawMeta.scale ?? 0.1,
        nodata: rawMeta.nodata,
      };
      return { buffer: elevationBuffer, meta: elevationMeta };
    }
  } catch (err) {
    console.warn('Failed to load local elevation grid:', err);
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ elevation: null });
  }

  const data = loadElevationData();
  if (!data) {
    return NextResponse.json({ elevation: null });
  }

  const { buffer, meta } = data;

  // Check bounds
  if (lat < meta.min_lat || lat > meta.max_lat || lng < meta.min_lng || lng > meta.max_lng) {
    return NextResponse.json({ elevation: null });
  }

  const rowRatio = (meta.max_lat - lat) / (meta.max_lat - meta.min_lat);
  const colRatio = (lng - meta.min_lng) / (meta.max_lng - meta.min_lng);

  const row = Math.max(0, Math.min(meta.rows - 1, Math.round(rowRatio * (meta.rows - 1))));
  const col = Math.max(0, Math.min(meta.cols - 1, Math.round(colRatio * (meta.cols - 1))));

  const index = (row * meta.cols + col) * 2;
  if (index + 1 >= buffer.length) {
    return NextResponse.json({ elevation: null });
  }

  const rawVal = buffer.readInt16LE(index);
  const elevation = Math.round((rawVal * meta.scale) * 10) / 10;

  return NextResponse.json(
    { elevation, source: 'up-dream-10m-lidar' },
    {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    }
  );
}

