import type { DashboardReviewOptions } from './features/dashboard/DashboardOverview';

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
