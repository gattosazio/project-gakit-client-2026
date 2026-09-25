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
  type: 'historical' | 'design_storm' | 'pagasa_alert';
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
    id: 'pagasa_yellow',
    name: 'PAGASA Yellow Warning (LPA / Monsoon)',
    type: 'pagasa_alert',
    alertLevel: 'yellow',
    badge: '50–100 mm',
    totalRain: '100.0 mm',
    dates: 'PAGASA Operational Alert',
    timeWindow: '24h Alert Timeline',
    peakTime: '12:00 PM',
    description: 'DOST-PAGASA Yellow Rainfall Advisory (7.5–15 mm/hr, 50–100 mm 24h). Light-to-moderate rain from an active Low Pressure Area causing localized street pooling.',
    dataFile: '/data/scenarios/pagasa_yellow.json',
  },
  {
    id: 'pagasa_orange',
    name: 'PAGASA Orange Warning (Tropical Depression)',
    type: 'pagasa_alert',
    alertLevel: 'orange',
    badge: '100–200 mm',
    totalRain: '160.0 mm',
    dates: 'PAGASA Operational Alert',
    timeWindow: '24h Alert Timeline',
    peakTime: '12:00 PM',
    description: 'DOST-PAGASA Orange Rainfall Advisory (15–30 mm/hr, 100–200 mm 24h). Intense rainbands threatening river swelling and bank overtopping in Mahayahay and Tubod.',
    dataFile: '/data/scenarios/pagasa_orange.json',
  },
  {
    id: 'pagasa_red',
    name: 'PAGASA Red Warning (Torrential Typhoon)',
    type: 'pagasa_alert',
    alertLevel: 'red',
    badge: '>200 mm',
    totalRain: '280.0 mm',
    dates: 'PAGASA Operational Alert',
    timeWindow: '24h Alert Timeline',
    peakTime: '12:00 PM',
    description: 'DOST-PAGASA Red Torrential Advisory (>30 mm/hr, >200 mm 24h). Catastrophic mountain runoff triggering widespread flash flooding down the Mandulog River corridor.',
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
    peakTime: '10:00 PM',
    description: 'The deadliest flash flood in Iligan\'s modern history. A massive nocturnal deluge over the steep Mandulog watershed triggered a violent, debris-choked flood wave that completely submerged Brgy. Hinaplanon, Bayug Island, Santiago, San Roque, Mahayahay, and Tambacan while residents slept.',
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
    description: 'A prolonged, relentless 17-hour monsoon-enhanced downpour. Extreme sediment runoff and debris damming at major bridges forced the Tubod River to overtop its banks, causing widespread waist-deep urban inundation across Brgy. Mahayahay and Tubod.',
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
    description: 'A Category 5 Super Typhoon that severely impacted Northern Mindanao. While the eye passed further north, Odette\'s intense southern convective rainbands delivered torrential downpours that rapidly overwhelmed coastal drainage and swelled primary river arteries.',
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
