import type { ReportArchive } from '@/types/dashboard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AnnualSubmissions({ archive, month, onMonthChange }: {
  archive: ReportArchive;
  month: number;
  onMonthChange: (month: number) => void;
}) {
  const counts = Array<number>(12).fill(0);
  for (const day of archive.days) {
    if (day.date <= archive.today) counts[Number(day.date.slice(5, 7)) - 1] += day.count;
  }
  const maximum = Math.max(1, ...counts);
  const total = counts.reduce((sum, count) => sum + count, 0);

  return (
    <div className="min-w-0 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-700">Annual submissions <span className="font-normal text-slate-400">{archive.year}</span></h3>
        <p className="text-[10px] text-slate-500"><strong className="font-semibold text-slate-700">{total.toLocaleString('en-PH')}</strong> received</p>
      </div>
      <div className="mt-3 grid grid-cols-12 gap-1" role="group" aria-label={`Monthly submission totals in ${archive.year}`}>
        {MONTHS.map((label, index) => {
          const count = counts[index];
          const future = `${archive.year}-${String(index + 1).padStart(2, '0')}-01` > archive.today;
          const selected = month === index + 1;
          return (
            <button key={label} type="button" onClick={() => onMonthChange(index + 1)}
              aria-pressed={selected}
              aria-label={`${label} ${archive.year}: ${future ? 'Upcoming month' : `${count} submissions`}. View daily archive.`}
              title={`${label}: ${future ? 'Upcoming month' : `${count.toLocaleString('en-PH')} submissions`}`}
              className="group min-w-0 rounded px-0.5 py-1 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-gakit-maroon">
              <span aria-hidden className="flex h-32 items-end justify-center border-b border-slate-200">
                <span className={`block w-full max-w-6 rounded-t-sm ${future ? 'border border-dashed border-slate-200' : selected ? 'bg-gakit-maroon' : 'bg-rose-200 group-hover:bg-rose-300'}`}
                  style={{ height: future || count === 0 ? 3 : Math.max(4, (count / maximum) * 100) + '%' }} />
              </span>
              <span aria-hidden className={`mt-1.5 block text-[9px] ${selected ? 'font-semibold text-gakit-maroon' : future ? 'text-slate-300' : 'text-slate-500'}`}>{label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[9px] text-slate-400">{total === 0 ? 'No submissions recorded for this year. ' : ''}Select a month to view its daily archive.</p>
    </div>
  );
}
