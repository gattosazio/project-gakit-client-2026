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
  description: string;
  dataFile?: string;
  noahScenarioKey?: string;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'sendong',
    name: 'Tropical Storm Sendong (Washi, 2011)',
    type: 'historical',
    badge: '181.1 mm (Extreme)',
    totalRain: '181.1 mm',
    description: 'Catastrophic nighttime flash flood along Mandulog River basin causing catastrophic debris surge.',
    dataFile: '/data/scenarios/sendong.json',
  },
  {
    id: '100yr',
    name: '100-Year Catastrophic Flood (DOST-NOAH)',
    type: 'design_storm',
    badge: '179.4 mm (100-Yr)',
    totalRain: '179.4 mm',
    description: 'Official PAGASA Lumbia RIDF 100-year extreme design storm benchmark calibrated on FLO-2D.',
    noahScenarioKey: 'noah_100yr',
  },
  {
    id: '25yr',
    name: '25-Year Severe Storm (DOST-NOAH)',
    type: 'design_storm',
    badge: '148.2 mm (25-Yr)',
    totalRain: '148.2 mm',
    description: 'Official PAGASA Lumbia RIDF 25-year severe storm benchmark calibrated on FLO-2D.',
    noahScenarioKey: 'noah_25yr',
  },
  {
    id: '5yr',
    name: '5-Year Monsoon Storm (DOST-NOAH)',
    type: 'design_storm',
    badge: '110.4 mm (5-Yr)',
    totalRain: '110.4 mm',
    description: 'Official PAGASA Lumbia RIDF 5-year monsoon benchmark calibrated on FLO-2D.',
    noahScenarioKey: 'noah_5yr',
  },
];
