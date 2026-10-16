// Canonical labels and icons for each weather alert type. Previously this map
// was copy-pasted into WeatherAlertModal, NotificationBell, and StatusStrip;
// keeping a single copy guarantees the bell, the modal, and the dashboard all
// name the same advisory the same way.
import { AlertTriangle, CloudRain, Flame, Thermometer, type LucideIcon } from 'lucide-react';
import type { AlertType } from '@/types/weather';

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  thunderstorm: 'Thunderstorm',
  heavy_rain: 'Heavy Rain',
  extreme_heat: 'Heat Advisory',
  daily_digest: 'Daily Forecast',
};

export const ALERT_ICONS: Record<AlertType, LucideIcon> = {
  thunderstorm: AlertTriangle,
  heavy_rain: CloudRain,
  extreme_heat: Flame,
  daily_digest: Thermometer,
};
