import type { FloodDepthCode, FloodReference, ReportStatus } from '@/types/report';

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
 * mistaken for one another; PENDING and REJECTED are separated by treatment
 * (light outlined vs dark filled) rather than hue.
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
    badgeClass: 'bg-slate-800 text-white border-slate-700',
    color: '#334155',
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
  ISOLATED_REPORT: {
    label: 'First Witness (Isolated)',
    category: 'Consensus',
    description: 'First report submitted in this 250m area; no prior peer reports within 45 minutes.',
    type: 'info',
  },
  CONSENSUS_DEPTH_AGREEMENT: {
    label: 'Peer Depth Corroboration',
    category: 'Consensus',
    description: 'Nearby citizen reports confirm consistent flood depth levels.',
    type: 'success',
  },

  // Hydrodynamic Simulation
  SIMULATION_MATCH: {
    label: 'Simulation Match',
    category: 'Simulation',
    description: 'Reported depth closely aligns with 2D hydrodynamic flood simulation (within 30cm).',
    type: 'success',
  },
  SIMULATION_ACCEPTABLE_VARIANCE: {
    label: 'Plausible Simulation Variance',
    category: 'Simulation',
    description: 'Reported depth is within an acceptable variance bracket of simulated flood level (within 60cm).',
    type: 'success',
  },
  SIMULATION_DRY_ANOMALY: {
    label: 'Simulation Dry Cell Discrepancy',
    category: 'Simulation',
    description: 'Simulation model predicts dry ground (0cm), but citizen reported significant water (>=50cm).',
    type: 'warning',
  },
  SIMULATION_DRAINAGE_OUTLIER: {
    label: 'Pluvial / Local Drainage Outlier',
    category: 'Simulation',
    description: 'River model is dry, but heavy rainfall indicates localized urban street/drainage overflow.',
    type: 'info',
  },
  SIMULATION_DIVERGENCE: {
    label: 'Simulation Depth Divergence',
    category: 'Simulation',
    description: 'Reported water depth diverges notably from hydrodynamic simulation predictions.',
    type: 'warning',
  },

  // Weather / Rainfall
  ZERO_RAINFALL: {
    label: 'No Rainfall Recorded',
    category: 'Weather',
    description: 'Radar and local rain gauges indicate dry weather with zero active precipitation.',
    type: 'warning',
  },
  HEAVY_RAINFALL: {
    label: 'Heavy Rainfall Measured',
    category: 'Weather',
    description: 'Active downpour (>=15mm/hr or >=30mm in 3h) strongly corroborates flooding.',
    type: 'success',
  },
  MODERATE_RAINFALL: {
    label: 'Moderate Rainfall Measured',
    category: 'Weather',
    description: 'Moderate precipitation recorded in the river basin (>=5mm/hr or >=10mm in 3h).',
    type: 'info',
  },
  RESIDUAL_RAINFALL: {
    label: 'Residual Basin Precipitation',
    category: 'Weather',
    description: 'Recent storm accumulation recorded in past 12 hours.',
    type: 'info',
  },
  WEATHER_ALERT_ACTIVE: {
    label: 'Active Weather Advisory',
    category: 'Weather',
    description: 'Official PAGASA heavy rainfall warning or cyclone advisory is active.',
    type: 'info',
  },

  // Terrain / NOAH Hazard
  HAZARD_ZONE_CORE: {
    label: 'Core Flood Hazard Zone',
    category: 'Terrain',
    description: 'Location lies inside official high-susceptibility NOAH flood zone (HAND <= 1.5m).',
    type: 'info',
  },
  HAZARD_ZONE_BUFFER: {
    label: 'Flood Hazard Buffer',
    category: 'Terrain',
    description: 'Location is within a 150m buffer of an official flood hazard zone (HAND <= 5m).',
    type: 'info',
  },
  HIGH_ELEVATION_RIDGE: {
    label: 'Elevated Ridge / High Terrain',
    category: 'Terrain',
    description: 'Steep slope (>15%) or high elevation (HAND > 15m) where flooding is physically improbable.',
    type: 'warning',
  },
  TERRAIN_MODERATE: {
    label: 'Alluvial Urban Plain',
    category: 'Terrain',
    description: 'Typical lowland alluvial or urban terrain.',
    type: 'info',
  },

  // Reporter Reliability & Verification
  USER_AUTHENTICATED: {
    label: 'Authenticated Citizen',
    category: 'Reporter',
    description: 'Submitted from an authenticated citizen user account.',
    type: 'info',
  },
  USER_HIGH_TRUST: {
    label: 'High Reputation Reporter',
    category: 'Reporter',
    description: 'Citizen has an established historical track record of accurate verified reports.',
    type: 'success',
  },
  USER_LOW_TRUST: {
    label: 'Low Reputation Reporter',
    category: 'Reporter',
    description: 'Citizen history contains previous unverified or rejected submissions.',
    type: 'warning',
  },
  USER_UNTRUSTED: {
    label: 'Unrated Reporter',
    category: 'Reporter',
    description: 'Reporter account has low historical confidence score.',
    type: 'warning',
  },
  USER_BLACKLISTED: {
    label: 'Blacklisted Submitter',
    category: 'Reporter',
    description: 'Account or device has been flagged for spam or chronic false submissions.',
    type: 'danger',
  },
  ADMIN_BYPASS: {
    label: 'Staff Priority Bypass',
    category: 'Reporter',
    description: 'Submitted or authorized by verified CDRRMO disaster responder personnel.',
    type: 'success',
  },

  // Photographic Evidence
  EVIDENCE_PHOTO_ATTACHED: {
    label: 'Photographic Proof Attached',
    category: 'Evidence',
    description: 'Citizen provided ground-level photographic evidence of water depth.',
    type: 'success',
  },
};

export function formatValidationFlag(flag: string): ValidationFlagMeta {
  if (VALIDATION_FLAG_LABELS[flag]) {
    return VALIDATION_FLAG_LABELS[flag];
  }

  // Handle dynamic peer count flags, e.g. CONSENSUS_PEERS_2
  const peerMatch = flag.match(/^CONSENSUS_PEERS_(\d+)$/);
  if (peerMatch) {
    const count = peerMatch[1];
    return {
      label: `${count} Nearby Peer Reports`,
      category: 'Consensus',
      description: `Corroborated by ${count} independent citizen reports within 250m and 45 minutes.`,
      type: 'success',
    };
  }

  // Handle dynamic staff actor flags, e.g. ACTOR_RESPONDER@CDRRMO...
  const actorMatch = flag.match(/^ACTOR_(.+)$/);
  if (actorMatch) {
    return {
      label: `Authorized by ${actorMatch[1].toLowerCase()}`,
      category: 'Reporter',
      description: `Action authorized by disaster management personnel.`,
      type: 'success',
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

export function getValidationScoreMeta(score: number | null | undefined): {
  colorClass: string;
  badgeClass: string;
  textClass: string;
  tier: 'High' | 'Medium' | 'Low' | 'Unrated';
} {
  if (score == null) {
    return {
      colorClass: 'bg-slate-200 text-slate-700',
      badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
      textClass: 'text-slate-500',
      tier: 'Unrated',
    };
  }
  if (score >= 70) {
    return {
      colorClass: 'bg-emerald-500 text-white',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      textClass: 'text-emerald-700',
      tier: 'High',
    };
  }
  if (score >= 30) {
    return {
      colorClass: 'bg-amber-500 text-white',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      textClass: 'text-amber-700',
      tier: 'Medium',
    };
  }
  return {
    colorClass: 'bg-rose-500 text-white',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    textClass: 'text-rose-700',
    tier: 'Low',
  };
}


