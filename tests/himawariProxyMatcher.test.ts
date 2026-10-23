import { describe, expect, it } from 'vitest';
import * as nextTesting from 'next/experimental/testing/server';
import { config } from '@/proxy';

// Next 16 renamed this helper alongside middleware -> proxy.
const matches = Reflect.get(nextTesting, 'unstable_doesProxyMatch')
  ?? Reflect.get(nextTesting, 'unstable_doesMiddlewareMatch');

describe('public satellite requests', () => {
  it.each([
    '/api/himawari-proxy?manifest=1',
    '/api/himawari-proxy?time=20261023023000',
    '/api/himawari-proxy/',
  ])('bypasses the auth proxy: %s', url => {
    expect(matches({ config, nextConfig: {}, url })).toBe(false);
  });

  it.each(['/admin', '/monitoring', '/settings', '/login', '/api/himawari-proxy-other'])('preserves auth processing for %s', url => {
    expect(matches({ config, nextConfig: {}, url })).toBe(true);
  });
});
