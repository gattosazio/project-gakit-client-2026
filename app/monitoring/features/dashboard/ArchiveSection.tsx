'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { ReportArchive } from '@/types/dashboard';
import { fetchReportArchive } from '../reports/actions/reports';
import { ARCHIVE_LEVELS, archiveDateLabel, buildArchiveCalendar } from './archiveCalendar';
import { manilaTime } from './operational';
import { AnnualSubmissions } from './AnnualSubmissions';

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('en-PH', { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2020, month, 1))
);
const CURRENT_MONTH = Number(new Intl.DateTimeFormat('en-PH', { month: 'numeric', timeZone: 'Asia/Manila' }).format(new Date()));

interface ArchiveSectionProps {
  monthly: Array<{ month: string; reports: number }>;
  years: string[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  active?: boolean;
  refreshKey?: string | number;
}

export function ArchiveSection({
  monthly, years, selectedYear, onYearChange, active = true, refreshKey,
}: ArchiveSectionProps) {
  const [open, setOpen] = useState(true);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [data, setData] = useState<Record<string, ReportArchive>>({});
  const [failure, setFailure] = useState<{ year: string; message: string } | null>(null);
  const [loadingYear, setLoadingYear] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const archive = data[selectedYear];
  const calendar = useMemo(() => archive ? buildArchiveCalendar(archive, month) : null, [archive, month]);
  const elapsed = calendar?.cells.filter((cell) => cell.date && !cell.future) ?? [];
  const defaultDate = elapsed.find((cell) => cell.date === archive?.today)?.date
    ?? elapsed.filter((cell) => cell.count > 0).at(-1)?.date ?? elapsed[0]?.date ?? null;
  const activeDate = elapsed.find((cell) => cell.date === selectedDate)?.date ?? defaultDate;
  const inspected = calendar?.cells.find((cell) => cell.date === hoveredDate && cell.date)
    ?? elapsed.find((cell) => cell.date === activeDate);
  const total = calendar?.total ?? monthly[month - 1]?.reports ?? 0;
  const error = failure?.year === selectedYear ? failure.message : null;
  const loading = loadingYear === selectedYear;
  const upcoming = !!calendar && elapsed.length === 0;

  useEffect(() => {
    if (!open || !active) return;
    let stopped = false;
    let controller: AbortController | undefined;
    let generation = 0;
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const request = ++generation;
      setLoadingYear(selectedYear);
      setFailure(null);
      try {
        const result = await fetchReportArchive(Number(selectedYear), controller.signal);
        if (stopped || request !== generation) return;
        setData((previous) => ({ ...previous, [selectedYear]: result }));
      } catch (cause) {
        if (stopped || request !== generation || controller.signal.aborted) return;
        setFailure({ year: selectedYear, message: cause instanceof Error ? cause.message : 'Archive unavailable.' });
      } finally {
        if (!stopped && request === generation) setLoadingYear(null);
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') void load();
      else {
        generation++;
        controller?.abort();
      }
    };
    if (document.visibilityState === 'visible') void load();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      generation++;
      controller?.abort();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [open, active, selectedYear, refreshKey, retry]);

  const changeMonth = (value: number) => {
    setMonth(value);
    setSelectedDate(null);
    setHoveredDate(null);
  };
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!calendar || !elapsed.length) return;
    const moves: Record<string, number> = {
      ArrowLeft: index - 1, ArrowRight: index + 1, ArrowUp: index - 7, ArrowDown: index + 7,
      Home: Math.floor(index / 7) * 7, End: Math.floor(index / 7) * 7 + 6,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const first = calendar.cells.findIndex((cell) => cell.date && !cell.future);
    const target = calendar.cells[Math.max(first, Math.min(first + elapsed.length - 1, moves[event.key]))];
    if (target.date) buttons.current.get(target.date)?.focus();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Submission archive">
      <div className="flex items-center gap-3 px-3 py-1.5">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}
          aria-controls="dashboard-archive-content"
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left hover:text-gakit-maroon">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <History className="h-3.5 w-3.5 text-gakit-maroon" />
            <span className="text-xs font-semibold text-slate-700">Submission Archive</span>
            <span className="hidden text-[10px] text-slate-400 sm:inline">{total.toLocaleString('en-PH')} received · {MONTHS[month - 1]} {selectedYear}</span>
            {open && loading && <Spinner size="xs" label="Refreshing archive" />}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <label htmlFor="archive-year" className="sr-only">Select year</label>
        <select id="archive-year" value={selectedYear} onChange={(event) => {
          setSelectedDate(null);
          setHoveredDate(null);
          onYearChange(event.target.value);
        }} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 outline-none focus:border-gakit-maroon">
          {years.map((year) => <option key={year}>{year}</option>)}
        </select>
      </div>
      {open && (
        <div id="dashboard-archive-content" className="border-t border-slate-100 p-3 sm:px-4">
          {error && <div role="alert" className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <span>{archive ? 'Archive refresh failed. Showing the last available daily counts.' : 'Daily submission archive could not load.'}</span>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="font-semibold underline underline-offset-2">Retry archive</button>
          </div>}
          {!archive && !error && <div className="flex h-44 items-center justify-center text-xs text-slate-500" aria-busy="true">Loading daily submissions…</div>}
          {archive && calendar && <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => changeMonth(month - 1)} disabled={month === 1}
                  aria-label="Previous month" className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <label htmlFor="archive-month" className="sr-only">Select month</label>
                <select id="archive-month" value={month} onChange={(event) => changeMonth(Number(event.target.value))}
                  className="min-w-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-gakit-maroon">
                  {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                </select>
                <span className="text-[11px] text-slate-400">{selectedYear}</span>
                <button type="button" onClick={() => changeMonth(month + 1)} disabled={month === 12}
                  aria-label="Next month" className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <p id="archive-keyboard-help" className="sr-only">Use left and right arrows to move one day, up and down to move one week. Select a day for its submission count.</p>
            <div className="grid gap-3 sm:grid-cols-[224px_minmax(0,1fr)] sm:items-start">
            <div role="group" aria-label={`Daily submissions in ${MONTHS[month - 1]} ${selectedYear}`} aria-describedby="archive-keyboard-help"
              onMouseLeave={() => setHoveredDate(null)} className="mx-auto grid w-full max-w-[224px] grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} aria-hidden className="pb-0.5 text-center text-[9px] text-slate-400">{day}</span>)}
              {calendar.cells.map((cell, index) => cell.date ? (
                <button key={cell.date} type="button" data-date={cell.date}
                  ref={(element) => { if (element) buttons.current.set(cell.date!, element); else buttons.current.delete(cell.date!); }}
                  disabled={cell.future} tabIndex={cell.date === activeDate && !cell.future ? 0 : -1}
                  aria-label={`${archiveDateLabel(cell.date)}: ${cell.future ? 'Future date' : `${cell.count} submission${cell.count === 1 ? '' : 's'}`}`}
                  title={`${archiveDateLabel(cell.date)} · ${cell.future ? 'Future date' : `${cell.count} submission${cell.count === 1 ? '' : 's'}`}`}
                  aria-pressed={!cell.future && cell.date === activeDate}
                  onClick={() => setSelectedDate(cell.date)} onFocus={() => setSelectedDate(cell.date)}
                  onMouseEnter={() => setHoveredDate(cell.date)} onKeyDown={(event) => navigate(event, index)}
                  className="aspect-square rounded-md border text-[10px] font-medium outline-offset-2 hover:brightness-95 focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-1 disabled:cursor-default disabled:hover:brightness-100"
                  style={{ background: cell.future ? 'transparent' : ARCHIVE_LEVELS[cell.level].color,
                    color: cell.future ? '#cbd5e1' : cell.level >= 3 ? '#ffffff' : '#475569',
                    borderColor: cell.future || cell.count === 0 ? '#e2e8f0' : 'rgba(15,23,42,0.05)',
                    borderStyle: cell.future ? 'dashed' : 'solid',
                    outline: cell.date === activeDate && !cell.future ? '1px solid #7a0019' : undefined,
                  }}>{Number(cell.date.slice(-2))}</button>
              ) : <span key={`padding-${index}`} aria-hidden />)}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              {upcoming ? <p className="text-sm font-semibold text-slate-500">Upcoming month</p>
                : <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><strong className="text-2xl font-bold leading-none tracking-tight text-slate-900 tabular-nums">{calendar.total.toLocaleString('en-PH')}</strong>
                  <span className="text-[11px] text-slate-500">submissions across {calendar.activeDays} day{calendar.activeDays === 1 ? '' : 's'}</span></p>}
              <p className="text-[11px] text-slate-500" aria-live="polite">
                <span className="font-semibold text-slate-700">{inspected?.date ? archiveDateLabel(inspected.date) : 'No elapsed days in this month'}</span>
                {' · '}{inspected ? inspected.future ? 'Future date' : `${inspected.count} submission${inspected.count === 1 ? '' : 's'} received` : 'Future dates have a dashed border.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[9px] text-slate-500" aria-label="Submissions per day legend">
                <span>Per day</span>
                {ARCHIVE_LEVELS.map((level) => <span key={level.label} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-black/5" style={{ background: level.color }} />{level.label}</span>)}
              </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[9px] text-slate-400">
              <p>Submission volume, including rejected reports · Asia/Manila</p>
              <p className={error ? 'text-amber-700' : ''}>{error ? 'Last available' : 'Updated'} {manilaTime(archive.asOf, true)} PHT</p>
            </div>
            </div>
            </div>
            </div>
            <AnnualSubmissions archive={archive} month={month} onMonthChange={changeMonth} />
          </div>}
        </div>
      )}
    </section>
  );
}
