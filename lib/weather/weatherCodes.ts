import type { WeatherAlert, WeatherDayData } from '@/types/weather';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudMoonRain,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Cloudy,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';

interface WeatherCondition {
  label: string;
  icon: LucideIcon;
}

const CONDITIONS: Record<number, WeatherCondition> = {
  0: { label: 'Clear', icon: Sun },
  1: { label: 'Mainly clear', icon: CloudSun },
  2: { label: 'Partly cloudy', icon: CloudSun },
  3: { label: 'Overcast', icon: Cloudy },
  45: { label: 'Foggy', icon: CloudFog },
  48: { label: 'Freezing fog', icon: CloudFog },
  51: { label: 'Light drizzle', icon: CloudDrizzle },
  53: { label: 'Drizzle', icon: CloudDrizzle },
  55: { label: 'Heavy drizzle', icon: CloudDrizzle },
  56: { label: 'Freezing drizzle', icon: CloudDrizzle },
  57: { label: 'Freezing drizzle', icon: CloudDrizzle },
  61: { label: 'Light rain', icon: CloudRain },
  63: { label: 'Rain', icon: CloudRain },
  65: { label: 'Heavy rain', icon: CloudRain },
  66: { label: 'Freezing rain', icon: CloudRain },
  67: { label: 'Freezing rain', icon: CloudRain },
  71: { label: 'Light snow', icon: CloudSnow },
  73: { label: 'Snow', icon: CloudSnow },
  75: { label: 'Heavy snow', icon: CloudSnow },
  77: { label: 'Snow grains', icon: CloudSnow },
  80: { label: 'Light showers', icon: CloudSunRain },
  81: { label: 'Showers', icon: CloudSunRain },
  82: { label: 'Heavy showers', icon: CloudSunRain },
  85: { label: 'Snow showers', icon: CloudSnow },
  86: { label: 'Snow showers', icon: CloudSnow },
  95: { label: 'Thunderstorm', icon: CloudLightning },
  96: { label: 'Thunderstorm, hail', icon: CloudLightning },
  99: { label: 'Thunderstorm, hail', icon: CloudLightning },
};

const FALLBACK: WeatherCondition = { label: 'Cloudy', icon: Cloud };

/**
 * Night variants for clear/partly-cloudy codes (WMO 0/1/2). Iligan sits near
 * the equator, so daylight is ~06:00–18:00 year-round; the client derives
 * day/night from the observation timestamp rather than relying on a server flag.
 */
const NIGHT_ICONS: Partial<Record<number, LucideIcon>> = {
  0: Moon,
  1: CloudMoon,
  2: CloudMoon,
  80: CloudMoonRain,
  81: CloudMoonRain,
  82: CloudMoonRain,
};

export function isDaytimeInManila(iso: string): boolean {
  // The server sends Asia/Manila wall-clock time without a tz suffix
  // (Open-Meteo is queried with `timezone=Asia/Manila`), so pin it to PHT
  // before deriving the hour — otherwise a naive "01:00" is read as UTC and
  // shifted +8h, wrongly reporting daytime. A value that already carries a
  // timezone (Z / ±offset) is used as-is.
  const pinned = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}+08:00`;
  const date = new Date(pinned);
  if (Number.isNaN(date.getTime())) return true;
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .find((part) => part.type === 'hour')?.value ?? '12'
  ) % 24;
  return hour >= 6 && hour < 18;
}

export function getWeatherCondition(code: number, isDay = true): WeatherCondition {
  const condition = CONDITIONS[code] ?? FALLBACK;
  if (!isDay && NIGHT_ICONS[code]) {
    return { ...condition, icon: NIGHT_ICONS[code] };
  }
  return condition;
}

/**
 * Human-readable forecast line for a day, decoupled from the condition icon so
 * the rain likelihood is always shown — even on "dry" days (e.g. Overcast with
 * a 30% chance) and at 0% ("No rain expected"). Precipitation days keep the
 * natural "X% chance of light drizzle (1.2mm)" phrasing.
 */
export function formatDayForecast(day: WeatherDayData): string {
  const condition = getWeatherCondition(day.conditionCode);
  const isPrecip = day.conditionCode >= 51;

  if (isPrecip) {
    const mm = day.rainMm > 0 ? ` (${day.rainMm.toFixed(1)}mm)` : '';
    return `${day.rainChance}% chance of ${condition.label.toLowerCase()}${mm}`;
  }
  if (day.rainChance <= 0) return `${condition.label} · No rain expected`;
  return `${condition.label} · ${day.rainChance}% chance of rain`;
}

function startOfDayLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function friendlyDayLabel(iso: string): string {
  const target = new Date(iso);
  const dayDiff = Math.round((startOfDayLocal(target) - startOfDayLocal(new Date())) / 86_400_000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  return target.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function digestTitle(alert: WeatherAlert): string {
  return 'Weather Outlook';
}

export function digestPeriod(alert: WeatherAlert): string {
  const days = alert.data?.days;
  if (days && days.length > 1) {
    const fmt = (date: string) => friendlyDayLabel(`${date}T00:00:00+08:00`);
    return `${fmt(days[0].date)} to ${fmt(days[days.length - 1].date)}`;
  }
  if (days && days.length === 1) {
    return friendlyDayLabel(`${days[0].date}T00:00:00+08:00`);
  }
  return '';
}

export function digestSubtitle(alert: WeatherAlert): string {
  const day = alert.data?.days?.[0];
  return day ? formatDayForecast(day) : '';
}

export function alertTitle(alert: WeatherAlert): string {
  if (alert.alertType === 'daily_digest') return digestTitle(alert);
  return alert.data?.title ?? '';
}

export function alertDescription(alert: WeatherAlert): string {
  if (alert.alertType === 'daily_digest') return digestSubtitle(alert);
  return alert.data?.description ?? '';
}
