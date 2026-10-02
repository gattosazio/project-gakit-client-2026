'use client';

import { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';

interface ArchiveSectionProps {
  monthly: Array<{ month: string; reports: number }>;
  years: string[];
  selectedYear: string;
  onYearChange: (year: string) => void;
}


export function ArchiveSection({
  monthly,
  years,
  selectedYear,
  onYearChange,
}: ArchiveSectionProps) {
  const [open, setOpen] = useState(false);
  const total = monthly.reduce((sum, item) => sum + item.reports, 0);
  const maxReports = Math.max(1, ...monthly.map((item) => item.reports));

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50/60 sm:p-5"
      >
        <span className="flex items-center gap-3">
          <span className="rounded-lg bg-maroon-50 p-2 text-gakit-maroon">
            <History className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-900 sm:text-base">Annual Submission Archive</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Monthly submission trends · {formattedCount(total)} total in {selectedYear}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span
            onClick={(event) => event.stopPropagation()}
            className="flex items-center gap-2"
          >
            <label htmlFor="archive-year" className="sr-only">
              Select year
            </label>
            <select
              id="archive-year"
              value={selectedYear}
              onChange={(event) => onYearChange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-gakit-maroon"
            >
              {years.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
          <div className="dashboard-bar-chart">
            {monthly.map((item) => (
              <div key={item.month} className="dashboard-bar-item">
                <div className="dashboard-bar-value">{item.reports}</div>
                <div
                  className="dashboard-bar"
                  style={{ height: `${Math.max(12, (item.reports / maxReports) * 100)}%` }}
                  title={`${item.month} ${selectedYear}: ${item.reports} reports`}
                />
                <div className="dashboard-bar-label">{item.month}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function formattedCount(value: number): string {
  return value.toLocaleString('en-PH');
}