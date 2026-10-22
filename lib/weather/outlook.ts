import type { WeatherDayData } from '@/types/weather';
import { isDaytimeInManila } from './weatherCodes';

export function manilaDayKey(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function outlookDays(days: WeatherDayData[], now: number): WeatherDayData[] {
  const today = manilaDayKey(now);
  const unique = new Map<string, WeatherDayData>();
  for (const day of days) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day.date) && day.date >= today && !unique.has(day.date)) unique.set(day.date, day);
  }
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
}

export function outlookDayLabel(date: string, now: number): string {
  if (date === manilaDayKey(now)) return 'Today';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'short' }).format(new Date(`${date}T12:00:00+08:00`));
}

export function weatherTime(timestamp: string): string {
  if (!Number.isFinite(Date.parse(timestamp))) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}

/** Today's scene follows Manila time; other dates use a daytime daily summary. */
export function outlookScene(day: WeatherDayData, now: number) {
  const timestamp = day.date === manilaDayKey(now)
    ? new Date(now).toISOString()
    : `${day.date}T12:00:00+08:00`;
  const isDay = isDaytimeInManila(timestamp);
  return { timestamp, isDay, dark: !isDay || (day.conditionCode >= 95 && day.conditionCode <= 99) };
}
