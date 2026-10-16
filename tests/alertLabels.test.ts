import { describe, expect, it } from 'vitest';
import { ALERT_ICONS, ALERT_TYPE_LABELS } from '@/lib/weather/alertLabels';
import type { AlertType } from '@/types/weather';

// These maps used to be copy-pasted across WeatherAlertModal, NotificationBell,
// and StatusStrip. The test pins every AlertType so a new alert kind can't ship
// with a missing label or icon on one surface.
const ALL_ALERT_TYPES: AlertType[] = [
  'thunderstorm',
  'heavy_rain',
  'extreme_heat',
  'daily_digest',
];

describe('alertLabels', () => {
  it('labels every alert type', () => {
    for (const type of ALL_ALERT_TYPES) {
      expect(ALERT_TYPE_LABELS[type], `label for ${type}`).toBeTruthy();
    }
  });

  it('icons every alert type', () => {
    for (const type of ALL_ALERT_TYPES) {
      expect(ALERT_ICONS[type], `icon for ${type}`).toBeTruthy();
    }
  });

  it('preserves the labels the UI already shows', () => {
    expect(ALERT_TYPE_LABELS).toMatchObject({
      thunderstorm: 'Thunderstorm',
      heavy_rain: 'Heavy Rain',
      extreme_heat: 'Heat Advisory',
      daily_digest: 'Daily Forecast',
    });
  });
});
