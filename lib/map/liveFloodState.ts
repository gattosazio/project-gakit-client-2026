import type { ScenarioData, ScenarioFrame } from '@/types/scenario';
import type { LiveFrame, LiveSelection, LiveTimeline } from '@/types/liveFlood';

export function selectedLiveFrame(timeline: LiveTimeline | null, selection: LiveSelection): LiveFrame | undefined {
  if (!timeline) return undefined;
  if (selection.kind === 'latest') return timeline.frames.find(f => f.kind === 'latest');
  if (selection.kind === 'forecast') return timeline.frames.find(f => f.kind === 'forecast' && f.horizon_hours === selection.horizon);
  return timeline.frames.find(f => f.kind !== 'forecast' && f.valid_at === selection.validAt)
    ?? timeline.frames.filter(f => f.kind !== 'forecast').reduce<LiveFrame | undefined>((best, f) =>
      !best || Math.abs(Date.parse(f.valid_at) - Date.parse(selection.validAt)) < Math.abs(Date.parse(best.valid_at) - Date.parse(selection.validAt)) ? f : best, undefined);
}

export function selectionForFrame(frame: LiveFrame): LiveSelection {
  return frame.kind === 'forecast' ? { kind: 'forecast', horizon: frame.horizon_hours }
    : { kind: 'replay', validAt: frame.valid_at };
}

export function liveStatus(timeline: LiveTimeline | null, frame?: LiveFrame): string {
  if (!timeline) return 'Live estimates unavailable';
  if (!frame) return 'Selected estimate unavailable';
  if (frame.reason === 'preparing_raster') return 'Preparing flood estimate';
  if (frame.kind === 'forecast' && Date.parse(frame.valid_at) <= Date.now()) return 'Forecast update delayed';
  if (frame.availability === 'incomplete') return `Rainfall history incomplete (${frame.valid_hours}/24 hours)`;
  if (frame.availability === 'outside_coverage') return 'Rainfall outside available coverage';
  if (frame.availability !== 'ready') return 'Estimate unavailable';
  if (frame.kind !== 'replay' && (timeline.freshness !== 'fresh' || Date.parse(timeline.expires_at) <= Date.now())) return 'Rainfall update delayed';
  return frame.kind === 'forecast' ? 'Estimated inundation · forecast rainfall' : 'Estimated inundation · observed rainfall';
}

export function formatFloodMetric(value: number | null | undefined, digits: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export function liveModelNotice(frame?: LiveFrame): string {
  if (frame?.report_update_count) return 'Experimental local observation update. It does not forecast water movement.';
  if (frame?.availability === 'ready') {
    if (frame.dry_output_assumption === 'no_existing_floodwater' || frame.rainfall_support === 'dry_anchor') {
      return 'The model assumes no existing floodwater for this dry output. Drainage and recession are unvalidated.';
    }
    if (frame.rainfall_support === 'below_wet_training') {
      return 'Rainfall is below the wet training cases (110.4–179.4 mm/24h). Flood depth and timing are unvalidated.';
    }
    if (frame.rainfall_support === 'above_wet_training') {
      return 'Rainfall exceeds the wet training cases (110.4–179.4 mm/24h). Flood depth and timing are unvalidated.';
    }
  }
  return 'Spatial estimates trained on NOAH hazard classes. Flood arrival, recession and exact depths are unvalidated.';
}

export function scenarioFrame(frame: LiveFrame, index: number): ScenarioFrame {
  return {
    hour_index: index, raw_time: frame.valid_at,
    display_time: new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(frame.valid_at)),
    hourly_rain_mm: frame.hourly_rain_mm, cum_rain_mm: frame.rainfall_24h_mm,
    inundated_km2: frame.inundated_km2, max_depth_m: frame.max_depth_m,
    narrative: frame.availability === 'ready' ? 'Estimated inundation' : `Unavailable (${frame.valid_hours}/24 rainfall hours)`,
    raster_uri: frame.raster_url ?? '', is_forecast: frame.kind === 'forecast',
    forecast_source: frame.forecast_source ?? undefined, forecast_horizon_hours: frame.horizon_hours,
    live: frame,
  };
}

export function liveScenario(timeline: LiveTimeline): ScenarioData {
  const latest = timeline.frames.find(f => f.kind === 'latest');
  return {
    storm_id: 'live', source: 'rainfall_surrogate', source_label: 'Rainfall-based estimate',
    event_name: 'Live inundation estimates', category: 'live', dates: timeline.observed_at ?? '',
    total_rainfall_mm: latest?.rainfall_24h_mm ?? null, official_total_mm: null,
    is_calibrated: false, description: 'Estimated inundation based on rainfall.',
    total_frames: timeline.frames.length, bounds: timeline.bounds,
    frames: timeline.frames.map(scenarioFrame), timeline_id: timeline.snapshot_id, is_live: true,
    live: timeline,
  };
}
