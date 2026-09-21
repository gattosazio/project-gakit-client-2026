import type { FloodDepthCode, Report } from '@/types/report';
import { DEPTH_LABELS } from '@/lib/reports/reportFormatting';

export const CRITICAL_DEPTHS: ReadonlySet<FloodDepthCode> = new Set(['head', 'overhead']);

export const DISPLAY_DEPTHS: readonly FloodDepthCode[] = [
  'ankle',
  'knee',
  'waist',
  'shoulder',
  'head',
  'overhead',
];

export type QueueGroup = 'critical' | 'flagged' | 'pending';

export const QUEUE_GROUP_ORDER: readonly QueueGroup[] = ['critical', 'flagged', 'pending'];

export function reportGroup(report: Report): QueueGroup | 'done' {
  if (report.status === 'ANOMALY') return 'flagged';
  if (report.status !== 'UNVERIFIED') return 'done';
  return CRITICAL_DEPTHS.has(report.depth.code) ? 'critical' : 'pending';
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < 60_000) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export interface QueueItem {
  report: Report;
  group: QueueGroup;
  ageLabel: string;
}

export function buildQueue(reports: Report[], now = Date.now()): QueueItem[] {
  const order = new Map<QueueGroup, number>(
    QUEUE_GROUP_ORDER.map((group, index) => [group, index])
  );
  return reports
    .filter((report) => reportGroup(report) !== 'done')
    .sort((a, b) => {
      const aGroup = reportGroup(a) as QueueGroup;
      const bGroup = reportGroup(b) as QueueGroup;
      const groupDiff = order.get(aGroup)! - order.get(bGroup)!;
      if (groupDiff !== 0) return groupDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .map((report) => ({
      report,
      group: reportGroup(report) as QueueGroup,
      ageLabel: timeAgo(report.createdAt, now),
    }));
}

export interface QueueCounts {
  critical: number;
  flagged: number;
  pending: number;
}

export function queueCounts(reports: Report[]): QueueCounts {
  const counts: QueueCounts = { critical: 0, flagged: 0, pending: 0 };
  for (const report of reports) {
    const group = reportGroup(report);
    if (group !== 'done') counts[group] += 1;
  }
  return counts;
}

export interface HourlyBucket {
  label: string;
  count: number;
}

export function hourlyBuckets(
  reports: Report[],
  hours = 24,
  now = Date.now()
): HourlyBucket[] {
  const hourMs = 3_600_000;
  const currentHourStart = Math.floor(now / hourMs) * hourMs;
  const counts = new Array<number>(hours).fill(0);
  for (const report of reports) {
    const elapsedHours = Math.floor((currentHourStart - new Date(report.createdAt).getTime()) / hourMs);
    if (elapsedHours >= 0 && elapsedHours < hours) {
      counts[hours - 1 - elapsedHours] += 1;
    }
  }
  return counts.map((count, index) => {
    const slotStart = currentHourStart - (hours - 1 - index) * hourMs;
    return {
      label: new Date(slotStart).toLocaleTimeString([], {
        hour: '2-digit',
        hour12: false,
      }),
      count,
    };
  });
}

export interface DepthSlice {
  code: FloodDepthCode;
  label: string;
  count: number;
}

export function depthDistribution(reports: Report[]): DepthSlice[] {
  const counts = new Map<FloodDepthCode, number>();
  for (const report of reports) {
    counts.set(report.depth.code, (counts.get(report.depth.code) ?? 0) + 1);
  }
  return DISPLAY_DEPTHS.map((code) => ({
    code,
    label: DEPTH_LABELS[code],
    count: counts.get(code) ?? 0,
  }));
}

export interface Spot {
  label: string;
  count: number;
}

export function topSpots(reports: Report[], limit = 5): Spot[] {
  const counts = new Map<string, number>();
  for (const report of reports) {
    const label = report.location.address?.trim() || 'Unnamed location';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export type Trend = 'rising' | 'steady' | 'falling';

export interface PeriodComparison {
  last24: number;
  prev24: number;
  delta: number;
  trend: Trend;
}


export function comparePeriods(reports: Report[], now = Date.now()): PeriodComparison {
  const hourMs = 3_600_000;
  const cutoff24 = now - 24 * hourMs;
  const cutoff48 = now - 48 * hourMs;
  let last24 = 0;
  let prev24 = 0;
  for (const report of reports) {
    const created = new Date(report.createdAt).getTime();
    if (created >= cutoff24) last24 += 1;
    else if (created >= cutoff48) prev24 += 1;
  }
  const delta = last24 - prev24;
  const ratio = prev24 === 0 ? (last24 === 0 ? 0 : 1) : delta / prev24;
  const trend: Trend = ratio > 0.25 ? 'rising' : ratio < -0.25 ? 'falling' : 'steady';
  return { last24, prev24, delta, trend };
}

export function niceTicks(max: number, steps = 4): number[] {
  const rawStep = max / steps;
  if (rawStep <= 0) return [0];
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / pow;
  const stepPct = normalized <= 1.5 ? 1 : normalized <= 3 ? 2 : normalized <= 7 ? 5 : 10;
  const step = stepPct * pow;
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.ceil(max / step) * step);
  return ticks;
}

export interface DeepestSpot {
  label: string;
  code: FloodDepthCode;
  depthLabel: string;
  maxDepthCm: number;
  count: number;
}

export function deepestSpots(reports: Report[], limit = 5): DeepestSpot[] {
  const rank = new Map<FloodDepthCode, number>(
    DISPLAY_DEPTHS.map((code, index) => [code, index])
  );
  const byLabel = new Map<string, { count: number; code: FloodDepthCode; cm: number }>();
  for (const report of reports) {
    const label = report.location.address?.trim() || 'Unknown location';
    const cm = report.depth.approximateCm ?? 0;
    const current = byLabel.get(label);
    if (!current || cm > current.cm) {
      byLabel.set(label, { count: (current?.count ?? 0) + 1, code: report.depth.code, cm });
    } else {
      byLabel.set(label, { ...current, count: current.count + 1 });
    }
  }
  return Array.from(byLabel.entries())
    .map(([label, { count, code, cm }]) => ({
      label,
      code,
      depthLabel: DEPTH_LABELS[code],
      maxDepthCm: cm,
      count,
    }))
    .sort(
      (a, b) =>
        rank.get(b.code)! - rank.get(a.code)! ||
        b.maxDepthCm - a.maxDepthCm ||
        b.count - a.count ||
        a.label.localeCompare(b.label)
    )
    .slice(0, limit);
}