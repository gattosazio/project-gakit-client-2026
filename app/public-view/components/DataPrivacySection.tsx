import { AlertTriangle, Database, ExternalLink, ShieldCheck } from 'lucide-react';

export function DataPrivacySection() {
  return (
    <div className="mt-10 sm:mt-12 lg:mt-14">
      {/* ── Top: two equal cards — no lopsided column ── */}
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col rounded-[22px] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] transform-gpu transition-[transform,box-shadow] duration-200 ease-out hover:shadow-[0_16px_40px_rgba(0,0,0,0.16)] sm:rounded-[28px] sm:p-7 lg:p-8 md:hover:scale-[1.015] motion-reduce:transition-none motion-reduce:hover:transform-none">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-gakit-maroon ring-1 ring-rose-100">
              <ShieldCheck className="h-[22px] w-[22px]" />
            </div>
            <div className="min-w-0">
              <div className="font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-gakit-maroon/75">Citizen Data Protection</div>
              <h3 className="mt-1 font-heading text-[16px] font-bold leading-tight text-slate-900 sm:text-[17px]">
                <a
                  href="https://privacy.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-gakit-maroon"
                >
                  Data Privacy Act of 2012 (RA 10173)
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </a>
              </h3>
            </div>
          </div>
          <ul className="mt-6 space-y-4">
            <li className="flex gap-3">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gakit-maroon" />
              <p className="text-[13.5px] leading-6 text-slate-600">
                <span className="font-semibold text-slate-900">Collected observation data:</span> GPS coordinates, flood waterline depths, and physical landmark reference presets.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gakit-maroon" />
              <p className="text-[13.5px] leading-6 text-slate-600">
                <span className="font-semibold text-slate-900">Disaster response purpose:</span> Shared with the{' '}
                <a
                  href="https://iligan.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gakit-maroon underline decoration-rose-200 underline-offset-2 hover:text-maroon-800"
                >
                  Iligan City CDRRMO
                </a>{' '}
                for life-safety verification and rescue dispatch.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gakit-maroon" />
              <p className="text-[13.5px] leading-6 text-slate-600">
                <span className="font-semibold text-slate-900">Public anonymity:</span> Map markers and feeds are anonymized. No personal contact information is displayed.
              </p>
            </li>
          </ul>
        </div>

        <div className="flex flex-col rounded-[22px] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] transform-gpu transition-[transform,box-shadow] duration-200 ease-out hover:shadow-[0_16px_40px_rgba(0,0,0,0.16)] sm:rounded-[28px] sm:p-7 lg:p-8 md:hover:scale-[1.015] motion-reduce:transition-none motion-reduce:hover:transform-none">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <AlertTriangle className="h-[22px] w-[22px]" />
            </div>
            <div className="min-w-0">
              <div className="font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700/80">Official Directive Notice</div>
              <h3 className="mt-1 font-heading text-[16px] font-bold leading-tight text-slate-900 sm:text-[17px]">Emergency &amp; Advisory Disclaimer</h3>
            </div>
          </div>
          <p className="mt-6 text-[13.5px] leading-7 text-slate-600">
            Project GAKIT is an applied academic and civic disaster-risk reduction platform developed at{' '}
            <a href="https://www.msuiit.edu.ph" target="_blank" rel="noopener noreferrer" className="font-semibold text-gakit-maroon hover:underline">
              MSU-IIT
            </a>
            . Official emergency warnings, flood alarm levels, and mandatory evacuation orders remain under the sole authority of the{' '}
            <a href="https://iligan.gov.ph" target="_blank" rel="noopener noreferrer" className="font-semibold text-gakit-maroon hover:underline">
              Iligan City Government and CDRRMO
            </a>
            .
          </p>
          <div className="mt-auto pt-6">
            <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200/70">
              <p className="flex items-center gap-2 font-heading text-[11px] font-bold uppercase tracking-wide text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> In an emergency, follow official channels
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Full-width attribution bento — grid, not stacked list ── */}
      <div className="mt-5 overflow-hidden rounded-[22px] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] transform-gpu transition-[transform,box-shadow] duration-200 ease-out hover:shadow-[0_16px_40px_rgba(0,0,0,0.16)] sm:mt-6 sm:rounded-[28px] md:hover:scale-[1.01] motion-reduce:transition-none motion-reduce:hover:transform-none">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="hidden h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white sm:flex">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-gakit-maroon/75">Attribution &amp; Provenance</div>
                <h3 className="mt-1 font-heading text-[17px] font-bold tracking-tight text-slate-900">Open Data &amp; Meteorological Sources</h3>
                <p className="mt-1 max-w-[48ch] text-[13px] leading-5 text-slate-500">Authoritative providers that power hazard, weather, and terrain layers.</p>
              </div>
            </div>
            <span className="inline-flex h-7 items-center rounded-full bg-slate-900 px-3 font-heading text-[10px] font-bold uppercase tracking-widest text-white">6 sources</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          <div className="border-b border-slate-100 p-6 sm:border-r lg:p-7">
            <div className="flex items-center justify-between gap-2">
              <a href="https://www.panahon.gov.ph" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                DOST-PAGASA (PANaHON)
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 font-heading text-[10px] font-bold tracking-wide text-gakit-maroon ring-1 ring-rose-200/60">Public Domain</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">Official cyclone bulletins, severe weather advisories, and rainfall warnings (RA 8293 §176).</p>
          </div>
          <div className="border-b border-slate-100 p-6 lg:border-r lg:p-7">
            <div className="flex items-center justify-between gap-2">
              <a href="https://open-meteo.com/en/docs/ecmwf-api" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                ECMWF (IFS HRES 9km)
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Weather</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">9 km global NWP with hourly precipitation, wind and temperature via Open-Meteo.</p>
          </div>
          <div className="border-b border-slate-100 p-6 sm:border-r lg:border-r-0 lg:p-7">
            <div className="flex items-center justify-between gap-2">
              <a href="https://noah.upd.edu.ph" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                Project NOAH (UP RI)
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Geohazards</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">100-year flood hazard, landslide susceptibility, and storm surge inundation models (SSA #1–#4) for Iligan City and Lanao del Norte.</p>
          </div>
          <div className="border-b border-slate-100 p-6 sm:border-b-0 sm:border-r lg:border-b-0 lg:border-r lg:p-7">
            <div className="flex items-center justify-between gap-2">
              <a href="https://www.jma.go.jp/jma/indexe.html" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                JMA Himawari-9
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Satellite</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">10-minute infrared / Band-13 geostationary cloud radiance and storm monitoring.</p>
          </div>
          <div className="border-b border-slate-100 p-6 sm:border-b-0 lg:border-b-0 lg:border-r lg:p-7">
            <div className="flex items-center justify-between gap-2">
              <a href="https://sharaku.eorc.jaxa.jp/GSMaP/" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                JAXA GSMaP
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Precipitation</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">Global Satellite Mapping of Precipitation with hourly spaceborne rainfall estimates.</p>
          </div>
          <div className="p-6 lg:p-7">
            <div className="flex items-center justify-between gap-2">
              <a href="https://data.bris.ac.uk/data/dataset/25wfy0f9ukxaa2rn5wgahxp17u" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                FABDEM V1-2
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Elevation</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">30 m Bare-Earth Digital Terrain Model with forests and buildings removed for accurate hydrodynamic modeling.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
