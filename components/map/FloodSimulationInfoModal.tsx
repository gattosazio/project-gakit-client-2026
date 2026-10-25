'use client';

import { Waves, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

export function FloodSimulationInfoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <Dialog isOpen={isOpen} onClose={onClose} ariaLabel="About Flood Simulation" maxWidthClass="max-w-2xl" panelClassName="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0">
    <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4">
      <span className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><Waves size={20} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h2 className="text-base font-bold text-slate-900">About Flood Simulation</h2><p className="mt-0.5 text-[11px] text-slate-500">Rainfall-based estimates for Iligan City</p></div>
      <button type="button" aria-label="Close simulation details" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={17} /></button>
    </header>
    <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-xs leading-5 text-slate-600">
      <section><h3 className="mb-1 font-bold text-slate-900">What it does</h3><p>Estimates flood extent and depth in Iligan City from rainfall and terrain. The map summarizes estimated flooded area and maximum model depth.</p></section>
      <section><h3 className="mb-1 font-bold text-slate-900">How it works</h3><p>An eight-channel U-Net neural network combines seven terrain inputs with rainfall. It is trained on NOAH 5-, 25- and 100-year hazard maps. Live frames use complete, rolling 24-hour rainfall totals; Explorer presets use stored historical or hypothetical rainfall.</p></section>
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3"><h3 className="mb-2 font-bold text-slate-900">Reading the timeline</h3><dl className="grid gap-2 sm:grid-cols-3"><div><dt className="font-bold text-slate-700">Past</dt><dd>Historical rainfall.</dd></div><div><dt className="font-bold text-emerald-700">Live</dt><dd>Latest complete rainfall window.</dd></div><div><dt className="font-bold text-amber-800">Forecast</dt><dd>Observed and forecast rainfall.</dd></div></dl><p className="mt-2 border-t border-slate-200 pt-2">These labels describe rainfall inputs. Each flood frame is estimated independently; playback does not track water moving between hours.</p></section>
      <section><h3 className="mb-1 font-bold text-slate-900">Limits</h3><p>The model has no evolving water state or river routing. Flood arrival, drainage, recession and exact depths have not been independently validated. Estimates are not confirmed flood conditions or official warnings.</p></section>
      <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold text-slate-700">Technical details</summary><dl className="mt-3 space-y-3 text-[11px]">
        <div><dt className="font-bold text-slate-800">Rainfall inputs</dt><dd>Live rainfall is sampled at a single point in Iligan City. JAXA GSMaP supplies observations; available JAXA nowcasts and Open-Meteo forecasts supply future hours. Missing rainfall makes the estimate unavailable.</dd></div>
        <div><dt className="font-bold text-slate-800">Terrain inputs</dt><dd>Elevation, slope, height above drainage, topographic wetness, flow accumulation, imperviousness and surface roughness.</dd></div>
        <div><dt className="font-bold text-slate-800">Training references</dt><dd>NOAH hazard classes become 0.30, 1.00 and 2.50 m proxy depths. Wet rainfall anchors are 110.4, 148.2 and 179.4 mm, with an assumed dry baseline. These are training references, not measured depths or validated local rainfall thresholds.</dd></div>
        <div><dt className="font-bold text-slate-800">Map and report handling</dt><dd>The flood footprint starts at 0.2 m. Eligible community reports may appear separately. Experimental local corrections, when enabled, affect the latest estimate only and do not propagate into forecasts.</dd></div>
      </dl></details>
      <p className="text-[11px] text-slate-500">For safety decisions, follow DOST-PAGASA advisories and instructions from local authorities.</p>
    </div>
    <footer className="flex shrink-0 items-center justify-end border-t border-slate-100 px-5 py-3"><button type="button" onClick={onClose} className="rounded-xl bg-gakit-maroon px-5 py-2.5 text-xs font-bold text-white hover:bg-gakit-maroon-light">Got it</button></footer>
  </Dialog>;
}
