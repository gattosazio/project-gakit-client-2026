export type AlertType =
  | 'daily_digest'
  | 'thunderstorm'
  | 'heavy_rain'
  | 'extreme_heat';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface WeatherDayData {
  partialDay?: boolean;
  date: string;
  tempMax: number;
  tempMin: number;
  rainChance: number | null;
  rainMm: number;
  conditionCode: number;
  windMax: number;
  /** Hourly precipitation (mm) across the local day; absent when unavailable. */
  hours?: (number | null)[];
  /** Hourly precipitation probability (0-100%) across the local day; absent when unavailable. */
  hourlyProbabilities?: (number | null)[];
}

export interface CurrentWeather {
  source?: string;
  kind?: 'model_estimate';
  location?: { latitude: number; longitude: number; label: string };
  observedAt: string;
  temperature: number;
  precipitation: number | null;
  conditionCode: number;
}

export interface WeatherAlertData {
  coverageLabel?: string;
  regionalAffectedAreas?: string[];
  retrievedAt?: string;
  location?: { latitude: number; longitude: number; label: string; gridLatitude?: number; gridLongitude?: number };
  days?: WeatherDayData[];
  title?: string;
  description?: string;
  source?: string;
  bulletinType?: string;
  bulletinNumber?: number | null;
  issuedAt?: string;
  affectedAreas?: string[];
  rawText?: string;
}

export interface PointWeatherOutlook {
  days: WeatherDayData[];
  current: CurrentWeather | null;
  source: string;
  retrievedAt: string;
  validTo: string;
  location: NonNullable<WeatherAlertData['location']>;
}

export interface WeatherAlert {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
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
