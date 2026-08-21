export type AlertType =
  | 'daily_digest'
  | 'thunderstorm'
  | 'heavy_rain'
  | 'extreme_heat';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface WeatherAlert {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  validFrom: string;
  validTo: string;
  createdAt: string;
}

export interface WeatherAlertHistoryResponse {
  items: WeatherAlert[];
  total: number;
  offset: number;
  limit: number;
}
