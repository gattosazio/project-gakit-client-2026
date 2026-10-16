import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listReports } from '@/app/monitoring/features/reports/actions/reports';
import { fetchAlertHistory } from '@/lib/weather/weather';
import {
  ACTIVE_REPORT_PAGES,
  ACTIVE_WEATHER_PAGES,
  API_PAGE_LIMIT,
  ARCHIVED_REPORT_PAGES,
  ARCHIVED_WEATHER_PAGES,
  fetchReportPages,
  fetchWeatherPages,
} from '@/lib/notifications/feed';
import type { Report } from '@/types/report';
import type { WeatherAlert } from '@/types/weather';

vi.mock('@/app/monitoring/features/reports/actions/reports', () => ({
  listReports: vi.fn(),
}));

vi.mock('@/lib/weather/weather', () => ({
  fetchAlertHistory: vi.fn(),
}));

const mockedReports = vi.mocked(listReports);
const mockedWeather = vi.mocked(fetchAlertHistory);

const TIMESTAMP = '2026-08-22T00:00:00Z';

function makeReports(from: number, count: number): Report[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${from + index}`,
    location: { latitude: 8.22, longitude: 124.26, address: `P${from + index}` },
    depth: { code: 'knee', label: 'Knee deep', approximateCm: 45 },
    status: 'UNVERIFIED',
    observedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }));
}

function makeAlerts(from: number, count: number): WeatherAlert[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `w${from + index}`,
    alertType: 'heavy_rain',
    severity: 'warning',
    validFrom: TIMESTAMP,
    validTo: TIMESTAMP,
    createdAt: TIMESTAMP,
  })) as WeatherAlert[];
}

beforeEach(() => {
  mockedReports.mockReset();
  mockedWeather.mockReset();
});

describe('API_PAGE_LIMIT', () => {
  // Regression: the Archived view first shipped asking for limit=300/200 and
  // every request came back 400 Validation error, blanking both panels.
  it('never exceeds the 100 the backend accepts', () => {
    expect(API_PAGE_LIMIT).toBe(100);
    expect(API_PAGE_LIMIT).toBeLessThanOrEqual(100);
  });
});

describe('fetchReportPages', () => {
  it('requests exactly one page for the Active view', async () => {
    mockedReports.mockResolvedValue({
      items: makeReports(0, 3),
      total: 3,
      page: 1,
      limit: API_PAGE_LIMIT,
      totalPages: 1,
    });

    const items = await fetchReportPages(ACTIVE_REPORT_PAGES);

    expect(mockedReports).toHaveBeenCalledTimes(1);
    expect(mockedReports).toHaveBeenCalledWith({ limit: 100, page: 1 });
    expect(items).toHaveLength(3);
  });

  it('never sends a limit the API would reject with 400', async () => {
    mockedReports.mockResolvedValue({
      items: makeReports(0, API_PAGE_LIMIT),
      total: 300,
      page: 1,
      limit: API_PAGE_LIMIT,
      totalPages: 3,
    });

    await fetchReportPages(ARCHIVED_REPORT_PAGES);

    for (const [query] of mockedReports.mock.calls) {
      const limit = query?.limit ?? 0;
      expect(limit).toBeLessThanOrEqual(100);
      expect(limit).toBeGreaterThan(0);
    }
  });

  it('walks every page and keeps source order', async () => {
    mockedReports
      .mockResolvedValueOnce({
        items: makeReports(0, API_PAGE_LIMIT),
        total: 250,
        page: 1,
        limit: API_PAGE_LIMIT,
        totalPages: 3,
      })
      .mockResolvedValueOnce({
        items: makeReports(100, API_PAGE_LIMIT),
        total: 250,
        page: 2,
        limit: API_PAGE_LIMIT,
        totalPages: 3,
      })
      .mockResolvedValueOnce({
        items: makeReports(200, 50),
        total: 250,
        page: 3,
        limit: API_PAGE_LIMIT,
        totalPages: 3,
      });

    const items = await fetchReportPages(ARCHIVED_REPORT_PAGES);

    expect(mockedReports).toHaveBeenCalledTimes(3);
    expect(mockedReports.mock.calls.map(([query]) => query?.page)).toEqual([1, 2, 3]);
    expect(items).toHaveLength(250);
    expect(items[0].id).toBe('r0');
    expect(items[99].id).toBe('r99');
    expect(items[100].id).toBe('r100');
    expect(items[249].id).toBe('r249');
  });

  it('stops on a short page instead of paying for an empty round-trip', async () => {
    mockedReports.mockResolvedValue({
      items: makeReports(0, 12),
      total: 12,
      page: 1,
      limit: API_PAGE_LIMIT,
      totalPages: 1,
    });

    const items = await fetchReportPages(ARCHIVED_REPORT_PAGES);

    expect(mockedReports).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(12);
  });

  it('stops at the reported last page even when it is full', async () => {
    mockedReports.mockResolvedValue({
      items: makeReports(0, API_PAGE_LIMIT),
      total: 100,
      page: 1,
      limit: API_PAGE_LIMIT,
      totalPages: 1,
    });

    const items = await fetchReportPages(ARCHIVED_REPORT_PAGES);

    expect(mockedReports).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(API_PAGE_LIMIT);
  });

  it('surfaces a failed request rather than returning partial data silently', async () => {
    mockedReports.mockRejectedValue(new Error('Request failed with status 400'));

    await expect(fetchReportPages(ARCHIVED_REPORT_PAGES)).rejects.toThrow(
      'Request failed with status 400'
    );
  });
});

describe('fetchWeatherPages', () => {
  it('requests exactly one page for the Active view', async () => {
    mockedWeather.mockResolvedValue({
      items: makeAlerts(0, 2),
      total: 2,
      offset: 0,
      limit: API_PAGE_LIMIT,
    });

    const items = await fetchWeatherPages(ACTIVE_WEATHER_PAGES);

    expect(mockedWeather).toHaveBeenCalledTimes(1);
    expect(mockedWeather).toHaveBeenCalledWith(0, 100);
    expect(items).toHaveLength(2);
  });

  it('never sends a limit the API would reject with 400', async () => {
    mockedWeather.mockResolvedValue({
      items: makeAlerts(0, API_PAGE_LIMIT),
      total: 200,
      offset: 0,
      limit: API_PAGE_LIMIT,
    });

    await fetchWeatherPages(ARCHIVED_WEATHER_PAGES);

    for (const [, limit] of mockedWeather.mock.calls) {
      expect(limit).toBeLessThanOrEqual(100);
      expect(limit).toBeGreaterThan(0);
    }
  });

  it('advances by offset and concatenates in source order', async () => {
    mockedWeather
      .mockResolvedValueOnce({
        items: makeAlerts(0, API_PAGE_LIMIT),
        total: 150,
        offset: 0,
        limit: API_PAGE_LIMIT,
      })
      .mockResolvedValueOnce({
        items: makeAlerts(100, 50),
        total: 150,
        offset: 100,
        limit: API_PAGE_LIMIT,
      });

    const items = await fetchWeatherPages(ARCHIVED_WEATHER_PAGES);

    expect(mockedWeather.mock.calls.map(([offset]) => offset)).toEqual([0, 100]);
    expect(items).toHaveLength(150);
    expect(items[0].id).toBe('w0');
    expect(items[100].id).toBe('w100');
    expect(items[149].id).toBe('w149');
  });

  it('stops once it has collected the reported total', async () => {
    mockedWeather.mockResolvedValue({
      items: makeAlerts(0, API_PAGE_LIMIT),
      total: 100,
      offset: 0,
      limit: API_PAGE_LIMIT,
    });

    const items = await fetchWeatherPages(ARCHIVED_WEATHER_PAGES);

    expect(mockedWeather).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(API_PAGE_LIMIT);
  });

  it('stops on a short page', async () => {
    mockedWeather.mockResolvedValue({
      items: makeAlerts(0, 7),
      total: 7,
      offset: 0,
      limit: API_PAGE_LIMIT,
    });

    const items = await fetchWeatherPages(ARCHIVED_WEATHER_PAGES);

    expect(mockedWeather).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(7);
  });
});
