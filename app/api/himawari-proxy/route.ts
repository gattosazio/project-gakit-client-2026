import { NextResponse } from 'next/server';
import { isFrameFresh } from '@/lib/map/himawari';

const JMA_BASE = 'https://www.data.jma.go.jp/mscweb/data/himawari/img';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get('area') || 'se2';
  const band = searchParams.get('band') || 'b13';
  const time = searchParams.get('time');

  if (!time || !/^\d{4}$/.test(time)) {
    return NextResponse.json({ error: 'time (HHMM) required' }, { status: 400 });
  }

  const url = `${JMA_BASE}/${area}/${area}_${band}_${time}.jpg`;

  try {
    // no-store on purpose: slots are overwritten in place when JMA publishes
    // late, and Next's data cache would otherwise keep serving the stale (or
    // 404) bytes for up to 10 minutes after JMA has already fixed the slot.
    // Published frames are immutable, so only gap windows need fresh checks.
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    // Until a delayed scan lands, JMA serves yesterday's file with HTTP 200.
    // Gate on Last-Modified so a publish gap reads as "frame missing" instead
    // of replaying day-old weather inside the loop.
    if (!isFrameFresh(res.headers.get('last-modified'), time)) {
      return NextResponse.json({ error: 'frame not yet published' }, { status: 404 });
    }

    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
  }
}
