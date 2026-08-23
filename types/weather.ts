export type AlertType =
  | 'daily_digest'
  | 'thunderstorm'
  | 'heavy_rain'
  | 'extreme_heat';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface WeatherDayData {
  date: string;
  tempMax: number;
  tempMin: number;
  rainChance: number;
  rainMm: number;
  conditionCode: number;
  windMax: number;
  /** Hourly precipitation (mm) across the local day; absent when unavailable. */
  hours?: number[];
}

export interface CurrentWeather {
  observedAt: string;
  temperature: number;
  precipitation: number;
  conditionCode: number;
}

export interface WeatherAlertData {
  days: WeatherDayData[];
}

export interface WeatherAlert {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  validFrom: string;
  validTo: string;
  createdAt: string;
  data?: WeatherAlertData | null;
}

export interface WeatherAlertHistoryResponse {
  items: WeatherAlert[];
  total: number;
  offset: number;
  limit: number;
}
