import { describe, expect, it } from 'vitest';
import { isFrameFresh } from '@/lib/map/himawari';

describe('isFrameFresh', () => {
  const now = new Date('2026-08-25T11:23:00Z');

  it('accepts a frame published within the normal ~13 minute lag', () => {
    // Real header observed for slot 1030 on a healthy day.
    expect(isFrameFresh('Tue, 25 Aug 2026 10:43:30 GMT', '1030', now)).toBe(true);
  });

  it('rejects yesterday carry-over files served during a publish gap', () => {
    // Real header observed while slot 1110 was pending on 2026-08-25.
    expect(isFrameFresh('Mon, 24 Aug 2026 11:23:12 GMT', '1110', now)).toBe(false);
  });

  it('accepts frames published a few minutes before their slot', () => {
    expect(isFrameFresh('Tue, 25 Aug 2026 10:52:00 GMT', '1100', now)).toBe(true);
  });

  it('rejects long-delayed publications beyond the freshness window', () => {
    expect(isFrameFresh('Tue, 25 Aug 2026 11:40:00 GMT', '1100', now)).toBe(false);
  });

  it('handles the UTC midnight boundary', () => {
    const justAfterMidnight = new Date('2026-08-26T00:05:00Z');
    expect(
      isFrameFresh('Tue, 25 Aug 2026 23:59:00 GMT', '2350', justAfterMidnight)
    ).toBe(true);
    expect(
      isFrameFresh('Mon, 24 Aug 2026 23:55:00 GMT', '2350', justAfterMidnight)
    ).toBe(false);
  });

  it('resolves slots in the future of the server clock to the previous day', () => {
    const justBeforeMidnight = new Date('2026-08-25T23:58:00Z');
    expect(
      isFrameFresh('Tue, 25 Aug 2026 00:12:00 GMT', '0000', justBeforeMidnight)
    ).toBe(true);
  });

  it('rejects missing or unparseable Last-Modified headers', () => {
    expect(isFrameFresh(null, '1100', now)).toBe(false);
    expect(isFrameFresh('not-a-date', '1100', now)).toBe(false);
  });
});
