import type { FloodDepthCode, FloodReference, Report, ReportStatus } from '@/types/report';

/** Explain the saved decision basis, independently of the observation count. */
export function getReportAssessmentBasis(report: Pick<Report, 'status' | 'decisionSource' | 'validationSummary' | 'validationFlags'>) {
  const summary = report.validationSummary;
  const flags = new Set([...(report.validationFlags ?? []), ...(summary?.conflicts ?? []), ...(summary?.context ?? [])]);
  const result = (label: string, title = label) => ({ label, title, score: undefined });
  if (report.decisionSource === 'manual') return result(report.status === 'VERIFIED' ? 'Staff confirmation' : 'Staff decision', summary?.staffDecision?.label ?? 'Saved staff decision; automatic evidence is shown separately');
  if (summary?.demoAutoValidated) return result('Demo approval', 'Evidence checks were skipped');
  if (report.status === 'ANOMALY') return result('Evidence conflict', 'Saved conflict awaiting staff review');
  if (report.status === 'VERIFIED') {
    if (summary?.decisionBasis === 'physical_support') return result('Physical support', 'Weather and location support operational acceptance; this is not independent confirmation');
    if (summary?.decisionBasis === 'original_observations') return result('Independent observations', `${summary.corroboratingSourceCount ?? 0} eligible original observation sources; reported depth is not independently verified`);
    return result('Previous assessment', 'Saved operational acceptance; its evidence basis is not recorded');
  }
  if (flags.has('USER_BLACKLISTED')) return result('Abuse policy', 'Acceptance blocked by the reporter policy');
  if (flags.has('CURRENT_CONDITIONS_UNSUPPORTED')) return result('No qualifying support', 'Saved checks did not meet the operational support policy; this does not prove flooding impossible');
  if (summary?.checkState === 'checks_incomplete') return result('Checks unavailable', 'Required evidence checks could not be completed');
  if (flags.has('DEPTH_CATEGORY_MISMATCH') || (summary?.conflicts?.length ?? 0) > 0) return result('Evidence conflict');
  if (report.status === 'REJECTED') return result('Previous assessment', 'Saved rejection; consult its saved reason and decision history');
  if (summary) return result('Insufficient evidence', 'The saved evidence does not establish an acceptance path');
  return result('Awaiting assessment');
}

export const DEPTH_LABELS: Record<FloodDepthCode, string> = {
  ankle: 'Ankle Deep',
  knee: 'Knee Deep',
  waist: 'Waist Deep',
  shoulder: 'Shoulder Deep',
  head: 'Head Deep',
  overhead: 'Overhead',
};

/**
 * Water-level color scale shared by the dashboard, report cards, and any
 * depth-related surface. Waist-up leans warm; head-plus is red/maroon.
 */
export const DEPTH_BAR_COLOR: Record<FloodDepthCode, string> = {
  ankle: '#10B981',
  knee: '#84CC16',
  waist: '#F5B301',
  shoulder: '#F97316',
  head: '#EF4444',
  overhead: '#7A0019',
};

export const REFERENCE_LABELS: Record<FloodReference, string> = {
  adult: 'Adult',
  motorcycle: 'Motorcycle',
  sedan: 'Sedan',
  suv: 'SUV',
  jeepney: 'Jeepney',
  bus: 'Minibus',
};

export interface StatusMeta {
  label: string;
  badgeClass: string;
  color: string;
}

/**
 * Decision colors describe report acceptance, not flood depth or location safety.
 * Blue/cyan belong to flood layers; labels and icons distinguish status from severity.
 */
export const STATUS_META: Record<ReportStatus, StatusMeta> = {
  UNVERIFIED: {
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    color: '#B45309',
  },
  VERIFIED: {
    label: 'Validated',
    badgeClass: 'bg-green-50 text-green-800 border-green-200',
    color: '#15803D',
  },
  ANOMALY: {
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    color: '#B45309',
  },
  REJECTED: {
    label: 'Rejected',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    color: '#64748B',
  },
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Epoch-agnostic relative age label ("just now", "5m ago", "3h ago", "2d ago").
 * Shared by dashboards, report management, and the map's barangay annotations.
 */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < 60_000) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatReportDepth(
  depth: { code: FloodDepthCode; label?: string; approximateCm?: number } | FloodDepthCode,
  depthCm?: number | null
): string {
  const code = typeof depth === 'string' ? depth : depth.code;
  const label = DEPTH_LABELS[code] || code;
  const approx = typeof depth === 'object' ? depth.approximateCm : undefined;
  const cm = depthCm ?? approx;

  if (cm != null) {
    return code === 'overhead' ? `${label} (${cm}+ cm)` : `${label} (${cm} cm)`;
  }
  return label;
}

