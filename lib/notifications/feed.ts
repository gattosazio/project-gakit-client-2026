import { listReports } from '@/app/monitoring/features/reports/actions/reports';
import { fetchAlertHistory } from '@/lib/weather/weather';
import type { Report } from '@/types/report';
import type { WeatherAlert } from '@/types/weather';

/**
 * Both endpoints reject `limit > 100` with a 400 Validation error, so a wider
 * window has to be built by walking pages rather than by raising `limit`.
 * Reports paginate with `page`; weather history paginates with `offset`.
 *
 * Verified against the live API: `limit=100` returns 200, `limit=101` returns
 * 400 on both routes.
 */
export const API_PAGE_LIMIT = 100;

/** Reports fetched for the Active view — one page, as before. */
export const ACTIVE_REPORT_PAGES = 1;
/** Weather advisories fetched for the Active view — one page. */
export const ACTIVE_WEATHER_PAGES = 1;

/**
 * Archived items are by definition older, so the Archived view walks deeper.
 * These stay within the API cap rather than exceeding it.
 */
export const ARCHIVED_REPORT_PAGES = 3;
export const ARCHIVED_WEATHER_PAGES = 2;

/**
 * Collect up to `maxPages` report pages, stopping early on a short page or the
 * reported last page so an exact multiple of the page size doesn't cost an
 * extra empty round-trip.
 */
export async function fetchReportPages(maxPages: number): Promise<Report[]> {
  const items: Report[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listReports({ limit: API_PAGE_LIMIT, page });
    items.push(...result.items);

    if (result.items.length < API_PAGE_LIMIT) break;
    if (result.totalPages > 0 && page >= result.totalPages) break;
  }

  return items;
}

/** The weather half of the same walk, paging via `offset`. */
export async function fetchWeatherPages(maxPages: number): Promise<WeatherAlert[]> {
  const items: WeatherAlert[] = [];

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const offset = pageIndex * API_PAGE_LIMIT;
    const result = await fetchAlertHistory(offset, API_PAGE_LIMIT);
    items.push(...result.items);

    if (result.items.length < API_PAGE_LIMIT) break;
    if (result.total > 0 && offset + API_PAGE_LIMIT >= result.total) break;
  }

  return items;
}
