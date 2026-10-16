import { expect, it } from 'vitest';
import type { WeatherDayData } from '@/types/weather';
import { hourlyRainSeries, outlookHour, rainChartMaximum, rainIntervalLabel } from '@/lib/weather/hourlyOutlook';

const day = (values: Partial<WeatherDayData> = {}): WeatherDayData => ({ date: '2026-10-17', tempMax: 30, tempMin: 24, rainChance: 50, rainMm: 2, conditionCode: 61, windMax: 10, ...values });

it('keeps rain chance and rainfall amounts separate', () => {
  const forecast = day({ hourlyProbabilities: Array(24).fill(80), hours: Array(24).fill(0.2) });
  expect(hourlyRainSeries(forecast, 'chance')?.[12]).toBe(80);
  expect(hourlyRainSeries(forecast, 'amount')?.[12]).toBe(0.2);
  expect(rainChartMaximum([80], 'chance')).toBe(100);
  expect(rainChartMaximum([0.2], 'amount')).toBe(0.2);
});

it('preserves a completely dry day instead of treating it as unavailable', () => {
  expect(hourlyRainSeries(day({ hours: Array(24).fill(0) }), 'amount')).toEqual(Array(24).fill(0));
  expect(rainChartMaximum(Array(24).fill(0), 'amount')).toBe(1);
});

it('does not fabricate data for missing hours or invalid values', () => {
  expect(hourlyRainSeries(day(), 'chance')).toBeNull();
  expect(hourlyRainSeries(day({ hours: [1, 2] }), 'amount')).toBeNull();
  expect(hourlyRainSeries(day({ hourlyProbabilities: Array(24).fill(101) }), 'chance')).toBeNull();
  const values = Array(24).fill(1);
  values[3] = NaN;
  values[5] = -1;
  const result = hourlyRainSeries(day({ hours: values }), 'amount');
  expect(result?.[3]).toBeNull();
  expect(result?.[5]).toBeNull();
  expect(result?.[6]).toBe(1);
});

it('uses a bounded positive amount scale that contains the largest value', () => {
  expect(rainChartMaximum([12.7, null, 0], 'amount')).toBe(15);
  expect(rainChartMaximum([2.2], 'amount')).toBe(3);
});

it('labels midnight and noon correctly', () => {
  expect(outlookHour(0)).toBe('12 AM');
  expect(outlookHour(12)).toBe('12 PM');
  expect(outlookHour(23)).toBe('11 PM');
});

it('labels source values as the preceding hour, including the midnight boundary', () => {
  expect(rainIntervalLabel(12)).toBe('11 AM–12 PM');
  expect(rainIntervalLabel(0)).toBe('11 PM–12 AM (starts previous day)');
  expect(rainIntervalLabel(23)).toBe('10 PM–11 PM');
});

it('keeps a missing hourly value unknown without dropping valid neighbouring hours', () => {
  const hours = Array(24).fill(0);
  hours[3] = null;
  const values = hourlyRainSeries(day({ hours }), 'amount');
  expect(values?.[2]).toBe(0);
  expect(values?.[3]).toBeNull();
  expect(values?.[4]).toBe(0);
});
