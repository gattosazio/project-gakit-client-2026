import type { ReportArchive } from '@/types/dashboard';

export const ARCHIVE_LEVELS = [
  { color: '#f1f5f9', label: '0', minimum: 0 },
  { color: '#fce7ed', label: '1', minimum: 1 },
  { color: '#f9a8bd', label: '2–4', minimum: 2 },
  { color: '#be3454', label: '5–9', minimum: 5 },
  { color: '#7a0019', label: '10+', minimum: 10 },
] as const;

export function archiveLevel(count: number) {
  return count >= 10 ? 4 : count >= 5 ? 3 : count >= 2 ? 2 : count > 0 ? 1 : 0;
}

export function archiveDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
}

export interface ArchiveCell {
  date: string | null;
  count: number;
  future: boolean;
  level: number;
}

export function buildArchiveCalendar(archive: ReportArchive, month: number) {
  const year = archive.year;
  const first = Date.UTC(year, month - 1, 1);
  const offset = new Date(first).getUTCDay();
  const length = (Date.UTC(year, month, 1) - first) / 86_400_000;
  const weeks = Math.ceil((offset + length) / 7);
  const counts = new Map(archive.days.map((day) => [day.date, day.count]));
  const cells: ArchiveCell[] = Array.from({ length: weeks * 7 }, (_, index) => {
    const day = index - offset;
    if (day < 0 || day >= length) return { date: null, count: 0, future: false, level: 0 };
    const date = new Date(first + day * 86_400_000).toISOString().slice(0, 10);
    const future = date > archive.today;
    const count = future ? 0 : counts.get(date) ?? 0;
    return { date, count, future, level: archiveLevel(count) };
  });
  const elapsed = cells.filter((cell) => cell.date && !cell.future);
  const activeDays = elapsed.filter((cell) => cell.count > 0).length;
  const peak = elapsed.reduce<ArchiveCell | null>((best, cell) => (
    cell.count > (best?.count ?? 0) ? cell : best
  ), null);
  const total = elapsed.reduce((sum, cell) => sum + cell.count, 0);
  return { cells, weeks, activeDays, peak, total };
}
