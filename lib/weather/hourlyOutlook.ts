import type { WeatherDayData } from '@/types/weather';

export type RainChartMode = 'chance' | 'amount';

/** Missing/invalid samples stay missing; they must never become zero rain. */
export function hourlyRainSeries(day: Pick<WeatherDayData, 'hours' | 'hourlyProbabilities'>, mode: RainChartMode): (number | null)[] | null {
  const values = mode === 'chance' ? day.hourlyProbabilities : day.hours;
  if (!Array.isArray(values) || values.length !== 24) return null;
  const result = values.map(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && (mode === 'amount' || value <= 100) ? value : null);
  return result.some(value => value !== null) ? result : null;
}

export function rainChartMaximum(values: (number | null)[], mode: RainChartMode): number {
  if (mode === 'chance') return 100;
  const maximum = Math.max(0, ...values.map(value => value ?? 0));
  if (!maximum) return 1;
  if (maximum <= 1) return Math.ceil(maximum * 10) / 10;
  return maximum <= 5 ? Math.ceil(maximum) : Math.ceil(maximum / 5) * 5;
}

export function outlookHour(hour: number): string {
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Open-Meteo stamps rain at the end of the preceding hour. */
export function rainIntervalLabel(endHour: number): string {
  return `${outlookHour((endHour + 23) % 24)}–${outlookHour(endHour)}${endHour === 0 ? ' (starts previous day)' : ''}`;
}

/** Prefer a real probability; deterministic models show amounts instead. */
export function dailyRainMetric(day: Pick<WeatherDayData, 'rainChance' | 'rainMm' | 'partialDay'>) {
  const hasChance = typeof day.rainChance === 'number' && Number.isFinite(day.rainChance) && day.rainChance >= 0 && day.rainChance <= 100;
  return hasChance
    ? { label: 'Peak hourly rain chance', shortLabel: 'peak chance', value: `${Math.round(day.rainChance!)}%` }
    : { label: day.partialDay ? 'Remaining rainfall' : 'Forecast rainfall', shortLabel: 'rainfall', value: typeof day.rainMm === 'number' && Number.isFinite(day.rainMm) && day.rainMm >= 0 ? `${day.rainMm.toFixed(1)} mm` : 'Unavailable' };
}
