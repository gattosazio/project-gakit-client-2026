export interface ScenarioFrame {
  hour_index: number;
  raw_time: string;
  display_time: string;
  hourly_rain_mm: number;
  cum_rain_mm: number;
  inundated_km2: number;
  q_peak_m3s: number;
  narrative: string;
  raster_uri: string;
}

export interface ScenarioData {
  storm_id: string;
  source: string;
  source_label: string;
  event_name: string;
  category: string;
  dates: string;
  total_rainfall_mm: number;
  official_total_mm: number;
  is_calibrated: boolean;
  description: string;
  total_frames: number;
  bounds: [[number, number], [number, number], [number, number], [number, number]];
  frames: ScenarioFrame[];
}

export interface ScenarioPreset {
  id: string;
  name: string;
  type: 'historical' | 'design_storm';
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
    id: 'sendong',
    name: 'Tropical Storm Sendong (Washi, 2011)',
    type: 'historical',
    badge: '161.1 mm',
    totalRain: '161.1 mm',
    dates: 'December 16–17, 2011',
    timeWindow: '00:00 – 24:00 PHT',
    peakTime: '03:00 AM',
    description: 'Catastrophic nighttime flash flood down Mandulog River corridor submerging Hinaplanon and Bayug Island.',
    dataFile: '/data/scenarios/sendong.json',
  },
  {
    id: 'basyang',
    name: 'Tropical Storm Basyang (Penha, 2026)',
    type: 'historical',
    badge: '144.5 mm',
    totalRain: '144.5 mm',
    dates: 'February 5–6, 2026',
    timeWindow: '00:00 – 24:00 PHT',
    peakTime: '07:00 PM',
    description: 'Relentless 17-hour downpour and debris-choked bridges causing catastrophic waist-deep flooding in Brgy. Mahayahay and Tubod.',
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
    peakTime: '06:00 PM',
    description: 'Category 5 Super Typhoon whose southern convective rainbands triggered river swelling and coastal inundation.',
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
    description: 'Official UP NOAH 100-year extreme design storm benchmark modeled on FLO-2D with UP DREAM LiDAR and PAGASA RIDF data.',
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
    description: 'Official UP NOAH 25-year severe storm benchmark modeled on FLO-2D with UP DREAM LiDAR and PAGASA RIDF data.',
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
    description: 'Official UP NOAH 5-year monsoon benchmark modeled on FLO-2D with UP DREAM LiDAR and PAGASA RIDF data.',
    dataFile: '/data/scenarios/5yr.json',
  },
];