export interface ValidationFlagMeta {
  label: string;
  category: 'Consensus' | 'Simulation' | 'Weather' | 'Terrain' | 'Reporter' | 'Evidence' | 'General';
  description: string;
  type: 'success' | 'warning' | 'info' | 'danger';
}

export const VALIDATION_FLAG_LABELS: Record<string, ValidationFlagMeta> = {
  WARNING_ARCHIVE_UNAVAILABLE: {
    label: 'PAGASA record incomplete', category: 'Weather', type: 'info',
    description: 'No reliable record covers when flooding was observed. This cannot be treated as no warning.',
  },
  SHALLOW_MODELED_WATER: {
    label: 'Model Shows Shallow Water', category: 'Simulation', type: 'info',
    description: 'The uncorrected model estimates water below the 20 cm inundation display threshold. This is partial context, not a dry prediction or independent confirmation.',
  },
  CURRENT_CONDITIONS_UNSUPPORTED: {
    label: 'Current Flood Support Missing', category: 'Evidence', type: 'danger',
    description: 'Complete rainfall windows are below event thresholds, the baseline model shows no nearby water, and no relevant warning or direct evidence supports this report. Low terrain alone cannot establish flooding; staff can review new evidence.',
  },
  PHYSICALLY_SUPPORTED_REPORT: {
    label: 'Physically Supported', category: 'Evidence', type: 'success',
    description: 'Timely storm conditions and the location support acceptance. This is model-assisted operational evidence, not independent depth ground truth.',
  },
  LOCAL_FLOOD_WARNING: {
    label: 'Relevant PAGASA Warning', category: 'Weather', type: 'info',
    description: 'The warning type, affected area and validity cover this observation. Severity is not converted into measured rainfall.',
  },
  PAGASA_THUNDERSTORM_WATCH: {
    label: 'Thunderstorm Watch Only', category: 'Weather', type: 'info',
    description: 'Thunderstorms may develop. A watch does not establish active rainfall or flooding and cannot qualify a report for physical acceptance.',
  },
  PAGASA_WEATHER_NOTICE: {
    label: 'Weather Notice Only', category: 'Weather', type: 'info',
    description: 'General weather or thunderstorm information is context; it does not establish a qualifying flood event.',
  },
  WARNING_UNAVAILABLE: {
    label: 'PAGASA Check Unavailable', category: 'Weather', type: 'info',
    description: 'A matching bulletin check is unavailable for this observation. Missing warning data cannot be treated as a confirmed absence of warnings.',
  },
  LOW_CONNECTED_TERRAIN_CONTEXT: {
    label: 'Low, Gentle Terrain', category: 'Terrain', type: 'info',
    description: 'Low HAND and gentle slope support possible flooding during a storm. This proxy does not prove a routed water connection.',
  },
  DRY_EVENT_TERRAIN_CONTRADICTION: {
    label: 'Dry Event and Unsuitable Terrain', category: 'Evidence', type: 'danger',
    description: 'Complete dry rainfall windows, a dry baseline model and steep terrain high above drainage contradict this unsupported claim. Missing providers alone never establish this contradiction.',
  },
  UNSUPPORTED_REPORT: {
    label: 'No Flood Evidence', category: 'Evidence', type: 'danger',
    description: 'No independent flood observations, photo evidence or available physical flood context support this submission. Staff can review new original evidence.',
  },
  NEAR_MODELED_INUNDATION: {
    label: 'Within or Near Modeled Flooding', category: 'Simulation', type: 'info',
    description: 'Uncorrected modeled inundation is at this location or within a provisional 100 m buffer. This supports plausibility, not independent verification.',
  },
  MODELED_INUNDATION_PRESENT: {
    label: 'Model Predicts Flooding Here', category: 'Simulation', type: 'info',
    description: 'The baseline model predicts at least 20 cm of water. This is physical context, not an independent witness.',
  },
  PHYSICAL_PLAUSIBILITY_ONLY: {
    label: 'Previous Physical Context Assessment', category: 'Evidence', type: 'info',
    description: 'An earlier assessment retained this report for review. Request reassessment against current evidence.',
  },
  SCENARIO_RAINFALL_CONTEXT: {
    label: 'Synthetic Storm Rainfall', category: 'Weather', type: 'info',
    description: 'Rainfall from the selected demonstration storm, not an observed weather measurement.',
  },
  UNSUPPORTED_DRY_REPORT: {
    label: 'Unsupported During Dry Conditions', category: 'General', type: 'warning',
    description: 'Fresh, complete rainfall estimates indicate dry conditions and the submission has no verifiable observation evidence, photo or corroboration. This is an intake rejection, not proof of a dry street.',
  },
  DEMO_AUTO_VALIDATED: {
    label: 'Demo Approval — Checks Skipped', category: 'General', type: 'warning',
    description: 'Global demo auto-validation was enabled for this submission. This approval does not establish flood or measurement accuracy.',
  },
  // Consensus / Peer Corroboration

  // Hydrodynamic Simulation
  SIMULATION_MATCH: {
    label: 'Model Agrees',
    category: 'Simulation',
    description: 'The model predicts inundation here, within 40 cm of the reported depth. This is diagnostic context.',
    type: 'info',
  },
  SIMULATION_ACCEPTABLE_VARIANCE: {
    label: 'Model Roughly Matches',
    category: 'Simulation',
    description: 'Model depth is within 40 cm of the report.',
    type: 'success',
  },
  SIMULATION_DRY_UNCORROBORATED: {
    label: 'Model Shows No Water',
    category: 'Simulation',
    description:
      'The model predicts no inundation here. This does not independently prove that the report is false.',
    type: 'info',
  },
  SIMULATION_DIVERGENCE: {
    label: 'Model Differs a Lot',
    category: 'Simulation',
    description: 'Model depth differs from the report by more than 40 cm.',
    type: 'warning',
  },

  // Weather / Rainfall
  HEAVY_RAINFALL: {
    label: 'Heavy Rain (Measured)',
    category: 'Weather',
    description: 'Satellite measured heavy rain (15+ mm/hr or 30+ mm in 4 hrs).',
    type: 'success',
  },
  MODERATE_RAINFALL: {
    label: 'Moderate Rain (Measured)',
    category: 'Weather',
    description: 'Satellite measured moderate rain (5+ mm/hr or 10+ mm in 4 hrs).',
    type: 'info',
  },
  RESIDUAL_RAINFALL: {
    label: 'Rain in Past 12 Hrs',
    category: 'Weather',
    description: 'Rain was recorded in the last 12 hours.',
    type: 'info',
  },

  // Terrain / NOAH map context is correlated with the trained flood model.
  HAZARD_ZONE_CORE: {
    label: 'Low-Lying Terrain (Historical)',
    category: 'Terrain',
    description: 'A previous assessment recorded low HAND terrain. Terrain is model context, not independent evidence.',
    type: 'info',
  },
  HAZARD_ZONE_BUFFER: {
    label: 'Low-Lying Terrain (Historical)',
    category: 'Terrain',
    description: 'A previous assessment recorded low HAND terrain. Terrain is model context, not independent evidence.',
    type: 'info',
  },
  LOW_HAND_TERRAIN_CONTEXT: {
    label: 'Low-Lying Terrain (Model Context)',
    category: 'Terrain',
    description: 'The location is low relative to nearby drainage. HAND is a flood-model input, so this does not add independent evidence points.',
    type: 'info',
  },
  HIGH_HAND_TERRAIN_CONTEXT: {
    label: 'Terrain Context: High Above Drainage',
    category: 'Terrain',
    description: 'HAND terrain is high above nearby drainage. This is model context and does not independently confirm or disprove the report.',
    type: 'info',
  },
  HIGH_SLOPE_TERRAIN_CONTEXT: {
    label: 'Terrain Context: Steep Slope',
    category: 'Terrain',
    description: 'Terrain slope is steep at this location. This is model context and does not independently confirm or disprove the report.',
    type: 'info',
  },
  NOAH_HAZARD_MAP_CONTEXT: {
    label: 'NOAH Flood Map Context',
    category: 'Terrain',
    description: 'This location falls in a NOAH flood map area used to train the flood model. It is not independent corroboration.',
    type: 'info',
  },
  TERRAIN_DATA_UNAVAILABLE: {
    label: 'Terrain Check Skipped',
    category: 'Terrain',
    description:
      'Eligible terrain data are unavailable for this assessment. Missing terrain does not disprove the report.',
    type: 'info',
  },

  // Reporter Reliability & Verification
  USER_AUTHENTICATED: {
    label: 'Signed-In Reporter',
    category: 'Reporter',
    description: 'Submitted from a signed-in citizen account.',
    type: 'info',
  },
  USER_HIGH_TRUST: {
    label: 'Trusted Reporter',
    category: 'Reporter',
    description: 'History of accurate, verified reports.',
    type: 'success',
  },
  USER_STANDARD_TRUST: {
    label: 'Reliable Reporter',
    category: 'Reporter',
    description: 'Mostly consistent report history.',
    type: 'info',
  },
  USER_BASELINE_TRUST: {
    label: 'New or Neutral History',
    category: 'Reporter',
    description: 'New or average history — default trust level.',
    type: 'info',
  },
  USER_LOW_TRUST: {
    label: 'Prior False Reports',
    category: 'Reporter',
    description: 'Independent human moderation includes rejected reports.',
    type: 'warning',
  },
  USER_UNTRUSTED: {
    label: 'Poor Report History',
    category: 'Reporter',
    description: 'Low historical confidence score.',
    type: 'warning',
  },
  USER_BLACKLISTED: {
    label: 'Blocked Account',
    category: 'Reporter',
    description: 'Flagged for spam or repeated false reports.',
    type: 'danger',
  },
  STAFF_REPORTER: {
    label: 'Staff Submission',
    category: 'Reporter',
    description:
      'From a CDRRMO staff account — verified only with enough consistent evidence; otherwise queued for inspection.',
    type: 'success',
  },

  // Photographic Evidence
  EVIDENCE_PHOTO_ATTACHED: {
    label: 'Photo Attached',
    category: 'Evidence',
    description: 'Ground-level photo of the flood.',
    type: 'success',
  },
};

