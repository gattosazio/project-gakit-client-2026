import { describe, expect, it } from 'vitest';
import { locationSearchAction } from '@/lib/map/locationSearchAction';

describe('location search actions', () => {
  it('pins a global search result instead of automatically opening assessment', () => {
    expect(locationSearchAction({ mode: 'assessment', promptOpen: false, manualMode: false })).toBe('pin');
  });

  it('preserves an explicit assessment picker search', () => {
    expect(locationSearchAction({ mode: 'assessment', promptOpen: true, manualMode: false })).toBe('assessment');
  });

  it('preserves an assessment started through manual location selection', () => {
    expect(locationSearchAction({ mode: 'assessment', promptOpen: false, manualMode: true })).toBe('assessment');
  });

  it.each([
    { promptOpen: true, manualMode: false },
    { promptOpen: false, manualMode: true },
    { promptOpen: false, manualMode: false },
  ])('preserves a pending report action: %j', context => {
    expect(locationSearchAction({ mode: 'report', ...context })).toBe('report');
  });
});
