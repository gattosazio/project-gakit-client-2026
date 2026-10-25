'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ChartNoAxesColumnIncreasing, GripHorizontal, Info, Map as MapIcon, Minus, PieChart, X } from 'lucide-react';
import { useDraggableCard } from '@/hooks/useDraggableCard';
import { STATUS_BANDS, droughtMonthLabel, fetchDroughtFrame, islandOverview, provinceCategory, provinceDistribution, provinceIsland, type DroughtPeriod } from '@/lib/map/drought';
import { droughtPreview } from '@/lib/map/droughtPreview';
import { monthName } from './DroughtTimeline';
import type { DroughtControlState } from './DroughtControls';

const key = (p: DroughtPeriod) => `${p.mode}/${p.month}`;
const provinceTones = [
  { accent: '#94a3b8', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { accent: '#eab308', badge: 'bg-yellow-50 text-yellow-900 ring-yellow-200' },
  { accent: '#f59e0b', badge: 'bg-amber-50 text-amber-900 ring-amber-200' },
  { accent: '#b91c1c', badge: 'bg-red-50 text-red-800 ring-red-200' },
  { accent: '#94a3b8', badge: 'bg-slate-100 text-slate-500 ring-slate-200' },
];

function usePreviews(periods: DroughtPeriod[]) {
  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true, next = 0;
    const worker = async () => {
      while (active && next < periods.length) {
        const period = periods[next++];
        try {
          const grid = await fetchDroughtFrame(period.mode, period.month);
          if (!active) return;
          const image = await droughtPreview(grid);
          if (active) setImages(current => current[key(period)] === image ? current : { ...current, [key(period)]: image });
        } catch { /* Preview failures never block the timeline or main map. */ }
      }
    };
    void worker(); void worker(); // At most two cached API requests at a time.
    return () => { active = false; };
  }, [periods]);
  return images;
}

