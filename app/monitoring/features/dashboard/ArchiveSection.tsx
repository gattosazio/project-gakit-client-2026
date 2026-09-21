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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-slate-50/60 md:p-6"
      >
        <span className="flex items-center gap-3">
          <span className="rounded-xl bg-maroon-50 p-2.5 text-gakit-maroon">
            <History className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-bold text-slate-900">Historical volume</span>
            <span className="mt-0.5 block text-sm text-slate-500">
              Monthly report totals · {formattedCount(total)} total in {selectedYear}
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-gakit-maroon"
            >
              {years.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </span>
          <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-5 md:p-6">
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