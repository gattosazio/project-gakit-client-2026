import Image from 'next/image';
import { AlertTriangle, Database, ExternalLink, ShieldCheck } from 'lucide-react';

const mapCredits = [
  { name: 'OpenStreetMap', logo: '/images/openstreetmap-logo.svg', url: 'https://www.openstreetmap.org/copyright', description: 'Basemap data, building footprints, and road lookup.', license: 'ODbL 1.0', licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/' },
  { name: 'Overture Maps', logo: '/images/overture-maps-logo.png', url: 'https://overturemaps.org/', description: 'Road overlays, place search, and landmarks.', license: 'Licenses & credits', licenseUrl: 'https://docs.overturemaps.org/attribution/' },
  { name: 'OpenFreeMap', logo: '/images/openfreemap-logo.jpg', url: 'https://openfreemap.org/', description: 'Light, Bright, and Dark street basemaps.', license: '© OpenMapTiles', licenseUrl: 'https://openmaptiles.org/' },
];

export function DataPrivacySection() {
  return (
    <div className="mt-10 sm:mt-12 lg:mt-14">
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col rounded-[22px] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] transform-gpu transition-[transform,box-shadow] duration-200 ease-out hover:shadow-[0_16px_40px_rgba(0,0,0,0.16)] sm:rounded-[28px] sm:p-7 lg:p-8 md:hover:scale-[1.015] motion-reduce:transition-none motion-reduce:hover:transform-none">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-gakit-maroon ring-1 ring-rose-100">
              <ShieldCheck className="h-[22px] w-[22px]" />
            </div>
            <div className="min-w-0">
              <div className="font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-gakit-maroon/75">Your Privacy</div>
              <h3 className="mt-1 font-heading text-[16px] font-bold leading-tight text-slate-900 sm:text-[17px]">
                <a
                  href="https://privacy.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-gakit-maroon"
                >
                  Data Privacy Act (RA 10173)
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </a>
              </h3>
            </div>
          </div>
          <ul className="mt-6 space-y-4">
            <li className="flex gap-3">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gakit-maroon" />
              <p className="text-[13.5px] leading-6 text-slate-600">
                <span className="font-semibold text-slate-900">We collect:</span> Report locations, flood depths, and landmark references.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gakit-maroon" />
              <p className="text-[13.5px] leading-6 text-slate-600">
                <span className="font-semibold text-slate-900">Purpose:</span> Shared with{' '}
                <a
                  href="https://iligan.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gakit-maroon underline decoration-rose-200 underline-offset-2 hover:text-maroon-800"
                >
                  Iligan City CDRRMO
                </a>{' '}
                for verification and rescue coordination.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gakit-maroon" />
              <p className="text-[13.5px] leading-6 text-slate-600">
                <span className="font-semibold text-slate-900">Public reports:</span> Map markers and feeds hide identities and contact details.
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
              <div className="font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700/80">Safety</div>
              <h3 className="mt-1 font-heading text-[16px] font-bold leading-tight text-slate-900 sm:text-[17px]">Follow Official Advisories</h3>
            </div>
          </div>
          <p className="mt-6 text-[13.5px] leading-7 text-slate-600">
            GAKIT is a research project at{' '}
            <a href="https://www.msuiit.edu.ph" target="_blank" rel="noopener noreferrer" className="font-semibold text-gakit-maroon hover:underline">
              MSU-IIT
            </a>
            . For official warnings and evacuation orders, follow{' '}
            <a href="https://iligan.gov.ph" target="_blank" rel="noopener noreferrer" className="font-semibold text-gakit-maroon hover:underline">
              Iligan City Government and CDRRMO
            </a>
            .
          </p>
          <div className="mt-auto pt-6">
            <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200/70">
              <p className="flex items-center gap-2 font-heading text-[11px] font-bold uppercase tracking-wide text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Use official emergency channels
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[22px] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] transform-gpu transition-[transform,box-shadow] duration-200 ease-out hover:shadow-[0_16px_40px_rgba(0,0,0,0.16)] sm:mt-6 sm:rounded-[28px] md:hover:scale-[1.01] motion-reduce:transition-none motion-reduce:hover:transform-none">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="hidden h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white sm:flex">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-gakit-maroon/75">Attribution</div>
                <h3 className="mt-1 font-heading text-[17px] font-bold tracking-tight text-slate-900">Data Sources</h3>
                <p className="mt-1 max-w-[48ch] text-[13px] leading-5 text-slate-500">Hazard, weather, climate, and map data.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          <div className="border-b border-slate-100 p-6 sm:border-r lg:p-7">
            <Image src="/images/pagasa-logo.png" alt="DOST-PAGASA logo" width={96} height={64} className="mb-3 h-10 w-20 object-contain object-left" />
            <div className="flex items-center justify-between gap-2">
              <a href="https://www.panahon.gov.ph" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                DOST-PAGASA
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 font-heading text-[10px] font-bold tracking-wide text-gakit-maroon ring-1 ring-rose-200/60">Weather &amp; Climate</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">Cyclone bulletins, rainfall warnings, advisories, and{' '}
              <a href="https://droughtcaster.pagasa.dost.gov.ph/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gakit-maroon">provincial drought assessments and six-month outlooks</a>.</p>
          </div>
          <div className="border-b border-slate-100 p-6 lg:border-r lg:p-7">
            <Image src="/images/open-meteo-logo.png" alt="Open-Meteo logo" width={96} height={64} className="mb-3 h-10 w-20 object-contain object-left" />
            <div className="flex items-center justify-between gap-2">
              <a href="https://open-meteo.com/en/docs" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                ECMWF IFS · Open-Meteo
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Weather</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">Temperature, wind, and rainfall forecasts for Iligan City, plus nationwide heat-index estimates.</p>
          </div>
          <div className="border-b border-slate-100 p-6 sm:border-r lg:border-r-0 lg:p-7">
            <Image src="/images/noah_logo.png" alt="Project NOAH logo" width={96} height={64} className="mb-3 h-10 w-20 object-contain object-left" />
            <div className="flex items-center justify-between gap-2">
              <a href="https://noah.upd.edu.ph" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                UP NOAH
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Geohazards</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">Flood, landslide, and storm-surge hazard maps for Iligan City and nearby areas.</p>
          </div>
          <div className="border-b border-slate-100 p-6 sm:border-b-0 sm:border-r lg:border-b-0 lg:border-r lg:p-7">
            <Image src="/images/japan_meteorological_agency_logo.jpg" alt="Japan Meteorological Agency logo" width={96} height={64} className="mb-3 h-10 w-20 object-contain object-left" />
            <div className="flex items-center justify-between gap-2">
              <a href="https://rammb-slider.cira.colostate.edu/?sat=himawari&sec=full_disk&p[]=band_13" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                Himawari-9 · CIRA SLIDER
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Satellite</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">JMA infrared imagery via CIRA SLIDER, updated every 10 minutes to track clouds and storms.</p>
          </div>
          <div className="border-b border-slate-100 p-6 sm:border-b-0 lg:border-b-0 lg:border-r lg:p-7">
            <Image src="/images/jaxa-logo.png" alt="JAXA logo" width={96} height={64} className="mb-3 h-10 w-20 object-contain object-left" />
            <div className="flex items-center justify-between gap-2">
              <a href="https://sharaku.eorc.jaxa.jp/GSMaP/" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                JAXA GSMaP
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Precipitation</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">Hourly satellite rainfall and short-range nowcasts for rainfall totals and live flood estimates.</p>
          </div>
          <div className="p-6 lg:p-7">
            <Image src="/images/DREAM-Logo.png" alt="UP DREAM logo" width={96} height={64} className="mb-3 h-10 w-20 object-contain object-left" />
            <div className="flex items-center justify-between gap-2">
              <a href="https://dream.upd.edu.ph" target="_blank" rel="noopener noreferrer" className="group/link inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                UP DREAM LiDAR
                <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-gakit-maroon" />
              </a>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">Elevation</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">10 m terrain data for elevation, drainage, and flood simulation.</p>
          </div>
        </div>
        <section aria-labelledby="map-search-credits" className="border-t border-slate-100 px-6 py-6 sm:px-7 lg:px-8">
          <h3 id="map-search-credits" className="font-heading text-[15px] font-bold text-slate-900">Map &amp; Search Credits</h3>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {mapCredits.map(source => <div key={source.name}>
              <Image src={source.logo} alt={`${source.name} logo`} width={64} height={64} className="mb-3 h-10 w-10 object-contain" />
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-heading text-[13.5px] font-bold text-slate-900 hover:text-gakit-maroon">
                {source.name}<ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
              </a>
              <p className="mt-2 text-[13px] leading-6 text-slate-600">{source.description}</p>
              <a href={source.licenseUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900">{source.license}</a>
            </div>)}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">
            <p>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-900">OpenStreetMap contributors</a> · Overture Maps Foundation · <a href="/data/iligan-roads.json" download className="underline underline-offset-2 hover:text-slate-900">Download road data</a></p>
            <p>Satellite imagery © <a href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-900">Esri, Maxar, Earthstar Geographics</a> · Terrain © <a href="https://mapterhorn.com/attribution/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-900">Mapterhorn</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
