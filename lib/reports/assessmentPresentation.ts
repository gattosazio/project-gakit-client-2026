import type { Report } from '@/types/report';
import { formatValidationFlag } from './reportFormatting';

type AssessmentReport = Pick<Report, 'status' | 'decisionSource' | 'validationSummary' | 'photoUrl'>;
export interface ReportCheckRow { label: string; value: string }

/** Present saved decisions in everyday language; do not make validation decisions here. */
export function getReportCheckPresentation(report: AssessmentReport) {
  const summary = report.validationSummary;
  const flags = new Set([
    ...(summary?.support ?? []), ...(summary?.conflicts ?? []),
    ...(summary?.missing ?? []), ...(summary?.context ?? []),
  ]);
  const has = (...keys: string[]) => keys.some(key => flags.has(key));
  const manual = report.decisionSource === 'manual';
  const current = summary?.demoAutoValidated || summary?.decisionBasis === 'physical_support'
    || summary?.decisionBasis === 'original_observations';
  let message: string;
  if (manual) {
    message = { VERIFIED: 'Accepted by staff.', REJECTED: 'Rejected by staff.',
      UNVERIFIED: 'Staff requested another review.', ANOMALY: 'Staff flagged this report for review.' }[report.status];
  } else if (!summary) {
    message = 'This report has not been checked yet.';
  } else if (!current || summary.recommendedStatus !== report.status) {
    message = 'Check this report again to update its review.';
  } else if (report.status === 'REJECTED') {
    message = has('USER_BLACKLISTED') ? 'The reporter’s account is blocked.'
      : has('CURRENT_CONDITIONS_UNSUPPORTED', 'UNSUPPORTED_DRY_REPORT', 'DRY_EVENT_TERRAIN_CONTRADICTION')
        ? 'Rainfall and flood estimates do not support this report.'
        : 'There is not enough supporting information to accept this report.';
  } else if (report.status === 'VERIFIED') {
    message = summary.demoAutoValidated ? 'Approved for the demo. Report checks were skipped.'
      : summary.decisionBasis === 'physical_support' ? 'Weather and conditions at this location support the report.'
      : (summary.corroboratingSourceCount ?? 0) > 0 ? 'Nearby reports support flooding in this area.'
      : 'This report has been accepted.';
  } else if (report.status === 'ANOMALY') {
    message = has('STAFF_REPORTER') && has('CURRENT_CONDITIONS_UNSUPPORTED')
      ? 'Staff report needs review: rainfall and flood estimates do not support it.'
      : 'Some information does not agree. Please review this report.';
  } else {
    message = has('DEPTH_CATEGORY_MISMATCH') ? 'The water depth entry needs to be reviewed.'
      : has('WARNING_ARCHIVE_UNAVAILABLE') ? 'PAGASA records for that time are incomplete.'
      : [...flags].some(flag => /_(UNAVAILABLE|STALE|OUTSIDE_COVERAGE)$/.test(flag))
        ? 'Some checks are unavailable. More information is needed.'
        : 'More information is needed before this report can be accepted.';
  }

  const shown = new Set<string>();
  const checks: ReportCheckRow[] = [];
  const add = (label: string, value: string, ...keys: string[]) => {
    checks.push({ label, value });
    keys.forEach(key => shown.add(key));
  };
  if (has('MODELED_INUNDATION_PRESENT')) add('Flood estimate', 'Flooding shown here', 'MODELED_INUNDATION_PRESENT', 'NEAR_MODELED_INUNDATION');
  else if (has('NEAR_MODELED_INUNDATION')) add('Flood estimate', 'Flooding shown nearby', 'NEAR_MODELED_INUNDATION');
  else if (has('SHALLOW_MODELED_WATER')) add('Flood estimate', 'Shallow water shown here', 'SHALLOW_MODELED_WATER');
  else if (has('SIMULATION_DRY_UNCORROBORATED')) add('Flood estimate', has('CURRENT_CONDITIONS_UNSUPPORTED') ? 'No flooding shown nearby' : 'No flooding shown here', 'SIMULATION_DRY_UNCORROBORATED');
  else if (has('SIMULATION_UNAVAILABLE', 'SIMULATION_STALE', 'SIMULATION_OUTSIDE_COVERAGE')) add('Flood estimate', 'Not available', 'SIMULATION_UNAVAILABLE', 'SIMULATION_STALE', 'SIMULATION_OUTSIDE_COVERAGE');

  if (has('LOCAL_FLOOD_WARNING')) add('PAGASA', 'Rain or flood warning recorded', 'LOCAL_FLOOD_WARNING');
  else if (has('WARNING_ARCHIVE_UNAVAILABLE')) add('PAGASA', 'Incomplete record for that time', 'WARNING_ARCHIVE_UNAVAILABLE', 'WARNING_UNAVAILABLE');
  else if (has('HEAVY_RAINFALL_CONTEXT')) add('Rainfall', 'Heavy rain recorded', 'HEAVY_RAINFALL_CONTEXT');
  else if (has('PAGASA_THUNDERSTORM_WATCH')) add('PAGASA', 'Thunderstorm watch only', 'PAGASA_THUNDERSTORM_WATCH');
  else if (has('PAGASA_WEATHER_NOTICE')) add('PAGASA', 'Weather notice only', 'PAGASA_WEATHER_NOTICE');
  else if (has('WARNING_UNAVAILABLE')) add('PAGASA', 'Check unavailable', 'WARNING_UNAVAILABLE');
  else if (has('CURRENT_CONDITIONS_UNSUPPORTED')) add('PAGASA', 'No flood warning recorded');

  const count = summary?.corroboratingSourceCount;
  if (count != null) add('Other reports', count === 0 ? 'No supporting reports' : `${count} supporting ${count === 1 ? 'report' : 'reports'}`,
    'NO_INDEPENDENT_CORROBORATION');

  const detailLabels: Record<string, string> = {
    REPORTER_IDENTITY_UNKNOWN: 'Submitted without a confirmed account.',
    OBSERVATION_LOCATION_UNCERTAIN: 'The report location has not been confirmed by GPS.',
    LOW_CONNECTED_TERRAIN_CONTEXT: 'The area has low, mostly flat ground.',
    PAGASA_THUNDERSTORM_WATCH: 'A thunderstorm watch means storms may develop; it does not confirm flooding.',
    PAGASA_WEATHER_NOTICE: 'A general weather notice was recorded.',
    HEAVY_RAINFALL_CONTEXT: 'Heavy rain was recorded around the observation time.',
    PEER_DATA_UNAVAILABLE: 'The nearby report check is unavailable.',
    REPORTER_POLICY_UNAVAILABLE: 'The account check is unavailable.',
    DEPTH_CATEGORY_MISMATCH: 'The water depth entry needs review.',
    HISTORICAL_OBSERVATION_REVIEW: 'The report describes an earlier observation.',
    WARNING_ARCHIVE_UNAVAILABLE: 'There is no reliable PAGASA record covering the observation time.',
    PEER_DEPTH_VARIATION: 'Nearby reports give different water depths.',
    OBSERVATION_DEPTH_UNCERTAIN: 'An exact water depth was not provided.',
    DUPLICATE_PHOTO_SOURCE: 'Some reports use the same photo.',
    SIMULATION_DIFFERS: 'The flood estimate and reported depth differ.',
    SIMULATION_MATCH: 'The flood estimate is close to the reported depth.',
    SCENARIO_RAINFALL_CONTEXT: 'Rainfall comes from the selected demo storm.',
    SIMULATION_SCENARIO_ONLY: 'The flood estimate comes from a demo scenario.',
  };
  // These repeat the decision, a source count, or terrain information without
  // adding a check that staff can interpret or act on.
  const hidden = new Set(['HAND_CONTEXT', 'SLOPE_CONTEXT', 'STAFF_REPORTER',
    'PHYSICALLY_SUPPORTED_REPORT', 'CURRENT_CONDITIONS_UNSUPPORTED', 'EVIDENCE_PHOTO_ATTACHED',
    'NO_INDEPENDENT_CORROBORATION', 'DEMO_AUTO_VALIDATED']);
  const details = [...flags].filter(flag => !shown.has(flag) && !hidden.has(flag)
    && !/^ORIGINAL_OBSERVATION_SOURCES_\d+$/.test(flag)).map(flag => {
    if (detailLabels[flag]) return detailLabels[flag];
    if (/^RAIN_(RATE|4H|12H|24H)_(UNAVAILABLE|STALE|OUTSIDE_COVERAGE)$/.test(flag)) return 'Some rainfall records are unavailable or out of date.';
    return formatValidationFlag(flag).label;
  });
  details.push(report.photoUrl || has('EVIDENCE_PHOTO_ATTACHED') ? 'A photo was provided.' : 'No photo was provided.');

  const accepted = report.status === 'VERIFIED';
  const depthNote = !accepted ? null : summary?.depthDisagreement
    ? 'Reported depths differ. Review them before use.'
    : summary?.depthQuality === 'category' ? 'No exact water depth was provided.'
    : summary?.depthQuality === 'measured' ? 'The reported measurement has not been checked separately.'
    : 'Water depth is an estimate.';
  return {
    message, checks, details: [...new Set(details)], depthNote,
    origin: manual ? 'Staff decision' : summary?.demoAutoValidated ? 'Demo approval'
      : report.decisionSource === 'legacy' ? 'Previous check' : 'Automatic check',
  };
}
