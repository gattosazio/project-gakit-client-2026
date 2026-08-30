import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/elevation/route';

describe('Local Copernicus DEM Elevation Route', () => {
  it('returns exact elevation for Poblacion / City Hall (~11.5m)', async () => {
    const req = new Request('http://localhost/api/elevation?lat=8.228&lng=124.240');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.elevation).toBeGreaterThan(5);
    expect(data.elevation).toBeLessThan(20);
    expect(data.source).toBe('copernicus-dem-glo30');
  });

  it('returns high elevation for Mt. Agad-Agad (>400m)', async () => {
    const req = new Request('http://localhost/api/elevation?lat=8.203&lng=124.276');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.elevation).toBeGreaterThan(380);
    expect(data.elevation).toBeLessThan(460);
  });

  it('returns sea-level elevation for Iligan Bay Coast (~0m)', async () => {
    const req = new Request('http://localhost/api/elevation?lat=8.232&lng=124.232');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.elevation).toBeGreaterThanOrEqual(-2);
    expect(data.elevation).toBeLessThanOrEqual(5);
  });
});
