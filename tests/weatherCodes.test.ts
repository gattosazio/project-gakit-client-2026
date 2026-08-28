import { describe, expect, it } from 'vitest';
import { alertDescription, alertTitle, digestPeriod, digestSubtitle, digestTitle, formatDayForecast } from '@/lib/weather/weatherCodes';
import type { WeatherAlert, WeatherDayData } from '@/types/weather';

process.env.TZ = 'Asia/Manila';

function manilaDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function day(partial: Partial<WeatherDayData>): WeatherDayData {
  return {
    date: '2026-08-29',
    tempMax: 30,
    tempMin: 24,
    rainChance: 0,
    rainMm: 0,
    conditionCode: 0,
    windMax: 10,
    ...partial,
  };
}

describe('formatDayForecast', () => {
  it('shows the chance for non-precipitation days', () => {
    expect(formatDayForecast(day({ conditionCode: 3, rainChance: 30 }))).toBe(
      'Overcast · 30% chance of rain'
    );
  });

  it('shows "No rain expected" at 0%', () => {
    expect(formatDayForecast(day({ conditionCode: 0, rainChance: 0 }))).toBe(
      'Clear · No rain expected'
    );
  });

  it('uses the natural phrasing for precipitation days with mm', () => {
    expect(
      formatDayForecast(day({ conditionCode: 53, rainChance: 60, rainMm: 1.2 }))
    ).toBe('60% chance of drizzle (1.2mm)');
  });

  it('omits the mm suffix when zero for precipitation days', () => {
    expect(formatDayForecast(day({ conditionCode: 61, rainChance: 20, rainMm: 0 }))).toBe(
      '20% chance of light rain'
    );
  });
});

function makeDay(overrides: Partial<WeatherDayData> = {}): WeatherDayData {
  return {
    date: manilaDate(0),
    tempMax: 30,
    tempMin: 24,
    rainChance: 30,
    rainMm: 0,
    conditionCode: 3,
    windMax: 10,
    ...overrides,
  };
}

function makeAlert(days: WeatherDayData[]): WeatherAlert {
  return {
    id: 'test',
    alertType: 'daily_digest',
    severity: 'info',
    validFrom: '',
    validTo: '',
    createdAt: '',
    data: { days },
  } as WeatherAlert;
}

describe('digestTitle', () => {
  it('returns a stable outlook label', () => {
    expect(digestTitle({ alertType: 'daily_digest', data: null } as WeatherAlert)).toBe(
      'Weather Outlook'
    );
    const alert = makeAlert([makeDay({ date: manilaDate(0) }), makeDay({ date: manilaDate(1) })]);
    expect(digestTitle(alert)).toBe('Weather Outlook');
  });
});

describe('digestPeriod', () => {
  it('joins the first and last day with "to"', () => {
    const alert = makeAlert([makeDay({ date: manilaDate(0) }), makeDay({ date: manilaDate(1) })]);
    expect(digestPeriod(alert)).toBe('Today to Tomorrow');
  });

  it('returns an empty string when there are no days', () => {
    expect(digestPeriod({ alertType: 'daily_digest', data: null } as WeatherAlert)).toBe('');
  });
});

describe('digestSubtitle', () => {
  it('returns the first day forecast', () => {
    const alert = makeAlert([makeDay({ conditionCode: 3, rainChance: 30 })]);
    expect(digestSubtitle(alert)).toBe('Overcast · 30% chance of rain');
  });

  it('returns an empty string when there are no days', () => {
    expect(digestSubtitle({ alertType: 'daily_digest', data: null } as WeatherAlert)).toBe('');
  });
});

describe('alertTitle', () => {
  it('returns Weather Outlook for a daily digest', () => {
    expect(alertTitle(makeAlert([makeDay({ conditionCode: 3, rainChance: 30 })]))).toBe('Weather Outlook');
  });

  it('returns the data title for a severe alert', () => {
    const alert = { alertType: 'thunderstorm', data: { title: 'Storm Advisory', description: 'Take care' } } as WeatherAlert;
    expect(alertTitle(alert)).toBe('Storm Advisory');
  });

  it('returns an empty string when there is no data title', () => {
    expect(alertTitle({ alertType: 'thunderstorm', data: null } as WeatherAlert)).toBe('');
  });
});

describe('alertDescription', () => {
  it('returns the first day forecast for a daily digest', () => {
    expect(alertDescription(makeAlert([makeDay({ conditionCode: 3, rainChance: 30 })]))).toBe('Overcast · 30% chance of rain');
  });

  it('returns the data description for a severe alert', () => {
    const alert = { alertType: 'thunderstorm', data: { title: 'Storm Advisory', description: 'Take care' } } as WeatherAlert;
    expect(alertDescription(alert)).toBe('Take care');
  });

  it('returns an empty string when there is no data description', () => {
    expect(alertDescription({ alertType: 'daily_digest', data: null } as WeatherAlert)).toBe('');
  });
});
