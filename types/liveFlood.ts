import { z } from 'zod';

const numberOrNull = z.number().finite().nonnegative().nullable();
export const liveFrameSchema = z.object({
  frame_id: z.string(), valid_at: z.string().datetime({ offset: true }),
  kind: z.enum(['replay', 'latest', 'forecast']), horizon_hours: z.number().int(),
  window_start_at: z.string(), window_end_at: z.string(), window_hours: z.literal(24),
  valid_hours: z.number().int().min(0).max(24), missing_intervals: z.array(z.string()),
  availability: z.enum(['ready', 'incomplete', 'unavailable', 'outside_coverage']),
  reason: z.string().nullable(), rainfall_24h_mm: numberOrNull, hourly_rain_mm: numberOrNull,
  inundated_km2: numberOrNull, max_depth_m: numberOrNull, raster_url: z.string().nullable(),
  forecast_source: z.string().nullable(), source_issues: z.array(z.string()),
  coverage_fraction: numberOrNull,
  rainfall_support: z.enum(['unknown', 'dry_anchor', 'below_wet_training', 'within_wet_training', 'above_wet_training']).optional(),
  dry_output_assumption: z.literal('no_existing_floodwater').nullable().optional(),
  report_update_count: z.number().int().nonnegative().optional(),
  report_update_method: z.string().nullable().optional(),
  report_analysis_storage_change_m3: z.number().finite().nullable().optional(),
  report_update_expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});
const coordinate = z.tuple([z.number(), z.number()]);
export const liveTimelineSchema = z.object({
  schema_version: z.literal(2), snapshot_id: z.string(),
  created_at: z.string(), evaluated_at: z.string(), expires_at: z.string(),
  observed_at: z.string().nullable(), forecast_anchor_at: z.string(),
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  readiness: z.enum(['ready', 'partial', 'unavailable']),
  build_state: z.enum(['ready', 'building', 'failed']),
  bounds: z.tuple([coordinate, coordinate, coordinate, coordinate]),
  frames: z.array(liveFrameSchema), available_horizons: z.array(z.number()),
  policy_version: z.string(), rendering: z.string(),
  report_observations: z.object({
    captured_at: z.string().datetime({ offset: true }),
    availability: z.enum(['available', 'unavailable', 'not_configured']),
    reason: z.string().nullable(),
    correction_method: z.enum(['observation_only', 'experimental_local_update']),
    observations: z.array(z.object({
      report_id: z.string(), latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180), depth_m: z.number().finite().nonnegative(),
      observed_at: z.string().datetime({ offset: true }), available_at: z.string().datetime({ offset: true }),
      expires_at: z.string().datetime({ offset: true }), depth_method: z.string(),
      depth_uncertainty_m: numberOrNull, location_accuracy_m: numberOrNull,
      source_group: z.string(), fingerprint: z.string(), correction_eligible: z.boolean(), reasons: z.array(z.string()),
    })),
  }).nullable().optional(),
  capabilities: z.object({
    model_kind: z.literal('static_hazard_emulator'), temporal_state: z.literal(false),
    independently_validated: z.literal(false), depth_basis: z.literal('noah_class_proxies'),
    rainfall_forcing: z.literal('single_point_rolling_24h'),
    wet_training_rainfall_mm: z.array(z.number().finite().positive()), dry_training_rainfall_mm: z.literal(0),
    dry_output_threshold_mm: z.number().finite().nonnegative(),
  }).optional(),
});
export type LiveFrame = z.infer<typeof liveFrameSchema>;
export type LiveTimeline = z.infer<typeof liveTimelineSchema>;
export type LiveSelection = { kind: 'latest' } | { kind: 'forecast'; horizon: number } | { kind: 'replay'; validAt: string };
