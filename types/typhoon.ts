export type TyphoonCategory =
  | 'STY'
  | 'TY'
  | 'STS'
  | 'TS'
  | 'TD'
  | 'LPA'
  | string;

export interface TyphoonProperties {
  typhoon_name?: string;
  international_name?: string;
  local_name?: string;
  agency?: string;
  typhoon_type?: TyphoonCategory | string;
  status?: string;
  latitude: number;
  longitude: number;
  datetime?: string;
  date?: string;
  time?: string;
  windspeed?: number;
  radius?: number;
  pressure?: number;
  is_inside_par?: boolean;
  isInsidePar?: boolean;
  is_forecast?: boolean;
  is_current?: boolean;
  is_historical?: boolean;
  show_date_callout?: boolean;
  is_endpoint?: boolean;
}

export interface ActiveStormSummary {
  name: string;
  localName?: string;
  internationalName?: string;
  category?: string;
  isInsidePar?: boolean;
  latestPosition?: {
    lng: number;
    lat: number;
    windspeed?: number;
    pressure?: number;
    datetime?: string;
    isInsidePar?: boolean;
  };
}

export interface HistoricalStormSummary {
  id: string;
  name: string;
  cycloneName: string;
  category: string;
  startDate?: string | null;
  endDate?: string | null;
  pointCount: number;
  lastSeen?: string | null;
}

export interface TyphoonApiResponse {
  track: any; // Raw GeoJSON FeatureCollection from official feed
  par: any;
  hasActiveTyphoon: boolean;
  isHistorical?: boolean;
  stormName: string | null;
  stormCategory: string | null;
  activeStorms?: ActiveStormSummary[];
  latestPosition?: {
    lng: number;
    lat: number;
    windspeed?: number;
    pressure?: number;
    category?: string;
    datetime?: string;
    isInsidePar?: boolean;
  } | null;
  fetchedAt?: string | null;
  source?: string;
}
