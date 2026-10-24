/** PAGASA/DOST heat-index categories, applied to a regional model estimate.
 * https://www.dost.gov.ph/knowledge-resources/news/86-2025-news/3971-iheatmap-an-online-monitoring-guide-for-heat-index.html
 */
export function heatStressLabel(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 52) return 'Extreme danger';
  if (value >= 42) return 'Danger';
  if (value >= 33) return 'Extreme caution';
  if (value >= 27) return 'Caution';
  return 'Below caution range';
}
