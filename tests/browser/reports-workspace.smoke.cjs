// Real shell, report components and MapLibre renderer; service data and basemap tiles are fixtures.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

// MapLibre projection round trips may change coordinates by fractions of a
// millimetre. Reject visible camera movement without requiring bit equality.
function assertCameraUnchanged(actual, expected, message) {
  for (const [key, value] of Object.entries(expected)) {
    if (Array.isArray(value)) {
      value.forEach((coordinate, index) => assert(Math.abs(actual[key][index] - coordinate) < 1e-9, message + ': ' + key));
    } else if (key === 'width' || key === 'height') {
      assert.equal(actual[key], value, message + ': ' + key);
    } else {
      assert(Math.abs(actual[key] - value) < 1e-9, message + ': ' + key);
    }
  }
}

(async () => {
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths:[root] })).href);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-workspace-'));
  const entry = path.join(directory, 'entry.jsx');
  const screenshots = process.env.GAKIT_WORKSPACE_SCREENSHOTS;
  if (screenshots) fs.mkdirSync(screenshots, { recursive:true });
  fs.writeFileSync(entry, `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {MonitoringShell} from '@/app/monitoring/MonitoringShell';
    import '@/app/globals.css';
    import {buildReportsGeoJson} from '@/lib/map/reportMarkers';
    window.bubbleFixture=()=>{ const items=window.records.slice(0,4).map((r,i)=>({type:'Feature',geometry:{type:'Point',coordinates:[124.24+([-0.003,0,0,0.003][i]),8.23]},properties:{...r,depthCm:i===1?null:159,status:i===0?'VERIFIED':i===3?'REJECTED':'UNVERIFIED',address:'Report '+i}}));window.maps[0].getSource('reports').setData(buildReportsGeoJson(items,{UNVERIFIED:true,VERIFIED:true,ANOMALY:true,REJECTED:true}));};
    window.requests=[];window.decisions=[];window.maps=[];
    window.records=Array.from({length:60},(_,index)=>({
      id:'report-'+String(index).padStart(8,'0'),
      location:{latitude:8.23+index*.0001,longitude:124.24,address:'Quezon Avenue '+index+', Poblacion, Iligan City'},
      depth:{code:index===0?'head':'knee',label:index===0?'Head':'Knee',approximateCm:index===0?159:45},depthCm:index===1?null:index===0?159:45,reference:'adult',reporterType:'public',
      observedAt:new Date().toISOString(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      status:index===0?'UNVERIFIED':'REJECTED',decisionSource:'automated',validationSummary:{assessedAt:new Date().toISOString(),
        recommendedStatus:index===0?'UNVERIFIED':'REJECTED',checkState:index===0?'review_required':'complete',corroboratingSourceCount:0,
        depthQuality:'estimated',support:[],conflicts:['CURRENT_CONDITIONS_UNSUPPORTED'],missing:[],context:[]}
    }));
    createRoot(document.getElementById('root')).render(<MonitoringShell/>);
  `);
  let browser;
  try {
    const result = await build({configFile:false,root,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},
      resolve:{alias:[{find:'react',replacement:path.join(root,'node_modules/react')},{find:'react-dom',replacement:path.join(root,'node_modules/react-dom')},{find:'@',replacement:root}]},
      plugins:[{name:'workspace-fixture',enforce:'pre',
        resolveId(id) {
          if(id==='next/dynamic')return '\0dynamic';
          if(id==='next/navigation')return '\0navigation';
          if(id==='next/link')return '\0link';
          if(id==='maplibre-gl')return '\0maplibre';
          if(id.endsWith('/components/SideBar'))return '\0sidebar.jsx';
          if(id.endsWith('/components/AdminHeader'))return '\0header.jsx';
          if(id.endsWith('/components/WeatherAlertModal'))return '\0alertmodal';
          if(id.endsWith('/dashboard/DashboardOverview'))return '\0dashboard.jsx';
          if(id.endsWith('/alerts/AlertsTab'))return '\0alerts.jsx';
          if(id.endsWith('/actions/reports'))return '\0reports';
          if(id.endsWith('/lib/map/pmtilesProtocol'))return '\0protocol';
        },
        load(id) {
          if(id==='\0dynamic')return `import React,{useEffect,useState} from 'react';export default function dynamic(loader,options={}){return function Dynamic(props){const [Component,setComponent]=useState(null);useEffect(()=>{let live=true;loader().then(m=>{if(live)setComponent(()=>m.default||m)});return()=>{live=false}},[]);return Component?React.createElement(Component,props):options.loading?React.createElement(options.loading):null}}`;
          if(id==='\0navigation')return 'export function useSearchParams(){return new URLSearchParams(location.search)};export function usePathname(){return "/monitoring"};const router={push:()=>{},prefetch:()=>{}};export function useRouter(){return router}';
          if(id==='\0link')return `import React from 'react';export default React.forwardRef(function Link({href,children,...props},ref){return React.createElement('a',{href,ref,...props},children)});`;
          if(id==='\0sidebar.jsx')return `import React from 'react';export function SideBar({onTabChange}){return <aside aria-label="App sidebar" className="hidden w-64 shrink-0 lg:block">{['dashboard','reports','alerts'].map(tab=><button key={tab} onClick={()=>onTabChange(tab)}>{tab}</button>)}</aside>}`;
          if(id==='\0header.jsx')return `import React from 'react';export function AdminHeader({compact}){return <header aria-label="App header" className={compact?"h-14 shrink-0":"h-24 shrink-0"}>Monitoring</header>}`;
          if(id==='\0alertmodal')return 'export const WeatherAlertModal=()=>null';
          if(id==='\0dashboard.jsx')return `import React from 'react';export function DashboardOverview({onReviewReports}){return <div style={{height:1800}}>Dashboard content<button onClick={()=>onReviewReports()}>Browse reports fixture</button><button onClick={()=>onReviewReports({reportId:'report-00000000'})}>Open older report fixture</button><button onClick={()=>onReviewReports({time:'24h'})}>Recent reports fixture</button></div>}`;
          if(id==='\0alerts.jsx')return `import React from 'react';export function AlertsTab(){return <div style={{height:1800}}>Alerts content</div>}`;
          if(id==='\0reports')return `export async function listReports(params){window.requests.push(params);const items=window.records.slice((params.page-1)*params.limit,params.page*params.limit);return {items,total:60,totalPages:3}};export async function getReport(id){return window.records.find(r=>r.id===id)};export async function updateReportStatus(id,status,reason){window.decisions.push({id,status,reason});const report=window.records.find(r=>r.id===id);Object.assign(report,{status,decisionSource:'manual'});return report};export async function fetchReportReviewHistory(){return {reportRevision:1,assessments:[],jobs:[],decisions:[]}};export async function requestReportReassessment(){}`;
          if(id==='\0maplibre')return `export class Map extends window.maplibregl.Map {constructor(options){super(options);window.maps.push(this)}};export const {Marker,Popup,AttributionControl,NavigationControl,ScaleControl,LngLat,LngLatBounds,addProtocol,removeProtocol,setWorkerUrl}=window.maplibregl;`;
          if(id==='\0protocol')return `let protocol;export async function ensurePmtilesProtocol(m){if(!protocol){protocol={tilev4:async(params)=>({data:params.type==='json'?{tilejson:'3.0.0',tiles:['pmtiles://fixture/{z}/{x}/{y}'],minzoom:0,maxzoom:0,vector_layers:[]}:new ArrayBuffer(0)})};m.addProtocol('pmtiles',protocol.tilev4)}return protocol}`;
        },
        transform(source,id) {
          if(!id.replaceAll('\\','/').endsWith('/constants/publicMap.ts'))return;
          const style='{version:8,glyphs:"/fixture-glyphs/{fontstack}/{range}.pbf",sources:{},layers:[{id:"background",type:"background",paint:{"background-color":"#dce8e7"}}]}';
          return source.replace('light: OPENFREEMAP_STYLE,','light: '+style+',').replace('bright: OPENFREEMAP_BRIGHT_STYLE,','bright: '+style+',').replace('satellite: SATELLITE_STYLE,','satellite: '+style+',');
        }
      }],build:{write:false,minify:false,lib:{entry,formats:['iife'],name:'WorkspaceFixture'}}});
    const output=(Array.isArray(result)?result[0]:result).output;
    const js=output.find(item=>item.type==='chunk').code;
    const css=output.filter(item=>item.type==='asset'&&item.fileName.endsWith('.css')).map(item=>item.source).join('\n');
    browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*', async route=> {
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/preview-tiles/')) {const tile=url.pathname.replace('/preview-tiles/','');const response=await fetch('https://tile.openstreetmap.org/'+tile,{headers:{'User-Agent':'Gakit report marker UI review'}});return route.fulfill({status:response.status,contentType:'image/png',body:Buffer.from(await response.arrayBuffer())}) }
      if(url.pathname.startsWith('/fixture-glyphs/')) { const range=url.pathname.split('/').at(-1);const font=decodeURIComponent(url.pathname.split('/').at(-2)).includes('Bold')?'Noto Sans Bold':'Noto Sans Regular';const response=await fetch('https://raw.githubusercontent.com/maplibre/demotiles/gh-pages/font/'+encodeURIComponent(font)+'/'+range);return route.fulfill({status:response.status,contentType:'application/x-protobuf',body:Buffer.from(await response.arrayBuffer())}) }
      if(url.pathname==='/workspace-fixture')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
      if(url.pathname.startsWith('/fixture-maplibre/')||url.pathname.startsWith('/vendor/maplibre-gl/'))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'node_modules/maplibre-gl/dist',path.basename(url.pathname)))});
      if(url.pathname.startsWith('/data/') && /\.(json|geojson)$/.test(url.pathname)) {
        const file=path.resolve(root,'public',url.pathname.slice(1));
        if(file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file))return route.fulfill({contentType:'application/json',body:fs.readFileSync(file)});
      }
      if(url.pathname.includes('/reports'))return route.fulfill({json:{type:'FeatureCollection',features:[]}});
      if(url.pathname.includes('/health'))return route.fulfill({json:{status:'ok'}});
      if(url.pathname.includes('World_Imagery'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#cbd5e1"/></svg>'});
      return route.fulfill({status:503,body:'Fixture: service unavailable'});
    });
    await page.goto(base+'/workspace-fixture?tab=reports');
    await page.addStyleTag({content:css});
    await page.addScriptTag({type:'module',content:`window.maplibregl=await import(${JSON.stringify(base+'/fixture-maplibre/maplibre-gl.mjs')})`});
    await page.waitForFunction(()=>window.maplibregl);
    await page.addScriptTag({content:'window.process={env:{NODE_ENV:"production"}};'+js});
    await page.waitForFunction(()=>window.maps?.length===1&&window.maps[0].getLayer('report-points')).catch(async error=>{
      console.error('Map initialization:',errors,await page.evaluate(()=>({maps:window.maps?.length,layers:window.maps?.[0]?.getStyle()?.layers?.map(l=>l.id),text:document.body.innerText.slice(0,800)})));
      throw error;
    });
    const workspace=page.locator('.reports-workspace');
    const map=page.getByRole('region',{name:'Flood report map',exact:true});
    const panel=page.getByRole('region',{name:'Reports panel',exact:true});
    const canvas=await map.locator('canvas.maplibregl-canvas').elementHandle();
    const screenshot=async name=>{if(screenshots)await page.screenshot({path:path.join(screenshots,name+'.png')})};
    async function withinViewport(locator) {
      const bounds=await locator.boundingBox();const size=page.viewportSize();
      assert(bounds&&bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=size.width+1&&bounds.y+bounds.height<=size.height+1,'Bounds: '+JSON.stringify(bounds));
      const widths=await locator.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,name:el.className}));
      assert(widths.scroll<=widths.client+1,'Horizontal overflow: '+JSON.stringify(widths));
      return bounds;
    }
    async function withinMap(locator) {
      const box=await withinViewport(locator),bounds=await map.boundingBox();
      assert(box.x>=bounds.x-1&&box.x+box.width<=bounds.x+bounds.width+1,'Dropdown stays inside map horizontally');
      assert(box.y>=bounds.y-1&&box.y+box.height<=bounds.y+bounds.height+1,'Dropdown stays inside map vertically');
      return box;
    }
    async function mapFits() {
      await page.waitForFunction(()=>{const map=window.maps[0],canvas=map.getCanvas(),bounds=map.getContainer().getBoundingClientRect();return Math.abs(canvas.clientWidth-bounds.width)<2&&Math.abs(canvas.clientHeight-bounds.height)<2});
      assert(await canvas.evaluate(el=>el.isConnected),'Same mounted map canvas');
      assert.equal(await page.evaluate(()=>window.maps.length),1,'Map must not remount');
    }
    const mapBox=await withinViewport(map),panelBox=await withinViewport(panel);
    await page.waitForFunction(()=>{const map=window.maps[0];return map.getPadding().right>300});
    assert(await page.evaluate(()=>{const map=window.maps[0];return Math.abs(map.project(map.getCenter()).x-(map.getContainer().clientWidth-map.getPadding().right)/2)<2}),'Initial map center is clear of table');

    assert(panelBox.x>mapBox.x&&panelBox.x+panelBox.width<mapBox.x+mapBox.width&&panelBox.y>mapBox.y,'Card floats within full-width map');
    assert(mapBox.width>panelBox.width*1.7,'Map is wider than the floating card');
    assert.equal((await page.getByRole('banner',{name:'App header'}).boundingBox()).height,56,'Compact app header');
    assert(!await panel.locator('.report-row-compact').first().isVisible(),'No stacked report cards');
    assert(await panel.locator('.report-row-wide').first().isVisible(),'Real table stays visible');
    assert.equal(await panel.getByRole('columnheader').count(),6,'Six useful columns');
    assert.deepEqual(await panel.getByRole('columnheader').allTextContents(),['Location','Depth','Reporter','Status','Submitted','Actions']);
    const firstRow=panel.locator('.report-row-wide').first();
    assert.equal(await firstRow.getByRole('cell').count(),6);
    assert((await firstRow.getByRole('cell').nth(1).innerText()).includes('159 cm'));
    assert(!(await firstRow.innerText()).includes('#report-'),'IDs are in details');
    assert(!(await panel.getByRole('table').innerText()).includes('No qualifying support'),'Assessment basis is in details');
    assert(await firstRow.getByRole('cell').nth(3).getByRole('img',{name:'Needs review'}).isVisible(),'Review indicator sits beside status');
    assert(!(await panel.locator('.report-row-wide').nth(1).getByRole('cell').nth(1).innerText()).includes('45'),'No numeric depth invented for category-only reports');
    assert.equal(await panel.getByRole('button',{name:'Hide reports',exact:true}).innerText(),'Hide');
    assert.equal(await map.getByRole('complementary',{name:'Map Controls Sidebar'}).count(),0,'Map cards moved to header');
    const layersButton=page.getByRole('button',{name:'Layers',exact:true});
    const reportsButton=page.getByRole('button',{name:'Flood reports',exact:true});
    assert((await layersButton.boundingBox()).y<mapBox.y+48,'Layers float over map');
    assert((await reportsButton.boundingBox()).y<mapBox.y+48,'Report controls float over map');
    assert.equal(await workspace.getByRole('heading').count(),0,'No extra map title row');
    await layersButton.click();
    await withinMap(page.getByRole('region',{name:'Map layers',exact:true}));
    assert.equal(await page.getByRole('region',{name:'Map layers',exact:true}).locator('.hud-card').count(),1,'One layers card');
    assert.equal(await page.getByRole('region',{name:'Map layers',exact:true}).evaluate(el=>getComputedStyle(el).borderTopWidth),'0px','No extra card around layers');
    const floodLayer=page.getByRole('region',{name:'Map layers',exact:true}).getByRole('switch',{name:'Flood',exact:true});
    await floodLayer.click();
    assert.equal(await floodLayer.getAttribute('aria-checked'),'true');
    assert(await layersButton.getByLabel('1 active layers').isVisible(),'Mini layer count badge retained');
    await page.getByRole('button',{name:'Clear layers',exact:true}).click();
    assert.equal(await floodLayer.getAttribute('aria-checked'),'false','Clear layers turns layers off');
    assert(await page.getByRole('region',{name:'Map layers',exact:true}).isVisible(),'Clearing does not close dropdown');
    await page.getByRole('button',{name:'Collapse Layers',exact:true}).click();
    assert.equal(await page.getByRole('region',{name:'Map layers',exact:true}).count(),0,'Chevron closes dropdown');
    await layersButton.click();
    await reportsButton.click();
    assert.equal(await page.getByRole('region',{name:'Map layers',exact:true}).count(),0,'Separate dropdowns close on switching');
    await withinMap(page.getByRole('region',{name:'Flood report visibility',exact:true}));
    assert.equal(await page.getByRole('region',{name:'Flood report visibility',exact:true}).locator('.hud-card').count(),1,'One reports card');
    assert.equal(await page.getByRole('region',{name:'Flood report visibility',exact:true}).evaluate(el=>getComputedStyle(el).borderTopWidth),'0px','No extra card around reports');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('region',{name:'Flood report visibility',exact:true}).count(),0);
    assert(await reportsButton.evaluate(el=>el===document.activeElement),'Dropdown restores trigger focus');
    assert.equal(await panel.locator('.report-row-wide').count(),20,'20 reports per page');
    assert(await panel.locator('.reports-list').locator('..').evaluate(el=>el.scrollHeight>el.clientHeight),'Report rows scroll inside card');
    assert(!(await panel.innerText()).includes('Live · 30s refresh'));
    assert.equal(await panel.getByRole('button',{name:'Hide reports',exact:true}).count(),1,'Hide control in card header');
    assert((await panel.innerText()).includes('last 48 hours'));
    assert(!(await map.innerText()).includes('last 48 hours'),'Time window moved into card');
    assert.equal(await page.getByRole('button',{name:'Fullscreen',exact:true}).innerText(),'','Fullscreen is icon-only');
    await page.getByRole('button',{name:'Map display settings',exact:true}).click();
    await withinMap(page.getByRole('region',{name:'Map display settings',exact:true}));
    assert.equal(await page.getByRole('button',{name:'Light',exact:true}).getAttribute('aria-pressed'),'true','Light basemap is the default');
    assert.equal(await page.getByRole('switch',{name:'Barangay boundaries',exact:true}).getAttribute('aria-checked'),'false','Boundaries and telemetry start off');
    await page.getByRole('button',{name:'Close display settings',exact:true}).click();
    await withinViewport(panel.getByRole('button',{name:'Next',exact:true}));
    await panel.getByRole('button',{name:'Next',exact:true}).click();
    await page.waitForFunction(()=>window.requests.at(-1).page===2);
    assert.equal(await panel.getByRole('button',{name:'Apply',exact:true}).count(),0,'Filters need no Apply button');
    await panel.getByRole('button',{name:'All statuses',exact:true}).click();
    await page.getByRole('option',{name:'Pending',exact:true}).click();
    await page.waitForFunction(()=>window.requests.at(-1).status==='UNVERIFIED'&&window.requests.at(-1).page===1);
    await panel.getByRole('button',{name:'All depths',exact:true}).click();
    await page.getByRole('option',{name:'Knee Deep',exact:true}).click();
    await page.waitForFunction(()=>window.requests.at(-1).depth==='knee');
    await panel.getByRole('button',{name:'Reset filters',exact:true}).click();
    await page.waitForFunction(()=>!window.requests.at(-1).status&&!window.requests.at(-1).depth);
    const search=panel.getByRole('textbox',{name:'Search reports'});
    await search.fill('P');
    await search.fill('Pob');
    await panel.getByRole('textbox',{name:'Search reports'}).fill('Poblacion');
    await page.waitForFunction(()=>window.requests.at(-1).search==='Poblacion');
    assert.equal(await page.evaluate(()=>window.requests.filter(r=>r.search==='P'||r.search==='Pob').length),0,'Search waits until typing pauses');
    assert.equal(await page.evaluate(()=>window.requests.at(-1).page),1,'Search resets pagination');
    await panel.getByRole('button',{name:'Next',exact:true}).click();
    await page.waitForFunction(()=>window.requests.at(-1).page===2);
    await page.evaluate(()=>window.maps[0].jumpTo({center:[124.24,8.23],zoom:15.5}));
    const camera=await page.evaluate(()=>({center:window.maps[0].getCenter().toArray(),zoom:window.maps[0].getZoom()}));
    assert.equal(await map.getByRole('status').count(),0,'No telemetry by default');
    await page.getByRole('button',{name:'Map display settings',exact:true}).click();
    await page.getByRole('switch',{name:'Barangay boundaries',exact:true}).click();
    await page.getByRole('button',{name:'Close display settings',exact:true}).click();
    await page.waitForFunction(()=>window.maps[0].queryRenderedFeatures({layers:['barangay-fill']}).length>0);
    const hoverPoint=await page.evaluate(()=>{
      const map=window.maps[0],bounds=map.getContainer().getBoundingClientRect(),edge=map.getContainer().clientWidth-map.getPadding().right;
      for(let y=280;y<bounds.height-60;y+=40)for(let x=40;x<edge-30;x+=40)if(map.queryRenderedFeatures([x,y],{layers:['barangay-fill']}).length)return {x:bounds.x+x,y:bounds.y+y};
    });
    assert(hoverPoint,'A real barangay is available to inspect');
    await page.mouse.move(hoverPoint.x,hoverPoint.y);
    const telemetry=map.getByRole('status').filter({hasText:'Barangay'});
    await telemetry.waitFor();
    const telemetryBox=await withinViewport(telemetry);
    assert(telemetryBox.x<mapBox.x+30,'Barangay metrics stay on the left');
    assert(telemetryBox.y>=(await page.locator('.reports-map-tools').boundingBox()).y+(await page.locator('.reports-map-tools').boundingBox()).height+6,'Telemetry clears map badges');
    await page.locator('.reports-map-tools').evaluate(el=>el.style.maxWidth='200px');
    await page.waitForFunction(()=>{const tools=document.querySelector('.reports-map-tools').getBoundingClientRect(),card=document.querySelector('[data-barangay-telemetry]:not(button)').getBoundingClientRect();return card.y>=tools.bottom+6});
    await page.locator('.reports-map-tools').evaluate(el=>el.style.removeProperty('max-width'));

    assert.equal(await map.locator('svg > path[stroke-dasharray="4 4"]').count(),0,'No connector line');
    await screenshot('desktop-telemetry');
    await page.mouse.move(20,20);
    await page.getByRole('button',{name:'Map display settings',exact:true}).click();
    await page.getByRole('switch',{name:'Barangay boundaries',exact:true}).click();
    await page.getByRole('button',{name:'Close display settings',exact:true}).click();
    await screenshot('desktop-floating-table');
    await page.getByRole('button',{name:'Hide reports',exact:true}).click();
    assert(!await panel.isVisible());assert(Math.abs((await withinViewport(map)).width-mapBox.width)<2,'Canvas remains full width');
    await page.waitForFunction(()=>window.maps[0].getPadding().right===0);
    assert(await page.evaluate(()=>{const map=window.maps[0];return Math.abs(map.project(map.getCenter()).x-map.getContainer().clientWidth/2)<2}),'Hiding table centers map in full width');

    await mapFits();
    assertCameraUnchanged(await page.evaluate(()=>({center:window.maps[0].getCenter().toArray(),zoom:window.maps[0].getZoom()})),camera,'Hiding table does not move map');
    await page.getByRole('button',{name:'Show reports',exact:true}).click();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assertCameraUnchanged(await page.evaluate(()=>({center:window.maps[0].getCenter().toArray(),zoom:window.maps[0].getZoom()})),camera,'Showing table does not move map');
    assert.equal(await panel.getByRole('textbox',{name:'Search reports'}).inputValue(),'Poblacion');
    assert((await panel.innerText()).includes('Page 2 of 3'));
    await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
    assert(!await page.getByRole('complementary',{name:'App sidebar'}).isVisible());
    assert(!await page.getByRole('banner',{name:'App header'}).isVisible());
    await mapFits();
    assertCameraUnchanged(await page.evaluate(()=>({center:window.maps[0].getCenter().toArray(),zoom:window.maps[0].getZoom()})),camera,'Camera preserved');
    await screenshot('desktop-fullscreen');
    // Details and native fullscreen must coexist with portals outside the workspace.
    const detailsButton=panel.getByRole('button',{name:/View report .* details/}).first();
    await detailsButton.click();
    const details=page.getByRole('dialog',{name:'Report details',exact:true});
    await details.waitFor();await withinViewport(details);
    assert(Math.abs((await details.getByRole('button',{name:'Open this location on the incident map',exact:true}).boundingBox()).height-160)<2);
    await page.keyboard.press('Escape');await details.waitFor({state:'detached'});
    assert.equal(await workspace.getAttribute('data-fullscreen'),'true','Modal Escape does not change fullscreen state');
    await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);
    await detailsButton.click();await withinViewport(details);
    await details.getByRole('button',{name:'Close report details',exact:true}).click();
    await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
    await page.waitForFunction(()=>!document.fullscreenElement);
    await page.waitForFunction(()=>document.querySelector('.reports-workspace').dataset.fullscreen==='false');
    assert.equal(await workspace.getAttribute('data-fullscreen'),'false');
    assert(await page.getByRole('banner',{name:'App header'}).isVisible());
    // Browser exit controls restore app navigation, too.
    await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
    await page.waitForFunction(()=>document.fullscreenElement);
    await page.evaluate(()=>document.exitFullscreen());
    await page.waitForFunction(()=>document.querySelector('.reports-workspace').dataset.fullscreen==='false');
    // A denied native request still offers an expanded workspace and an obvious way out.
    await page.evaluate(()=>{window.savedFullscreenRequest=document.documentElement.requestFullscreen;document.documentElement.requestFullscreen=()=>Promise.reject(new Error('Fixture denial'))});
    await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Browser fullscreen is unavailable'}).waitFor();
    assert.equal(await workspace.getAttribute('data-fullscreen'),'true');
    await detailsButton.click();await withinViewport(details);
    await page.keyboard.press('Escape');await details.waitFor({state:'detached'});
    assert.equal(await workspace.getAttribute('data-fullscreen'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await workspace.getAttribute('data-fullscreen'),'false');
    await page.evaluate(()=>{document.documentElement.requestFullscreen=window.savedFullscreenRequest});
    await page.setViewportSize({width:1024,height:720});
    await withinViewport(panel);await withinViewport(workspace);await mapFits();
    await panel.getByRole('button',{name:/View report .* on map/}).first().click();
    await map.locator('.gakit-report-popup').waitFor();
    await page.waitForFunction(()=>!window.maps[0].isMoving());
    const popup=await map.locator('.gakit-report-popup').boundingBox();
    const card=await panel.boundingBox();
    assert(popup.x+popup.width<=card.x,'Focused report remains clear of floating table');
    const compass=await map.getByRole('button',{name:'Reset orientation and view to Iligan City'}).boundingBox();
    assert(compass.x+compass.width<card.x,'Navigation controls remain clear of card');
    await screenshot('small-desktop');
    await map.locator('.maplibregl-popup-close-button').click();
    await page.setViewportSize({width:2400,height:1100});
    assert(await panel.locator('.report-row-wide').first().isVisible(),'Wide screens still use compact table');
    await withinViewport(panel);await mapFits();
    // Other tabs retain their scrolling layout and the Reports map survives a round trip.
    // Dashboard navigation and individual report links preserve the table window.
    const sidebar=page.getByRole('complementary',{name:'App sidebar'});
    await sidebar.getByRole('button',{name:'dashboard',exact:true}).click();
    await page.getByRole('button',{name:'Open older report fixture',exact:true}).click();
    const linkedReport=page.getByRole('dialog',{name:'Report details',exact:true});
    await linkedReport.waitFor();
    assert.equal(new URL(page.url()).searchParams.get('time'),null);
    assert(await page.evaluate(()=>!!window.requests.at(-1).created_after),'Opening a report retains the list cutoff');
    await linkedReport.getByRole('button',{name:'Close report details',exact:true}).click();
    await sidebar.getByRole('button',{name:'dashboard',exact:true}).click();
    await page.getByRole('button',{name:'Browse reports fixture',exact:true}).click();
    assert.equal(new URL(page.url()).searchParams.get('time'),null);
    assert(await page.evaluate(()=>!!window.requests.at(-1).created_after),'General navigation retains the list cutoff');
    await page.getByRole('complementary',{name:'App sidebar'}).getByRole('button',{name:'dashboard',exact:true}).click();
    assert.equal(await page.locator('main').evaluate(el=>getComputedStyle(el).overflowY),'auto');
    await page.getByRole('complementary',{name:'App sidebar'}).getByRole('button',{name:'reports',exact:true}).click();
    await mapFits();
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:width===320?640:900});
      await withinViewport(workspace);await withinViewport(panel);await mapFits();
      const nav=page.getByRole('navigation',{name:'Portal navigation'});
      await withinViewport(nav);
      assert.equal(Math.round((await nav.locator(':scope > div').boundingBox()).height),50,'Same compact bar height as public navbar');
      assert((await nav.locator(':scope > div').boundingBox()).width<=320,'Four compact navigation items');
      assert.equal(await nav.getByRole('button').count(),4);
      for(const button of await nav.getByRole('button').all())assert.equal(Math.round((await button.boundingBox()).height),40,'Public-sized navigation buttons');
      await nav.getByRole('button',{name:'Open menu'}).click();
      await page.getByText('Hazard Map',{exact:true}).waitFor();
      await page.keyboard.press('Escape');
      const navTop=(await nav.locator(':scope > div').boundingBox()).y;
      assert((await workspace.boundingBox()).y+(await workspace.boundingBox()).height<=navTop,'Report bar clears compact navbar');

      assert.equal(await workspace.getAttribute('data-sheet'),'collapsed');
      await page.getByRole('button',{name:'Map display settings',exact:true}).click();
      await page.getByRole('switch',{name:'Barangay boundaries',exact:true}).click();
      await page.getByRole('button',{name:'Close display settings',exact:true}).click();
      const mobileBarangayPoint=await page.evaluate(()=>{
        const map=window.maps[0],b=map.getContainer().getBoundingClientRect();
        for(let y=180;y<b.height-80;y+=40)for(let x=40;x<b.width-30;x+=40)if(map.queryRenderedFeatures([x,y],{layers:['barangay-fill']}).length)return {x:b.x+x,y:b.y+y};
      });
      assert(mobileBarangayPoint,'Mobile barangay selection');
      await page.mouse.click(mobileBarangayPoint.x,mobileBarangayPoint.y);
      const metricsPill=map.getByRole('button',{name:/^Show .* metrics$/});
      await metricsPill.waitFor();
      const pillsBox=await page.locator('.reports-map-tools').boundingBox();
      assert((await metricsPill.boundingBox()).y>=pillsBox.y+pillsBox.height+6,'Mobile telemetry pill clears map badges');
      await metricsPill.focus();await page.keyboard.press('Enter');
      const metricsCard=map.getByRole('status').filter({hasText:'Barangay'});
      await metricsCard.waitFor();
      assert((await metricsCard.boundingBox()).y>=pillsBox.y+pillsBox.height+6,'Expanded mobile telemetry clears map badges');
      await screenshot('mobile-'+width+'-telemetry');
      await page.getByRole('button',{name:'Map display settings',exact:true}).click();
      await page.getByRole('switch',{name:'Barangay boundaries',exact:true}).click();
      await page.getByRole('button',{name:'Close display settings',exact:true}).click();
      await layersButton.click();
      await withinMap(page.getByRole('region',{name:'Map layers',exact:true}));
      await screenshot('mobile-'+width+'-layers');
      await reportsButton.click();
      await withinMap(page.getByRole('region',{name:'Flood report visibility',exact:true}));
      await screenshot('mobile-'+width+'-report-controls');
      await page.keyboard.press('Escape');
      assert(!await panel.getByRole('textbox',{name:'Search reports'}).isVisible());
      await panel.getByRole('button',{name:'Show reports',exact:true}).click();
      assert.equal(await workspace.getAttribute('data-sheet'),'full','One tap opens sheet fully');
      await withinViewport(panel.getByRole('button',{name:'Next',exact:true}));
      const filters=panel.getByRole('group',{name:'Report filters'});
      assert(await filters.isVisible(),'Filters are always visible');
      await filters.getByRole('button',{name:'Last 48 hours',exact:true}).click();
      await page.getByRole('option',{name:'All time',exact:true}).click();
      await page.waitForFunction(()=>window.requests.at(-1).created_after===undefined);
      assert((await panel.locator('.reports-sheet-handle').innerText()).includes('reports · All time'),'All-time summary');
      const summary=panel.locator('.reports-sheet-handle > span').last();
      assert(await summary.evaluate(el=>el.getBoundingClientRect().height<20),'Status fits one line');
      await filters.getByRole('button',{name:'All time',exact:true}).click();
      await page.getByRole('option',{name:'Last 48 hours',exact:true}).click();
      await page.waitForFunction(()=>window.requests.at(-1).created_after!==undefined);
      const filterBounds=await filters.getByRole('button').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().y));
      assert(Math.max(...filterBounds)-Math.min(...filterBounds)<2,'Filters stay in one row');
      assert.equal(await workspace.getAttribute('data-sheet'),'full');
      await withinViewport(filters);
      await withinViewport(panel.getByRole('button',{name:'Next',exact:true}));
      await screenshot('mobile-'+width+'-expanded');
      const tableScroll=panel.locator('.reports-list').locator('..');
      assert(await tableScroll.evaluate(el=>el.scrollWidth>el.clientWidth),'Full table scrolls within mobile sheet');
      await detailsButton.click();await withinViewport(details);
      await details.getByRole('button',{name:'Close report details',exact:true}).click();
      await panel.getByRole('button',{name:/View report .* on map/}).first().click();
      assert.equal(await workspace.getAttribute('data-sheet'),'collapsed','View on map lowers sheet');
      await page.waitForFunction(()=>window.maps[0].isMoving()===false);
      assert((await map.locator('.gakit-report-popup').innerText()).includes('just now'),'Popup receives raw timestamp');
      await mapFits();
      const nativeMapState=()=>page.evaluate(()=>{const map=window.maps[0];return {center:map.getCenter().toArray(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch(),width:map.getCanvas().clientWidth,height:map.getCanvas().clientHeight}});
      const beforeSwipe=await nativeMapState();
      assert.equal(Math.round((await panel.boundingBox()).height),44,'Compact collapsed bar');
      const handle=panel.locator('.reports-sheet-handle');
      const cdp=await page.context().newCDPSession(page);
      let touchBounds=await handle.boundingBox();
      const touchX=touchBounds.x+touchBounds.width/2,touchY=touchBounds.y+touchBounds.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchX,y:touchY}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchX,y:touchY-90}]});
      assert((await panel.boundingBox()).height>100,'Sheet follows finger immediately');
      assert(await panel.locator('.reports-workspace-content').isVisible(),'Rows appear during the first pull');
      assertCameraUnchanged(await nativeMapState(),beforeSwipe,'Dragging overlays the unchanged map');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal(await workspace.getAttribute('data-sheet'),'full','One touch stroke opens sheet');
      assertCameraUnchanged(await nativeMapState(),beforeSwipe,'Opening does not resize or move map');
      touchBounds=await handle.boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchX,y:touchBounds.y+20}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchX,y:touchBounds.y+110}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal(await workspace.getAttribute('data-sheet'),'collapsed','One touch stroke closes sheet');
      assertCameraUnchanged(await nativeMapState(),beforeSwipe,'Hiding does not resize or move map');
      await cdp.detach();
      // Keyboard controls retain an intermediate reading position.

      await handle.focus();await page.keyboard.press('ArrowUp');
      assert.equal(await workspace.getAttribute('data-sheet'),'half');
      const bounds=await handle.boundingBox();
      await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
      await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2,bounds.y-150,{steps:8});await page.mouse.up();
      assert.equal(await workspace.getAttribute('data-sheet'),'full','Swipe up expands sheet');
      await handle.focus();await page.keyboard.press('Home');
      assert.equal(await workspace.getAttribute('data-sheet'),'collapsed');
      await screenshot('mobile-'+width+'-map');
      await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
      assert(!await page.getByRole('navigation',{name:'Portal navigation'}).isVisible());
      await withinViewport(workspace);await mapFits();
      await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
      assert(await page.getByRole('navigation',{name:'Portal navigation'}).isVisible());
    }
    await page.setViewportSize({width:1440,height:900});
    if(await page.getByRole('button',{name:'Hide reports',exact:true}).isVisible())await page.getByRole('button',{name:'Hide reports',exact:true}).click();
    if(process.env.GAKIT_REAL_BASEMAP==='1')await page.evaluate(()=>{const map=window.maps[0];map.addSource('preview-basemap',{type:'raster',tiles:['/preview-tiles/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'});map.addLayer({id:'preview-basemap',type:'raster',source:'preview-basemap'},'flood-hazard-fill')});
    await page.evaluate(()=>{document.querySelector('.maplibregl-popup-close-button')?.click();window.maps[0].jumpTo({center:[124.24,8.23],zoom:16});window.bubbleFixture()});
    await page.waitForFunction(()=>window.maps[0].queryRenderedFeatures({layers:['report-depth-labels']}).length>=2);
    const labels=await page.evaluate(()=>{const map=window.maps[0];return {dots:[...new Set(map.queryRenderedFeatures({layers:['report-points']}).map(f=>f.properties.id))],labels:[...new Set(map.queryRenderedFeatures({layers:['report-depth-labels']}).map(f=>f.properties.id))],size:map.getLayoutProperty('report-points','icon-size'),text:map.getLayoutProperty('report-depth-labels','text-field')}});
    assert.equal(labels.dots.length,4,'All locations remain available');
    assert(labels.labels.length<labels.dots.length,'Overlapping depth bubbles yield to other labels');
    assert.equal(labels.size,1,'Original flood pin size');
    assert.deepEqual(labels.text,['get','depthBadge'],'Mini badge only shows depth');
    assert(await page.evaluate(()=>window.maps[0].queryRenderedFeatures({layers:['report-depth-labels']}).every(f=>!f.properties.depthBadge.includes('≈'))),'Badge omits estimate prefix');
    assert.deepEqual(await page.evaluate(()=>window.maps[0].getLayoutProperty('report-depth-labels','icon-image')),['get','depthBadgeImage'],'Badge uses depth-specific colored dot');
    if(process.env.GAKIT_REAL_BASEMAP==='1')await page.waitForFunction(()=>window.maps[0].isSourceLoaded('preview-basemap'));
    await screenshot('readable-report-bubbles');
    const labelPoint=await page.evaluate(()=>{const map=window.maps[0],p=map.project([124.237,8.23]),b=map.getContainer().getBoundingClientRect();return {x:p.x+b.x+30,y:p.y+b.y-12}});
    await page.mouse.click(labelPoint.x,labelPoint.y);
    await page.getByRole('dialog',{name:'Report details',exact:true}).waitFor();
    await page.getByRole('button',{name:'Close report details',exact:true}).click();
    await page.evaluate(()=>window.maps[0].jumpTo({zoom:13}));
    await page.waitForFunction(()=>window.maps[0].queryRenderedFeatures({layers:['report-depth-labels']}).length>0);
    await page.evaluate(()=>window.maps[0].jumpTo({zoom:11}));
    await page.waitForFunction(()=>window.maps[0].queryRenderedFeatures({layers:['report-clusters']}).length>0);
    assert(await page.evaluate(()=>window.maps[0].queryRenderedFeatures({layers:['report-depth-labels']}).every(f=>!f.properties.point_count)),'Only individual reports carry depth badges at overview zoom');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>window.maps[0].jumpTo({center:[124.24,8.23],zoom:16}));
    await page.waitForFunction(()=>window.maps[0].queryRenderedFeatures({layers:['report-depth-labels']}).length>0);
    if(process.env.GAKIT_REAL_BASEMAP==='1')await page.waitForFunction(()=>window.maps[0].isSourceLoaded('preview-basemap'));
    await screenshot('mobile-readable-report-bubbles');
    const mobileLabel=await page.evaluate(()=>{const map=window.maps[0],p=map.project([124.24,8.23]),b=map.getContainer().getBoundingClientRect();return {x:p.x+b.x+30,y:p.y+b.y-12}});
    const touch=await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[mobileLabel]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await withinViewport(page.getByRole('dialog',{name:'Report details',exact:true}));
    await touch.detach();

    assert.deepEqual(errors,[]);
    console.log('Reports workspace browser checks passed: real map resize and camera preservation, floating compact table, single fullscreen control, dialogs, mobile snap/drag/keyboard/filter controls, and other-tab scrolling.');
  } finally {
    await browser?.close();fs.unlinkSync(entry);fs.rmdirSync(directory);
  }
})().catch(error=>{console.error(error);process.exitCode=1});
