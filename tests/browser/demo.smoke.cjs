const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-demo-review-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { DemoReportCard } from '@/app/admin/demo/DemoReportCard';
    import { ScenarioMap } from '@/app/flood-scenarios/components/ScenarioMap';
    import { scenarioDisplayStore } from '@/lib/map/scenarioDisplayStore';
    import { demoTime } from '@/lib/demo/reports';
    scenarioDisplayStore.setEnableBuildings(false);
    window.changeBasemap = value => scenarioDisplayStore.setBasemap(value);
    const reports = ['UNVERIFIED','VERIFIED','VERIFIED','VERIFIED','REJECTED','ANOMALY'].map((status,index) => ({
      id:'report-'+index, reporter:12-index, latitude:8.232, longitude:124.243+index*.001,
      depthCm:45, observedAt:demoTime(900), submittedAt:demoTime(index===2 ? 920 : 900),
      gpsAccuracyM:10, blocked:false, depthMethod:'measured', synthetic:true, status,
      validationSummary:{assessedAt:demoTime(900),recommendedStatus:status,
        decisionBasis:status==='VERIFIED' ? 'physical_support' : 'original_observations',
        nearbyModeledWaterM:index===0 ? null : index===2 ? 0 : 31,corroboratingSourceCount:0,
        explanation:'Long raw explanation must not be rendered',
        depthQuality:'measured',support:[],conflicts:[],missing:['NO_INDEPENDENT_CORROBORATION'],
        context:index===0 ? [] : ['NEAR_MODELED_INUNDATION','HEAVY_RAINFALL_CONTEXT']}
    }));
    const reasons=['awaiting_validation','applied','superseded_source','applied_shallow'];
    function Fixture() {
      const [cards,setCards]=useState(reports.slice(0,4));
      return <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 340px',gap:16,padding:16}}>
        <div style={{height:600}}><ScenarioMap scenarioId="demo:fixture" demoReports={reports}
          demoDraftLocation={{latitude:8.2305,longitude:124.247}}
          bounds={[[124.24,8.24],[124.26,8.24],[124.26,8.22],[124.24,8.22]]} /></div>
        <div className="space-y-2">{cards.map((report,index)=><DemoReportCard key={report.id} report={report}
          effect={{reportId:report.id,reason:reasons[index],baselineDepthM:index===1 ? .15 : index===3 ? .06 : null,correctedDepthM:index===1 ? .30 : index===3 ? .16 : null,
            appliedAt:index===1 ? demoTime(900) : undefined,currentDepthM:index===1 ? .22 : undefined,
            acceptedDepthRangeM:index===1 ? [.2,.4] : index===3 ? [0,.3] : undefined,depthUncertaintyAssumed:index===3}}
          minutes={930} analysisMinutes={900} onReplay={()=>window.replayed=true}
          onRemove={()=>setCards(value=>value.filter(item=>item.id!==report.id))} />)}</div>
      </div>;
    }
    createRoot(document.getElementById('root')).render(<Fixture />);
  `);
  let browser;
  try {
    const result = await build({configFile:false,root,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},
      resolve:{alias:[{find:'react',replacement:path.join(root,'node_modules/react')},
        {find:'react-dom',replacement:path.join(root,'node_modules/react-dom')},{find:'@',replacement:root}]},
      plugins:[{name:'demo-fixture',enforce:'pre',
        resolveId(id) {
          if(id==='maplibre-gl') return '\0fixture-maplibre';
          if(id.endsWith('/hooks/useLiveReportObservations')) return '\0fixture-live';
          if(id.endsWith('/lib/map/pmtilesProtocol')) return '\0fixture-protocol';
        },
        load(id) {
          if(id==='\0fixture-maplibre') return 'export class Map extends window.maplibregl.Map { constructor(options) { super(options); window.fixtureMap=this; } }; export const setWorkerUrl=window.maplibregl.setWorkerUrl;';
          if(id==='\0fixture-live') return 'export function useLiveReportObservations() {}';
          if(id==='\0fixture-protocol') return 'export async function ensurePmtilesProtocol(){ window.maplibregl.addProtocol("pmtiles",async()=>({data:new ArrayBuffer(0)})); }';
        },
        transform(source,id) {
          if(!id.replaceAll('\\','/').endsWith('/constants/publicMap.ts')) return;
          return source.replace('light: OPENFREEMAP_STYLE,','light: {version:8,sources:{},layers:[{id:"background",type:"background",paint:{"background-color":"#e2e8f0"}}]},')
            .replace('satellite: SATELLITE_STYLE,','satellite: {version:8,sources:{},layers:[{id:"background",type:"background",paint:{"background-color":"#334155"}}]},');
        }
      }],build:{write:false,minify:false,lib:{entry,formats:['iife'],name:'DemoFixture'}}});
    const bundle=(Array.isArray(result)?result[0]:result).output.find(item=>item.type==='chunk').code;
    browser=await chromium.launch({channel:process.platform === 'win32' ? 'msedge' : undefined,headless:true});
    const page=await browser.newPage({viewport:{width:1200,height:1100}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/__demo-review/page',route=>route.fulfill({contentType:'text/html',body:'<body style="margin:0;font-family:system-ui,sans-serif;background:#f8fafc"><div id="root"></div></body>'}));
    await page.route('**/__demo-review/maplibre/*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'node_modules/maplibre-gl/dist',path.basename(new URL(route.request().url()).pathname)))}));
    await page.goto(`${base}/__demo-review/page`);
    const css=fs.readdirSync(path.join(root,'.next/static/chunks')).filter(file=>file.endsWith('.css'));
    for(const file of css) await page.addStyleTag({path:path.join(root,'.next/static/chunks',file)});
    await page.addStyleTag({path:path.join(root,'node_modules/maplibre-gl/dist/maplibre-gl.css')});
    await page.addScriptTag({type:'module',content:`window.maplibregl=await import(${JSON.stringify(`${base}/__demo-review/maplibre/maplibre-gl.mjs`)})`});
    await page.waitForFunction(()=>window.maplibregl);
    await page.addScriptTag({content:bundle});
    await page.waitForFunction(()=>window.fixtureMap?.getLayer('demo-observation-points'));
    await page.evaluate(()=>window.fixtureMap.jumpTo({center:[124.2455,8.232],zoom:16,bearing:0}));
    await page.waitForFunction(()=>window.fixtureMap.queryRenderedFeatures({layers:['demo-observation-points']}).length===6);
    const pins=await page.evaluate(()=>({type:window.fixtureMap.getLayer('demo-observation-points').type,
      images:['pending','verified','flagged','rejected'].map(status=>window.fixtureMap.hasImage('report-marker-'+status)),
      draft:window.fixtureMap.queryRenderedFeatures({layers:['demo-draft-point']}).length}));
    assert.equal(pins.type,'symbol');assert(pins.images.every(Boolean));assert.equal(pins.draft,1);
    assert.equal(await page.locator('article').count(),4);
    const text=await page.locator('body').innerText();
    assert(!text.includes('Long raw explanation'));assert(!text.includes('No Independent Corroboration'));
    assert(text.includes('At update: 15 → 30 cm'));assert(text.includes('Now at this pin: 22 cm'));
    assert(text.includes('Measurement range: 20–40 cm'));assert(text.includes('Estimated range: 0–30 cm'));
    assert(text.includes('Applied Day 1 · 15:00'));assert(text.includes('Newer nearby report from this person used'));
    assert(text.includes('below the 20 cm map limit'));assert(text.includes('Submitted Day 1 · 15:20'));
    assert.equal(await page.locator('article details[open]').count(),0);
    await page.locator('article summary').first().focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('article details[open]').count(),1);
    await page.getByRole('button',{name:'Replay this time'}).first().click();assert(await page.evaluate(()=>window.replayed));
    await page.locator('article summary').first().click();
    await page.screenshot({path:path.join(os.tmpdir(),'gakit-demo-review.png')});
    await page.evaluate(()=>window.changeBasemap('satellite'));
    await page.waitForFunction(()=>window.fixtureMap.getPaintProperty('background','background-color')==='#334155'
      &&window.fixtureMap.queryRenderedFeatures({layers:['demo-observation-points']}).length===6);
    assert(await page.evaluate(()=>window.fixtureMap.hasImage('report-marker-verified')));
    await page.getByRole('button',{name:'Remove report',exact:true}).first().click();
    assert.equal(await page.locator('article').count(),3);
    await page.setViewportSize({width:390,height:900});
    // Card width mirrors the 340 px demo sidebar; verify it does not overflow.
    const widths=await page.locator('article').evaluateAll(nodes=>nodes.map(node=>({client:node.clientWidth,scroll:node.scrollWidth})));
    assert(widths.every(size=>size.scroll<=size.client));
    assert.deepEqual(errors,[]);
    console.log('Demo browser checks passed: concise cards, separate observation/submission times, keyboard details, replay/remove, all status pins and basemap reload.');
  } finally {
    await browser?.close();fs.unlinkSync(entry);fs.rmdirSync(directory);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
