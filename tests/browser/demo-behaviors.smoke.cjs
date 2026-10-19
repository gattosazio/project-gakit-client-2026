// Actual workspace controls and user-created behavior library; isolated API responses.
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-demo-behaviors-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { DemoWorkspace } from '@/app/admin/demo/DemoWorkspace';
    createRoot(document.getElementById('root')).render(<DemoWorkspace />);`);
  let browser;
  try {
    const result = await build({configFile:false,root,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},
      resolve:{alias:[{find:'react',replacement:path.join(root,'node_modules/react')},
        {find:'react-dom',replacement:path.join(root,'node_modules/react-dom')},{find:'@',replacement:root}]},
      plugins:[{name:'workspace-fixture',enforce:'pre',
        resolveId(id) {
          if(id==='next/dynamic') return '\0fixture-dynamic';
          if(id==='next/link') return '\0fixture-link';
          if(id.endsWith('/components/header/ScenarioDisplayPopover')) return '\0fixture-display';
          if(id.endsWith('/lib/backend/http')) return '\0fixture-api';
        },
        load(id) {
          if(id==='\0fixture-dynamic') return 'export default function dynamic(){return ()=>null;}';
          if(id==='\0fixture-link') return 'import React from "react"; export default function Link(props){return React.createElement("a",props);}';
          if(id==='\0fixture-display') return 'export function ScenarioDisplayPopover(){return null;}';
          if(id==='\0fixture-api') return 'export async function apiRequest(path,options){const target=path.includes("/behaviors")?path.replace("/api/v1/admin/demo/behaviors","/__demo-behaviors/library"):"/__demo-behaviors/analysis";const r=await fetch(target,options);const body=await r.json().catch(()=>null);if(!r.ok)throw new Error(body?.detail);return body;}';
        }
      }],build:{write:false,minify:false,lib:{entry,formats:['iife'],name:'WorkspaceFixture'}}});
    const bundle=(Array.isArray(result)?result[0]:result).output.find(item=>item.type==='chunk').code;
    const scenario=JSON.parse(fs.readFileSync(path.join(root,'public/data/scenarios/pagasa_orange.json'),'utf8'));
    browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    const errors=[], requests=[];
    const database=new Map();
    let pendingHour = true, failNext = false;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/__demo-behaviors/page',route=>route.fulfill({contentType:'text/html',body:'<body style="font-family:system-ui,sans-serif"><div id="root"></div></body>'}));
    await page.route('**/data/scenarios/pagasa_orange.json',route=>route.fulfill({json:scenario}));
    await page.route('**/__demo-behaviors/library**',route=>{
      const request=route.request(), id=new URL(request.url()).pathname.split('/')[3];
      if(request.method()==='GET') return route.fulfill({json:[...database.values()]});
      if(request.method()==='DELETE') {database.delete(id);return route.fulfill({status:204});}
      const input=request.postDataJSON();
      const previous=[...database.values()].find(item=>item.name.toLowerCase()===input.name.toLowerCase());
      const saved={...input,id:previous?.id||id,savedAt:new Date().toISOString()};database.set(saved.id,saved);
      return route.fulfill({json:saved});
    });
    await page.route('**/__demo-behaviors/analysis',async route=>{
      const request=route.request().postDataJSON();requests.push(request);
      if(failNext) { failNext=false; return route.fulfill({status:422,json:{detail:'This replay exceeds the demo routing limit.'}}); }
      if(pendingHour && request.simulationTime==='2026-01-01T16:00:00.000Z') {
        pendingHour=false;
        return route.fulfill({status:202,json:{synthetic:true,pending:true,progress:{at:'2026-01-01T15:30:00Z',startedAt:'2026-01-01T15:00:00Z',targetAt:request.simulationTime,domainExpansions:1}}});
      }
      const reports=request.reports.map(report=>({ ...report,synthetic:true,status:report.blocked?'REJECTED':'VERIFIED',
        validationSummary:{assessedAt:request.simulationTime,recommendedStatus:report.blocked?'REJECTED':'VERIFIED',
          decisionBasis:report.blocked?'original_observations':'physical_support',explanation:'Fixture response',
          support:report.blocked?['USER_BLACKLISTED']:[],conflicts:[],missing:[],context:[],corroboratingSourceCount:0} }));
      return route.fulfill({json:{synthetic:true,reports,terrainBounds:{left:124.15,right:124.5,top:8.35,bottom:8.1},
        patches:[],contextPatches:[],reportUpdateCount:0,changedCells:0,addedWetAreaM2:0,removedWetAreaM2:0,
        maxDepthChangeM:0,storageChangeM3:0,baselineWetAreaM2:0,correctedWetAreaM2:0,
        reportEffects:reports.map(report=>({reportId:report.id,reason:report.blocked?'report_rejected':Date.parse(report.observedAt)<Date.parse(request.simulationTime)?'carried_forward':'applied',baselineDepthM:null,correctedDepthM:null})),
        ...(reports.some(report=>!report.blocked)?{flowState:{method:'local_inertial',at:request.simulationTime,startedAt:reports[0].observedAt,budgets:[]}}:{}),
        observationOnlyGroups:0,outsideDomainReportIds:[]}});
    });
    await page.goto(`${base}/__demo-behaviors/page`);
    await page.evaluate(()=>{sessionStorage.setItem('gakit.demo.enabled','true');localStorage.removeItem('gakit.demo.behaviors');});
    for(const file of fs.readdirSync(path.join(root,'.next/static/chunks')).filter(file=>file.endsWith('.css'))) {
      await page.addStyleTag({path:path.join(root,'.next/static/chunks',file)});
    }
    await page.addScriptTag({content:bundle});
    const latest=()=>requests[requests.length-1];
    await page.getByText('No saved behaviors yet.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('combobox',{name:/^Example/}).count(),0);
    assert.equal(await page.getByText('Timed sample sequence',{exact:true}).count(),0);
    const slider=page.locator('input[type="range"]');
    await slider.focus();await page.keyboard.press('Home');
    for(let step=0;step<15;step++) await page.keyboard.press('ArrowRight');
    await page.getByRole('button',{name:'Add demo report',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('article').length===1);
    assert.equal(latest().reports[0].depthCm,45);
    assert.equal(latest().reports[0].depthMethod,'estimated');
    await page.getByRole('combobox',{name:/^Demo reporter/}).selectOption('8');
    await page.getByRole('spinbutton',{name:/^Exact depth/}).fill('60');
    await page.getByRole('combobox',{name:/^Observed at/}).selectOption('earlier');
    await page.getByRole('spinbutton',{name:/^Minute since storm start/}).fill('840');
    await page.getByRole('button',{name:'Add demo report',exact:true}).click();
    await page.getByRole('button',{name:'Back to current time · Day 1 · 15:00',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
    const added=latest().reports[1];
    assert.equal(added.observedAt,'2026-01-01T14:00:00.000Z');
    assert.equal(added.submittedAt,'2026-01-01T15:00:00.000Z');
    assert.equal(added.depthMethod,'measured');assert.equal(added.depthUncertaintyCm,10);
    assert.equal(latest().approveFixtures,false);
    assert.equal(latest().stormHistory.length,25);
    await page.getByRole('textbox',{name:'Behavior name',exact:true}).fill('Edge correction');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await page.getByRole('heading',{name:'Edge correction',exact:true}).waitFor();
    const saved=[...database.values()][0];
    assert.equal(saved.minutes,900);assert.equal(saved.inspectionMinutes,null);
    assert.equal(saved.reports.length,2);assert.equal(saved.reports[1].submittedAt,added.submittedAt);
    await page.getByRole('button',{name:'Reset demo',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('article').length===0);
    failNext=true;
    await page.getByRole('button',{name:'Preload Edge correction',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Could not preload'}).waitFor();
    await page.getByRole('button',{name:'Preload Edge correction',exact:true}).click();
    await page.getByRole('button',{name:'Ready Edge correction',exact:true}).waitFor();
    assert.equal(await page.locator('article').count(),0); // Background preparation never replaces the active scene.
    const beforeLoad=requests.length;
    const runId=requests.findLast(request=>request.reports.length===2).runId;
    await page.getByRole('button',{name:'Load Edge correction',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
    await page.waitForTimeout(350);
    assert.equal(requests.length,beforeLoad); // Ready scenes do not repeat analysis on load.
    assert.equal(await slider.inputValue(),'15');
    await page.getByText('Observed Day 1 · 14:00',{exact:true}).waitFor();
    await page.getByText('Submitted Day 1 · 15:00',{exact:true}).waitFor();
    await slider.focus();await page.keyboard.press('ArrowRight');
    await page.getByText(/Routing water · calculated through Day 1 · 15:30/).waitFor();
    await page.getByText('Applied earlier · included in the current estimate').first().waitFor();
    assert.equal(await page.locator('article').count(),2);
    assert.equal(latest().runId,runId);
    assert.equal(latest().reports[1].observedAt,added.observedAt);
    await page.getByText('Water carries forward',{exact:true}).waitFor();
    await page.getByText('Synthetic storm · Day 1 · 16:00',{exact:true}).waitFor();
    const afterHour=requests.length;
    await slider.focus();await page.keyboard.press('ArrowLeft');
    await page.getByText('Synthetic storm · Day 1 · 15:00',{exact:true}).waitFor();
    await slider.focus();await page.keyboard.press('ArrowRight');
    await page.getByText('Synthetic storm · Day 1 · 16:00',{exact:true}).waitFor();
    assert.equal(requests.length,afterHour); // Revisiting completed hours uses the exact input cache.
    failNext=true;
    await slider.focus();await page.keyboard.press('ArrowRight');
    await page.getByRole('alert').filter({hasText:'This replay exceeds'}).waitFor();
    await page.getByText(/Update paused\. Showing Day 1 · 16:00/).waitFor();
    assert.equal(await page.locator('article').count(),2);
    assert.equal(await page.getByText(/Updating flood map/).count(),0);
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await page.getByText('Applied earlier · included in the current estimate').first().waitFor();
    await page.waitForFunction(()=>!document.body.textContent.includes('Update paused.'));
    // Updating the named scene preserves its identity and invalidates its old preload.
    await page.getByRole('textbox',{name:'Behavior name',exact:true}).fill('Edge correction');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await page.getByRole('button',{name:'Preload Edge correction',exact:true}).waitFor();
    const updated=[...database.values()];
    assert.equal(updated.length,1);assert.equal(updated[0].id,saved.id);assert.equal(updated[0].minutes,1020);
    await page.getByRole('button',{name:'Reset demo',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('article').length===0);
    assert.notEqual(latest().runId,runId);
    await page.reload();await page.addScriptTag({content:bundle});
    await page.getByRole('heading',{name:'Edge correction',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Ready Edge correction',exact:true}).count(),0);
    await page.getByRole('button',{name:'Load Edge correction',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
    assert.equal(latest().simulationTime,'2026-01-01T17:00:00.000Z');
    assert.equal(latest().approveFixtures,false);
    await page.getByRole('button',{name:'Delete Edge correction',exact:true}).click();
    await page.getByText('No saved behaviors yet.',{exact:true}).waitFor();
    assert.equal(database.size,0);
    // Explicit migration preserves older browser-only scenes until the server confirms each save.
    await page.evaluate(value=>localStorage.setItem('gakit.demo.behaviors',JSON.stringify([value])),saved);
    await page.reload();await page.addScriptTag({content:bundle});
    await page.getByRole('button',{name:'Import browser saves (1)',exact:true}).click();
    await page.getByRole('heading',{name:'Edge correction',exact:true}).waitFor();
    assert.equal(database.size,1);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('gakit.demo.behaviors'))),[]);
    assert.deepEqual(errors,[]);
    console.log('Demo workspace passed: database library save/load, background preload, immediate load, late reports, continuation/retry, overwrite invalidation, refresh persistence, deletion, browser import.');
  } finally {
    await browser?.close();fs.unlinkSync(entry);fs.rmdirSync(directory);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
