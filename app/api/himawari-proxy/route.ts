import { NextResponse } from 'next/server';

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
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
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
