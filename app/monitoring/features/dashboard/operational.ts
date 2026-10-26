import type { DashboardHour, DashboardSnapshot } from '@/types/dashboard';

export const manilaTime = (iso: string, includeDate = false) =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    ...(includeDate ? ({ month: 'short', day: 'numeric' } as const) : {}),
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

export function sourceState(at: string | null, now: number, maxAgeMinutes: number) {
  if (!at || !Number.isFinite(Date.parse(at))) return 'unavailable';
  const age = now - Date.parse(at);
  return age < -300_000 || age > maxAgeMinutes * 60_000 ? 'delayed' : 'fresh';
}

export const INFLOW_STATUSES = [
  { key: 'verified', label: 'Validated', color: '#2563eb' },
  { key: 'pending', label: 'Pending', color: '#64748b' },
  { key: 'rejected', label: 'Rejected', color: '#cbd5e1' },
] as const;

export function inflowInterval(hour: DashboardHour, snapshot: DashboardSnapshot) {
  const start = Math.max(Date.parse(hour.at), Date.parse(snapshot.windowStart));
  const end = Math.min(Date.parse(hour.at) + 3_600_000, Date.parse(snapshot.asOf));
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    partial: end - start < 3_600_000,
  };
}

export function inflowSummary(snapshot: DashboardSnapshot) {
  // Compare complete clock hours; partial edge buckets are clearly labeled in the chart.
  const complete = snapshot.hourly.filter((hour) => !inflowInterval(hour, snapshot).partial);
  const peak = complete.reduce<DashboardHour | null>(
    (best, hour) => (!best || hour.count > best.count ? hour : best),
    null
  );
  return {
    delta: snapshot.totals.submissions - snapshot.totals.previousSubmissions,
    peak: peak && peak.count > 0 ? peak : null,
  };
}
