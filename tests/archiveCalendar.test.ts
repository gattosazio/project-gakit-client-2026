import { describe, expect, it } from 'vitest';
import { archiveDateLabel, archiveLevel, buildArchiveCalendar } from '@/app/monitoring/features/dashboard/archiveCalendar';
import type { ReportArchive } from '@/types/dashboard';

const archive = (year: number, days: ReportArchive['days'] = [], today = '2026-10-16'): ReportArchive => ({
  year, timeZone: 'Asia/Manila', asOf: `${today}T05:00:00Z`, today,
  total: days.reduce((sum, day) => sum + day.count, 0), days,
});

describe('monthly submission calendar', () => {
  it('lays out the selected month Sunday first without counting padding days', () => {
    const result = buildArchiveCalendar(archive(2026), 10);
    expect(result.cells.filter((cell) => cell.date)).toHaveLength(31);
    expect(result.cells.slice(0, 4).every((cell) => cell.date === null)).toBe(true);
    expect(result.cells[4].date).toBe('2026-10-01');
    expect(result.cells.filter((cell) => cell.date).at(-1)?.date).toBe('2026-10-31');
  });
  it('includes leap days and handles months spanning six calendar rows', () => {
    const leap = buildArchiveCalendar(archive(2024, [{ date: '2024-02-29', count: 12 }]), 2);
    expect(leap.cells.filter((cell) => cell.date)).toHaveLength(29);
    expect(leap.cells.find((cell) => cell.date === '2024-02-29')?.count).toBe(12);
    expect(buildArchiveCalendar(archive(2026), 2).cells.filter((cell) => cell.date)).toHaveLength(28);
    expect(buildArchiveCalendar(archive(2026), 8).weeks).toBe(6);
  });
  it('distinguishes empty days from future dates and counts only the selected month', () => {
    const result = buildArchiveCalendar(archive(2026, [
      { date: '2026-10-15', count: 5 }, { date: '2026-10-17', count: 99 }, { date: '2026-09-30', count: 100 },
    ]), 10);
    expect(result.cells.find((cell) => cell.date === '2026-10-16')).toMatchObject({ count: 0, future: false });
    expect(result.cells.find((cell) => cell.date === '2026-10-17')).toMatchObject({ count: 0, future: true });
    expect(result.activeDays).toBe(1);
    expect(result.total).toBe(5);
  });
  it('uses fixed volume bands across months and years', () => {
    expect([0, 1, 2, 4, 5, 9, 10, 999].map(archiveLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });
  it('formats calendar dates without shifting them to another day', () => {
    expect(archiveDateLabel('2026-01-01')).toContain('Jan 1, 2026');
  });
});
