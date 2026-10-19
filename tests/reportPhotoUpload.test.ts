import { afterEach, expect, it, vi } from 'vitest';
import { fetchReportReceipt, uploadReportPhoto } from '@/app/public-view/actions/publicView';

vi.mock('@/lib/supabase/client', () => ({ authHeaders: async () => ({}) }));
vi.mock('@/lib/backend/backendStatus', () => ({ markBackendOnline: vi.fn(), markBackendWarming: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it('passes a guest receipt only as a header for its report upload', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'report-a' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  await uploadReportPhoto('report-a', new Blob(['fixture'], { type: 'image/jpeg' }), undefined, 'scoped-secret');
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toMatch(/\/reports\/report-a\/photo$/);
  expect(url).not.toContain('scoped-secret');
  expect(init.headers['X-Report-Upload-Token']).toBe('scoped-secret');
  expect(init.headers['Content-Type']).toBeUndefined();
  expect(init.body).toBeInstanceOf(FormData);
});

it('refreshes the saved receipt without caching or putting credentials in the URL', async () => {
  const receipt = { status: 'ANOMALY', validationSummary: { explanation: 'Saved assessment changed' } };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(receipt), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await fetchReportReceipt('report-a', undefined, 'scoped-secret')).toEqual(receipt);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toMatch(/\/reports\/report-a\/receipt$/);
  expect(url).not.toContain('scoped-secret');
  expect(init.cache).toBe('no-store');
  expect(init.headers['X-Report-Upload-Token']).toBe('scoped-secret');
});
