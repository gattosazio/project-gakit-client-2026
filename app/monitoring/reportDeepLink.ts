import type { DashboardReviewOptions } from './features/dashboard/DashboardOverview';

/**
 * One-shot report-table deep links.
 *
 * Dashboard actions ("View pending", "Flagged", "Open report management", a
 * priority report, a failed assessment) pin `status`/`time` so the reports
 * table opens on exactly the slice that was clicked. The counters behind
 * those actions include every unresolved report regardless of age ("All
 * unresolved"), so pinning `time=all` keeps the rows matching the number on
 * the button that was clicked.
 *
 * The link is deliberately short-lived: the shell consumes it as soon as the
 * user navigates away or opens a specific report. Otherwise it would be
 * re-applied on every return to the Reports tab and silently override the
 * filters the user set themselves.
 */
export function applyReportDeepLinkParams(
  params: URLSearchParams,
  options?: DashboardReviewOptions
): void {
  if (options?.status) params.set('status', options.status);
  else params.delete('status');
  params.set('time', options?.time ?? '24h');
}

/** Drops a consumed deep link so later Reports visits keep the user's filters. */
export function consumeReportDeepLinkParams(params: URLSearchParams): void {
  params.delete('status');
  params.delete('time');
}
