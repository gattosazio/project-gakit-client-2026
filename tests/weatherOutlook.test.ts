import { expect, it } from 'vitest';
import { manilaDayKey, outlookDayLabel, outlookDays, outlookScene, weatherTime } from '@/lib/weather/outlook';
import type { WeatherDayData } from '@/types/weather';

const day = (date: string): WeatherDayData => ({ date, tempMax: 30, tempMin: 24, rainChance: 40, rainMm: 1, conditionCode: 3, windMax: 10 });

it('uses the Manila calendar date at UTC midnight boundaries', () => {
  const now = Date.parse('2026-10-16T16:05:00Z');
  expect(manilaDayKey(now)).toBe('2026-10-17');
  expect(outlookDayLabel('2026-10-17', now)).toBe('Today');
  expect(outlookDayLabel('2026-10-18', now)).toBe('Sun');
});

it('drops yesterday, sorts upcoming days, deduplicates dates, and limits the strip to five days', () => {
  const result = outlookDays(['2026-10-19', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-18', '2026-10-20', '2026-10-21', '2026-10-22'].map(day), Date.parse('2026-10-17T01:00:00Z'));
  expect(result.map(value => value.date)).toEqual(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21']);
});

it('does not relabel a future forecast as today or retain a past-only digest', () => {
  const now = Date.parse('2026-10-17T01:00:00Z');
  expect(outlookDays([day('2026-10-16')], now)).toEqual([]);
  expect(outlookDayLabel('2026-10-18', now)).not.toBe('Today');
});

it('formats update times in Philippine time and handles an invalid timestamp', () => {
  expect(weatherTime('2026-10-16T16:05:00Z')).toMatch(/12:05\s*AM/i);
  expect(weatherTime('invalid')).toBe('Time unavailable');
});

it('uses Manila night for today and daylight for another daily forecast', () => {
  const now = Date.parse('2026-10-17T13:00:00Z');
  expect(outlookScene(day('2026-10-17'), now)).toMatchObject({ isDay: false, dark: true });
  expect(outlookScene(day('2026-10-18'), now)).toMatchObject({ isDay: true, dark: false });
  expect(outlookScene(day('2026-10-17'), Date.parse('2026-10-17T01:00:00Z'))).toMatchObject({ isDay: true, dark: false });
});

it('uses a dark thunderstorm scene during daytime without changing daylight status', () => {
  expect(outlookScene({ ...day('2026-10-17'), conditionCode: 95 }, Date.parse('2026-10-17T01:00:00Z'))).toMatchObject({ isDay: true, dark: true });
});
