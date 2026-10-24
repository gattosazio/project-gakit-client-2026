import type { LiveFrame, LiveTimeline } from './liveFlood';

export interface ScenarioFrame {
  hour_index: number;
  raw_time: string;
  display_time: string;
  hourly_rain_mm: number | null;
  cum_rain_mm: number | null;
  inundated_km2: number | null;
  max_depth_m?: number | null;
  live?: LiveFrame;
  q_peak_m3s?: number | null;
  effective_rainfall_mm?: number;
  narrative: string;
  raster_uri: string;
  /** Original numeric raster when a demo canvas composite replaces its visual image. */
  depth_raster_uri?: string;
  /** Live replay only: true for nowcast-derived forecast frames. */
  is_forecast?: boolean;
  forecast_source?: string;
  forecast_horizon_hours?: number;
}

export interface ScenarioData {
  storm_id: string;
  source: string;
  source_label: string;
  event_name: string;
  category: string;
  dates: string;
  total_rainfall_mm: number | null;
  official_total_mm: number | null;
  reference_total_mm?: number | null;
  model_notice?: string;
  scenario_contract?: string;
  live?: LiveTimeline;
  is_calibrated: boolean;
  description: string;
  total_frames: number;
  bounds: [[number, number], [number, number], [number, number], [number, number]];
  frames: ScenarioFrame[];
  /** Live replay only: id of the server-cached timeline build. */
  timeline_id?: string;
  is_live?: boolean;
}

export type ScenarioPresetType = 'live' | 'historical' | 'design_storm' | 'pagasa_alert';

export interface ScenarioPreset {
  id: string;
  name: string;
  type: ScenarioPresetType;
  alertLevel?: 'yellow' | 'orange' | 'red';
  badge: string;
  totalRain: string;
  dates: string;
  timeWindow: string;
  peakTime?: string;
  description: string;
  dataFile: string;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'live',
    name: 'Live inundation estimates',
    type: 'live',
    badge: 'LIVE',
    totalRain: '0.0 mm',
    dates: 'Rolling last 24 hours',
    timeWindow: '24h Replay + Nowcast Tail',
    description:
      'Estimated inundation based on complete 24-hour rainfall windows, with observed rainfall history and available forecast rainfall. Water depth and flood timing require independent validation.',
    dataFile: '',
  },
  {
    id: 'pagasa_yellow',
    name: 'Yellow rainfall example',
    type: 'pagasa_alert',
    alertLevel: 'yellow',
    badge: '50–100 mm',
    totalRain: '100.0 mm',
    dates: 'PAGASA rainfall thresholds',
    timeWindow: '24h Alert Timeline',
    peakTime: '12:00 PM',
    description: 'A hypothetical 100 mm rainfall input with a synthetic hourly pattern. Flood progression is illustrative; this is not an issued PAGASA advisory.',
    dataFile: '/data/scenarios/pagasa_yellow.json',
  },
  {
    id: 'pagasa_orange',
    name: 'Orange rainfall example',
    type: 'pagasa_alert',
    alertLevel: 'orange',
    badge: '100–200 mm',
    totalRain: '160.0 mm',
    dates: 'PAGASA rainfall thresholds',
    timeWindow: '24h Alert Timeline',
    peakTime: '12:00 PM',
    description: 'A hypothetical 160 mm rainfall input with a synthetic hourly pattern. Flood progression is illustrative; this is not an issued PAGASA advisory.',
    dataFile: '/data/scenarios/pagasa_orange.json',
  },
  {
    id: 'pagasa_red',
    name: 'Red rainfall example',
    type: 'pagasa_alert',
    alertLevel: 'red',
    badge: '>200 mm',
    totalRain: '280.0 mm',
    dates: 'PAGASA rainfall thresholds',
    timeWindow: '24h Alert Timeline',
    peakTime: '12:00 PM',
    description: 'A hypothetical 280 mm rainfall input, exceeding the model’s wet training cases. Flood progression is illustrative; this is not an issued PAGASA advisory.',
    dataFile: '/data/scenarios/pagasa_red.json',
  },
  {
    id: 'sendong',
    name: 'Tropical Storm Sendong (Washi, 2011)',
    type: 'historical',
    badge: '161.1 mm',
    totalRain: '161.1 mm',
    dates: 'December 16–17, 2011',
    timeWindow: '00:00 – 24:00 PHT',
    description: 'Illustrative spatial estimates driven by the stored Sendong rainfall sequence. The station adjustment and simulated flood timing have not been independently validated.',
    dataFile: '/data/scenarios/sendong.json',
  },
  {
    id: 'basyang',
    name: 'Tropical Storm Basyang (Penha, 2026)',
    type: 'historical',
    badge: '133.9 mm',
    totalRain: '133.9 mm',
    dates: 'February 5–6, 2026',
    timeWindow: '00:00 – 24:00 PHT',
    description: 'Illustrative spatial estimates driven by 133.9 mm in the bundled Basyang rainfall sequence. Its separate 144.5 mm reference and flood timing are unverified.',
    dataFile: '/data/scenarios/basyang.json',
  },
  {
    id: 'odette',
    name: 'Super Typhoon Odette (Rai, 2021)',
    type: 'historical',
    badge: '95.0 mm',
    totalRain: '95.0 mm',
    dates: 'December 16–17, 2021',
    timeWindow: '00:00 – 24:00 PHT',
    description: 'Illustrative spatial estimates driven by the stored Odette rainfall sequence. The station adjustment and simulated flood timing have not been independently validated.',
    dataFile: '/data/scenarios/odette.json',
  },
  {
    id: '100yr',
    name: '100-Year Catastrophic Flood (UP NOAH)',
    type: 'design_storm',
    badge: '179.4 mm',
    totalRain: '179.4 mm',
    dates: '100-Year Recurrence',
    timeWindow: '24h Design Event',
    description: 'An emulator trained on the NOAH 100-year hazard map, driven by a synthetic rainfall pattern. Hourly timing and exact depths are unvalidated.',
    dataFile: '/data/scenarios/100yr.json',
  },
  {
    id: '25yr',
    name: '25-Year Severe Storm (UP NOAH)',
    type: 'design_storm',
    badge: '148.2 mm',
    totalRain: '148.2 mm',
    dates: '25-Year Recurrence',
    timeWindow: '24h Design Event',
    description: 'An emulator trained on the NOAH 25-year hazard map, driven by a synthetic rainfall pattern. Hourly timing and exact depths are unvalidated.',
    dataFile: '/data/scenarios/25yr.json',
  },
  {
    id: '5yr',
    name: '5-Year Monsoon Storm (UP NOAH)',
    type: 'design_storm',
    badge: '110.4 mm',
    totalRain: '110.4 mm',
    dates: '5-Year Recurrence',
    timeWindow: '24h Design Event',
    description: 'An emulator trained on the NOAH 5-year hazard map, driven by a synthetic rainfall pattern. Hourly timing and exact depths are unvalidated.',
    dataFile: '/data/scenarios/5yr.json',
  },
];
