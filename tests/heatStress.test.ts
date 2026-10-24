import { describe, expect, it } from 'vitest';
import { heatStressLabel } from '@/lib/weather/heatStress';

describe('heat-stress captions', () => {
  it.each([
    [26.9, 'Below caution range'], [27, 'Caution'], [32.9, 'Caution'],
    [33, 'Extreme caution'], [41.9, 'Extreme caution'],
    [42, 'Danger'], [51.9, 'Danger'], [52, 'Extreme danger'],
  ])('describes %s°C as %s', (value, label) => {
    expect(heatStressLabel(value)).toBe(label);
  });

  it.each([null, NaN, Infinity])('does not classify missing or invalid data: %s', value => {
    expect(heatStressLabel(value)).toBeNull();
  });
});
