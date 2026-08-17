import { NextResponse } from 'next/server';

const OPENTOPO_API = 'https://api.opentopodata.org/v1/srtm30m';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${OPENTOPO_API}?locations=${lat},${lng}`);
    if (!res.ok) {
      return NextResponse.json({ elevation: null });
    }
    const data = await res.json();
    const elevation = data.results?.[0]?.elevation ?? null;
    return NextResponse.json({ elevation });
  } catch {
    return NextResponse.json({ elevation: null });
  }
}
