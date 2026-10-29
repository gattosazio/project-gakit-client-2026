import type { WeatherAlert } from '@/types/weather';
import { rainfallWarningLevel, thunderstormBulletinType } from '@/lib/weather/pagasa';

export function WeatherBulletinBadge({ alert }: { alert: WeatherAlert }) {
  const rainfall = rainfallWarningLevel(alert);
  const thunderstorm = thunderstormBulletinType(alert);
  const label = rainfall === 'yellow' ? 'Yellow' : rainfall === 'orange' ? 'Orange'
    : rainfall === 'red' ? 'Red' : thunderstorm === 'watch' ? 'Watch'
      : thunderstorm === 'advisory' || alert.alertType === 'heavy_rain'
        ? 'Advisory' : alert.severity;
  const colors = rainfall === 'yellow' ? 'border-yellow-200 bg-yellow-100 text-yellow-900'
    : rainfall === 'orange' ? 'border-orange-200 bg-orange-100 text-orange-900'
      : rainfall === 'red' ? 'border-red-200 bg-red-100 text-red-900'
        : thunderstorm === 'watch' ? 'border-blue-200 bg-blue-50 text-blue-800'
          : thunderstorm === 'advisory' ? 'border-amber-200 bg-amber-50 text-amber-900'
            : alert.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-700'
              : alert.severity === 'warning' ? 'border-orange-200 bg-orange-50 text-orange-700'
                : 'border-blue-200 bg-blue-50 text-blue-800';
  return <span className={`inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${colors}`}>{label}</span>;
}
