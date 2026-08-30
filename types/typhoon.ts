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
}

export interface ActiveStormSummary {
  name: string;
  localName?: string;
  internationalName?: string;
  category?: string;
  latestPosition?: {
    lng: number;
    lat: number;
    windspeed?: number;
    pressure?: number;
    datetime?: string;
  };
}

export interface TyphoonApiResponse {
  track: any; // Raw GeoJSON FeatureCollection from official feed
  par: any;
  hasActiveTyphoon: boolean;
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
  } | null;
}
