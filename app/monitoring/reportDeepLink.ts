import type { DashboardReviewOptions } from './features/dashboard/DashboardOverview';

/**
 * Apply only the filters explicitly requested by a dashboard action.
 * General navigation preserves the reports window. Recent summaries request
 * 24 hours; the all-age pending queue explicitly requests All time. Opening
 * one report uses its ID directly and must not change table filters.
 * The shell consumes these parameters when leaving Reports.
 */
export function applyReportDeepLinkParams(
  params: URLSearchParams,
  options?: DashboardReviewOptions
): void {
  if (options?.reportId) {
    consumeReportDeepLinkParams(params);
    return;
  }
  if (options?.status) params.set('status', options.status);
  else params.delete('status');
  if (options?.time) params.set('time', options.time);
  else params.delete('time');
}

/** Drops a consumed deep link so later Reports visits keep the user's filters. */
export function consumeReportDeepLinkParams(params: URLSearchParams): void {
  params.delete('status');
  params.delete('time');
}