export function DroughtOverview({ state, periods, onClose }: { state: DroughtControlState; periods: DroughtPeriod[]; onClose: () => void }) {
  const [minimized, setMinimized] = useState(false);
  const [help, setHelp] = useState(false);
  const images = usePreviews(periods);
  const { panelRef, start, move, end, keyMove } = useDraggableCard();
  const grid = state.grid!;
  const mode = grid.mode;
  const bands = STATUS_BANDS;
  const colors = [...bands.map(b => b.color), '#94a3b8'];
  const labels = [...bands.map(b => b.label), 'No data'];
  const provinces = grid.provinces!;
  const counts = useMemo(() => provinceDistribution(provinces, mode), [provinces, mode]);
  const groups = useMemo(() => islandOverview(provinces, mode).map(group => ({ ...group, counts: provinceDistribution(provinces.filter(p => (p.islandGroup ?? provinceIsland(p.id)) === group.name), mode) })), [provinces, mode]);
  const selected = provinces.find(p => p.id === state.province);
  const category = selected ? provinceCategory(selected, mode) : null;
  const provinceTone = provinceTones[category ?? 4];
  const affected = groups.reduce((sum, group) => sum + group.affected, 0);
  const updated = grid.issuedAt;
  return <aside ref={panelRef} aria-label="Drought overview" className="pointer-events-auto absolute right-5 top-24 z-[1010] flex max-h-[calc(100%-12rem)] w-[340px] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur-md lg:w-[360px]">
    <header className="flex shrink-0 items-center gap-1 border-b border-slate-100 px-3 py-2">
      <button type="button" aria-label="Move drought details" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={keyMove} className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 text-left active:cursor-grabbing"><GripHorizontal size={12} className="text-slate-400" /><span className="text-xs font-bold text-slate-800">Drought overview</span></button>
      <button type="button" aria-label="About drought overview" aria-expanded={help} onClick={() => setHelp(v => !v)} className="p-1.5 text-slate-400 hover:text-slate-700"><Info size={12} /></button>
      <button type="button" aria-label={minimized ? 'Expand drought overview' : 'Minimize drought overview'} onClick={() => setMinimized(v => !v)} className="p-1.5 text-slate-400 hover:text-slate-700"><Minus size={12} /></button>
      <button type="button" aria-label="Close drought overview" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X size={12} /></button>
    </header>
    {!minimized && <div className="min-h-0 overflow-y-auto p-3 [scrollbar-width:thin]">
      <div className="flex items-start justify-between gap-2"><div><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{mode === 'observed' ? 'Assessment · observed' : 'Outlook · forecast'}</p><h2 className="mt-0.5 text-lg font-bold text-slate-800">{new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${grid.month}-01T00:00:00Z`))}</h2></div><p className="pt-0.5 text-right text-[9px] leading-4 text-slate-400">Issued<br />{updated ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(updated)) : '—'}</p></div>
      {help && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[10px] leading-4 text-slate-500">Published DOST-PAGASA assessments and outlooks, with status labels preserved. This map shows 82 provinces; PAGASA also reports additional areas, so national totals may differ. Missing records remain unclassified.</p>}
      <section aria-label="Province status distribution" className="my-2.5 overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-rose-50/60">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
          <div role="img" aria-label={`${affected} of ${provinces.length} provinces ${mode === 'observed' ? 'affected' : 'projected affected'}`} className="flex items-center gap-2.5">
            <strong className="shrink-0 text-[30px] font-bold leading-8 tracking-tight tabular-nums text-gakit-maroon">{affected}</strong>
            <div className="flex flex-col gap-0.5"><p className="text-[11px] font-semibold leading-[14px] text-slate-700">{mode === 'observed' ? 'Provinces affected' : 'Projected affected'}</p><p className="text-[10px] leading-3 text-slate-400">of {provinces.length} provinces</p></div>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-gakit-maroon ring-1 ring-rose-100/80"><ChartNoAxesColumnIncreasing size={16} aria-hidden="true" /></span>
        </div>
        <div className="space-y-1.5 px-3 py-2" role="list" aria-label="Province counts by status">
          {counts.map((count, i) => (i < 4 || count > 0) && <div key={labels[i]} role="listitem" aria-label={`${labels[i]}: ${count} provinces`} className="grid grid-cols-[78px_minmax(0,1fr)_22px] items-center gap-2">
            <span className="text-[10px] font-medium text-slate-500">{labels[i]}</span>
            <span aria-hidden="true" className="relative h-3 overflow-hidden rounded-[4px] bg-slate-100/80">
              <span className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(to right, transparent calc(100% - 1px), #cbd5e1 1px)', backgroundSize: '25% 100%' }} />
              <span className="relative block h-full rounded-[4px]" style={{ width: `${provinces.length ? count / provinces.length * 100 : 0}%`, backgroundColor: colors[i], boxShadow: 'inset 0 0 0 1px rgb(100 116 139 / 20%)' }} />
            </span>
            <strong className="text-right text-[11px] font-bold tabular-nums text-slate-800">{count}</strong>
          </div>)}
        </div>
      </section>
      {selected && <section aria-label="Province drought details" className="relative mb-2 overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/80"><MapIcon size={15} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h3 className="text-xs font-bold leading-4 text-slate-800">{selected.name}</h3><p className="mt-0.5 text-[9px] text-slate-400">{selected.islandGroup ?? provinceIsland(selected.id)}</p></div>
          <button type="button" aria-label="Close province drought details" onClick={state.dismissProvince} className="self-start rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={11} /></button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${provinceTone.badge}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: provinceTone.accent }} />{category === null ? 'No data' : bands[category].label}</span>
          <p className="text-right text-[8px] leading-3 text-slate-400"><span className="block font-medium text-slate-500">DOST-PAGASA</span>{mode === 'observed' ? 'Assessment' : 'Outlook'}</p>
        </div>
        {category === null && <p className="mt-1.5 text-[9px] text-slate-400">No published status for this province.</p>}
        {selected.sourceName && selected.sourceName !== selected.name && <p className="mt-1.5 text-[9px] text-slate-400">Source: {selected.sourceName}</p>}
      </section>}
      {(['observed', 'forecast'] as const).map(product => <section key={product} aria-label={`${product} drought previews`} className="mb-2"><h3 className={`mb-1 text-[9px] font-semibold uppercase ${product === 'forecast' ? 'text-cyan-600' : 'text-slate-400'}`}>{product}</h3><div className="grid grid-cols-6 gap-1">{periods.filter(p => p.mode === product).map(period => {
        const active = period.mode === state.mode && period.month === state.month;
        return <button type="button" key={key(period)} aria-label={`Preview ${droughtMonthLabel(period.month)} ${period.mode}`} aria-pressed={active} onClick={() => state.selectPeriod(period.mode, period.month)} className={`flex min-w-0 flex-col items-center rounded-md border py-1 ${active ? 'border-gakit-maroon bg-rose-50' : 'border-transparent hover:bg-slate-50'}`}>
          {images[key(period)] ? <Image src={images[key(period)]} unoptimized alt="" width={44} height={72} className="h-[58px] w-9 object-contain" /> : <div className="flex h-[58px] w-9 items-center justify-center text-slate-200"><PieChart size={16} /></div>}
          <span className={`mt-1 text-[9px] ${active ? 'font-bold text-gakit-maroon' : 'text-slate-400'}`}>{monthName(period.month)}</span></button>;
      })}</div></section>)}
      <section aria-label="Drought island summaries" className="mt-2 border-t border-slate-100 pt-2"><div className="mb-1.5 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700">By island group</h3><span className="rounded bg-slate-100 px-1.5 py-1 text-[8px] text-slate-400">Published status</span></div>{groups.map(group => <div key={group.name} className="mb-2"><p className="mb-1 flex items-center gap-1.5 text-[10px]"><strong className="text-slate-700">{group.name}</strong><span className="text-slate-400">{group.affected} of {group.total} {mode === 'observed' ? 'affected' : 'projected affected'}</span></p><div className="flex h-3.5 overflow-hidden rounded-md bg-slate-100">{group.counts.map((count, i) => count > 0 && <span key={i} className="flex min-w-0 items-center justify-center overflow-hidden border-r border-white/80 text-[8px] font-semibold last:border-0" title={`${labels[i]}: ${count}`} style={{ width: `${count / group.total * 100}%`, backgroundColor: colors[i], color: i === 3 ? '#fff' : '#475569' }}>{count}</span>)}</div></div>)}</section>
      <footer className="mt-2 border-t border-slate-100 pt-2 text-[9px] leading-4 text-slate-400"><a href="https://droughtcaster.pagasa.dost.gov.ph/" target="_blank" rel="noreferrer">DOST-PAGASA</a> · <a href="/data/phl-drought-provinces-LICENSE.txt" target="_blank" rel="noreferrer" className="underline">Boundaries</a></footer>
    </div>}
  </aside>;
}
