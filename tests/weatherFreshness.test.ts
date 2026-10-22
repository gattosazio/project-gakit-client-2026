import { describe, expect, it } from 'vitest';
import { usableCurrentWeather } from '../lib/weather/weather';

const now = Date.parse('2026-10-21T04:00:00Z');
const current = { observedAt: '2026-10-21T03:45:00Z', temperature: 28, precipitation: null, conditionCode: 3 };
describe('retained weather freshness', () => {
  it('keeps recent model estimates', () => expect(usableCurrentWeather(current, now)).toBe(current));
  it.each(['2026-10-21T01:59:59Z', '2026-10-21T05:00:00Z', 'invalid'])(
    'rejects expired, future or invalid timestamp %s', observedAt => {
      expect(usableCurrentWeather({ ...current, observedAt }, now)).toBeNull();
    });
});