export function formatValidationFlag(flag: string): ValidationFlagMeta {
  if (flag === 'PEER_DEPTH_VARIATION') return {
    label: 'Reported Depths Vary', category: 'Consensus', type: 'warning',
    description: 'Nearby observations report different depths. They corroborate flooding, not a precise shared depth.',
  };
  if (VALIDATION_FLAG_LABELS[flag]) {
    return VALIDATION_FLAG_LABELS[flag];
  }

  const originalSources = flag.match(/^ORIGINAL_OBSERVATION_SOURCES_(\d+)$/);
  if (originalSources) return {
    label: `${originalSources[1]} Corroborating Sources`, category: 'Consensus', type: 'success',
    description: 'Distinct original observations corroborate flooding, not numeric depth accuracy.',
  };
  if (flag === 'SIMULATION_DIFFERS') return {
    label: 'Model Differs', category: 'General', type: 'info',
    description: 'A model difference is diagnostic context; it does not invalidate the observation.',
  };
  if (flag === 'HEAVY_RAINFALL_CONTEXT') return {
    label: 'Rainfall Threshold Met', category: 'General', type: 'info',
    description: 'Rainfall estimates meet a provisional report-assessment threshold. This does not establish water depth or an official PAGASA warning level.',
  };
  const independentPeers = flag.match(/^INDEPENDENT_PEERS_(\d+)$/);
  if (independentPeers) {
    return {
      label: `${independentPeers[1]} Independent Witnesses`, category: 'Consensus',
      description: 'Distinct reporters with independently moderated, matching observations.', type: 'success',
    };
  }
  if (/_CONFLICT$/.test(flag) || flag === 'SIMULATION_DIVERGENCE') {
    return {
      label: flag.replace(/_/g, ' ').toLowerCase(), category: 'General',
      description: 'Evidence differs from the observation. A moderator should inspect it.', type: 'warning',
    };
  }
  if (/(?:_UNAVAILABLE|_STALE|_OUTSIDE_COVERAGE)$/.test(flag)) {
    return {
      label: flag.replace(/_/g, ' ').toLowerCase(), category: 'General',
      description: 'This source cannot currently provide eligible evidence. It does not disprove the report.', type: 'info',
    };
  }

  // Clean title-cased fallback for any other string
  const cleanLabel = flag
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return {
    label: cleanLabel,
    category: 'General',
    description: `Validation rule signal: ${cleanLabel}`,
    type: 'info',
  };
}
