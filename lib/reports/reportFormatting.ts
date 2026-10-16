import type { FloodDepthCode, FloodReference, Report, ReportStatus } from '@/types/report';

/** Use the same current evidence points in the table, modal and map. */
export function getReportScoreDisplay(report: Pick<Report, 'validationScore' | 'validationSummary'>) {
  const score = report.validationSummary?.evidenceScore;
  return {
    score,
    label: 'Evidence points',
    title: score == null ? 'Awaiting evidence assessment' : `Evidence points: ${score}`,
  };
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
 * Validation state of a report. Deliberately kept off the DEPTH_BAR_COLOR
 * traffic-light ramp so a status badge and a water-level reading are never
 * mistaken for one another; PENDING and REJECTED share the slate family and
 * separate by intensity — readable outline vs grayed out — rather than hue.
 */
export const STATUS_META: Record<ReportStatus, StatusMeta> = {
  UNVERIFIED: {
    label: 'Pending',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
    color: '#64748B',
  },
  VERIFIED: {
    label: 'Verified',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    color: '#2563EB',
  },
  ANOMALY: {
    label: 'Anomaly',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    color: '#7C3AED',
  },
  REJECTED: {
    label: 'Rejected',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
    color: '#94A3B8',
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
  // Consensus / Peer Corroboration

  // Hydrodynamic Simulation
  SIMULATION_MATCH: {
    label: 'Model Supports Depth',
    category: 'Simulation',
    description: 'Flood model shows water here, within 20 cm of the reported depth.',
    type: 'success',
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
      'Model is dry here — it neither confirms nor refutes a modest claim, and earns no simulation credit.',
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
  if (VALIDATION_FLAG_LABELS[flag]) {
    return VALIDATION_FLAG_LABELS[flag];
  }

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
