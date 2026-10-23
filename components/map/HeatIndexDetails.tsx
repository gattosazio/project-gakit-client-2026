import { HEAT_INDEX_BANDS, HEAT_INDEX_GRADIENT, HEAT_INDEX_HOURS, type HeatIndexGrid, type HeatIndexHour } from '@/lib/map/heatIndex';
import { RotateCwFadingClock } from 'lucide-react';

export interface HeatIndexControlState {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  hour: HeatIndexHour;
  setHour: (hour: HeatIndexHour) => void;
  grid: HeatIndexGrid | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const formatTime = (stamp: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric',
}).format(new Date(stamp));

export function HeatIndexDetails({ state }: { state: HeatIndexControlState }) {
  return (
    <div className="pl-10 pt-0.5 pb-1 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1 flex items-center justify-between gap-2">
        <span className="shrink-0">Forecast time</span>
        {state.grid && <span aria-live="polite" className="normal-case tracking-normal font-medium text-right">
          Valid {formatTime(state.grid.validAt)} PHT
        </span>}
      </div>
      <div role="group" aria-label="Heat-index forecast hour" className="grid grid-cols-5 gap-1">
        {HEAT_INDEX_HOURS.map((hour) => (
          <button key={hour} type="button" aria-pressed={state.hour === hour}
            onClick={() => state.setHour(hour)}
            className={`rounded-lg py-1 text-xs font-bold tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 ${state.hour === hour ? 'bg-gakit-maroon text-white shadow-[0_2px_4px_rgba(123,17,19,0.35)] ring-1 ring-gakit-maroon' : 'bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/90 hover:bg-slate-50 hover:text-slate-900'}`}>
            {hour === 0 ? 'Now' : `+${hour}h`}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="text-[10px] leading-4 text-slate-600">
        {state.loading && !state.grid && <p>Loading heat-index forecast…</p>}
        {state.error && <div role="status" className="space-y-1">
          <p>{state.error}</p>
          <button type="button" onClick={state.retry} disabled={state.loading}
            className="rounded text-gakit-maroon underline underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon disabled:opacity-50">Try again</button>
        </div>}
        {state.grid?.stale && <p className="text-amber-800">Using an earlier forecast. Update pending.</p>}
      </div>
      {state.grid && <div className="flex items-center gap-1 pt-1 text-[10px] leading-snug text-slate-400">
        <RotateCwFadingClock className="h-3 w-3 shrink-0 text-sky-500" />
        <span>ECMWF IFS · 3-hour refresh</span>
      </div>}
      <div aria-label="Heat index in degrees Celsius" className="pt-1 w-full">
        <div className="flex items-center gap-1.5 w-full">
          <div className="h-2.5 flex-1 rounded-full" aria-hidden="true" style={{ background: HEAT_INDEX_GRADIENT }} />
          <span className="text-[10px] font-semibold text-slate-500 shrink-0">°C</span>
        </div>
        <div className="flex w-full justify-between text-[9px] tabular-nums text-slate-500 mt-1">
          {HEAT_INDEX_BANDS.map((band) => <span key={band.label} className="font-semibold text-slate-600">{band.label.replace('°', '')}</span>)}
        </div>
      </div>
    </div>
  );
}
