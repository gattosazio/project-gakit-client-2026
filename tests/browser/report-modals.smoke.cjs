// Styled report states and the shared three-decision staff workflow.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-report-modals-'));
  const entry = path.join(directory, 'entry.jsx');
  const screenshots = process.env.GAKIT_MODAL_SCREENSHOTS;
  if (screenshots) fs.mkdirSync(screenshots, { recursive:true });
  fs.writeFileSync(entry, `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {ReportDetail} from '@/app/monitoring/features/reports/ReportDetail';
    import {SuccessModal} from '@/app/public-view/components/SuccessModal';
    import {StatusDropdown} from '@/app/monitoring/features/reports/ReportActions';
    import {ReportTableRow} from '@/app/monitoring/features/reports/ReportTableRow';
    import '@/app/globals.css';
    const root=createRoot(document.getElementById('root'));
    window.updates=[];
    window.mapOpens=0;
    const report={id:'fixture-report-1234',location:{latitude:8.23,longitude:124.24,address:'Quezon Avenue, Poblacion, Iligan City'},
      depth:{code:'knee',label:'Knee',approximateCm:45},depthCm:45,reference:'adult',reporterType:'public',
      observedAt:'2026-10-26T04:00:00Z',createdAt:'2026-10-26T04:05:00Z',updatedAt:'2026-10-26T08:00:00Z',
      status:'REJECTED',decisionSource:'automated',validationSummary:{assessedAt:'2026-10-26T04:06:00Z',
        recommendedStatus:'REJECTED',checkState:'complete',decisionBasis:null,corroboratingSourceCount:0,
        depthQuality:'estimated',support:[],conflicts:['CURRENT_CONDITIONS_UNSUPPORTED'],missing:['OBSERVATION_LOCATION_UNCERTAIN'],
        context:['SIMULATION_DRY_UNCORROBORATED','PAGASA_THUNDERSTORM_WATCH'],
        explanation:'Saved assessment: complete rainfall and model checks did not support flooding at the reported place and time.'}};
    window.showReportList=()=>root.render(React.createElement(ReportTableRow,{report,highlighted:false,selected:false,updating:false,onInspect:()=>window.mapOpens++,onViewDetails:()=>window.showModal('details','rejected'),onUpdateStatus:async()=>true}));
    window.showTableRow=()=>root.render(React.createElement('div',{role:'table',style:{maxWidth:1024,margin:'0 auto'}},React.createElement(ReportTableRow,{report,highlighted:false,selected:false,updating:false,onInspect:()=>{},onViewDetails:()=>{},onUpdateStatus:async()=>true})));
    window.showTableDecision=()=>root.render(React.createElement(StatusDropdown,{report,isUpdating:false,onUpdateStatus:async(report,status,reason)=>{window.updates.push({status,reason});return true}}));
    window.showModal=(mode,state)=>{
      let r={...report,validationSummary:{...report.validationSummary}};
      if(state==='manual')r={...r,status:'UNVERIFIED',decisionSource:'manual',validationSummary:{...r.validationSummary,staffDecision:{status:'UNVERIFIED',reasonCode:'pending.insufficient_evidence',label:'More supporting evidence needed',decidedAt:'2026-10-26T06:30:00Z'}}};
      if(state==='pending')r={...r,status:'UNVERIFIED',validationSummary:{...r.validationSummary,recommendedStatus:'UNVERIFIED',checkState:'checks_incomplete',conflicts:[],context:['SIMULATION_UNAVAILABLE','WARNING_UNAVAILABLE']}};
      if(state==='accepted')r={...r,status:'VERIFIED',validationSummary:{...r.validationSummary,recommendedStatus:'VERIFIED',decisionBasis:'physical_support',depthQuality:'estimated',conflicts:[],context:['HEAVY_RAINFALL_CONTEXT','LOW_CONNECTED_TERRAIN_CONTEXT']}};
      if(state==='new-evidence')r.validationSummary.reviewAvailable=true;
      if(state==='category')r={...r,depthCm:null,observation:{depthMethod:'category',locationSource:'manual'},validationSummary:{...r.validationSummary,depthQuality:'category'}};
      if(state==='measured')r={...r,observation:{depthMethod:'measured',locationSource:'gps'}};
      if(state==='unknown')r={...r,validationSummary:{...r.validationSummary,depthQuality:'unknown'}};
      if(state==='map-error')r.location={...r.location,latitude:8.27,longitude:124.27};
      if(state==='photo')r.photoUrl='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22%3E%3Crect width=%22400%22 height=%22200%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E';
      if(state==='anomaly')r={...r,status:'ANOMALY',reporterType:'staff',validationSummary:{...r.validationSummary,recommendedStatus:'ANOMALY',context:[...r.validationSummary.context,'STAFF_REPORTER']}};
      window.currentReceipt={status:r.status,decisionSource:r.decisionSource,validationSummary:r.validationSummary};
      const close=()=>root.render(null);
      root.render(mode==='details'?React.createElement(ReportDetail,{key:mode+state,report:r,modal:true,isUpdating:false,onViewOnMap:()=>window.mapOpens++,
        onClose:close,onUpdateStatus:async(report,status,reason)=>{window.updates.push({status,reason});return true}}):
        React.createElement(SuccessModal,{key:mode+state,isOpen:true,onClose:close,report:{...r,
          location:{lat:8.23,lng:124.24,address:r.location.address},submittedAt:'26 Oct 2026, 12:05 PM'}}));
    };
  `);
  let browser;
  try {
    const result=await build({configFile:false,root,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},
      resolve:{alias:[{find:'react',replacement:path.join(root,'node_modules/react')},{find:'react-dom',replacement:path.join(root,'node_modules/react-dom')},{find:'@',replacement:root}]},
      plugins:[{name:'modal-fixture',enforce:'pre',
        resolveId(id){
          if(id==='next/dynamic')return '\0map-placeholder';
          if(id.endsWith('/actions/reports'))return '\0review-api';
          if(id.endsWith('/actions/publicView'))return '\0receipt-api';
        },
        load(id){
          if(id==='\0map-placeholder')return "import {ReportMiniMap} from '@/app/monitoring/features/reports/ReportMiniMap';export default()=>ReportMiniMap;";
          if(id==='\0review-api')return "export async function fetchReportReviewHistory(){return {reportRevision:1,assessments:[],jobs:[],decisions:[{id:1,verdict:'UNVERIFIED',actor:'staff@example.test',reason:'More supporting evidence needed',note:'Private staff context',created_at:'2026-10-26T06:30:00Z'}]}};export async function requestReportReassessment(){}";
          if(id==='\0receipt-api')return "export async function fetchReportReceipt(){return window.currentReceipt}";
        } }],build:{write:false,minify:false,lib:{entry,formats:['iife'],name:'ModalFixture'}}});
    const output=(Array.isArray(result)?result[0]:result).output;
    const js=output.find(item=>item.type==='chunk').code;
    const css=output.filter(item=>item.type==='asset'&&item.fileName.endsWith('.css')).map(item=>item.source).join('\n');
    browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
    const page=await browser.newPage();
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let failTiles=false;
    await page.route('**/World_Imagery/MapServer/tile/**',route=>failTiles?route.abort():route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e2e8f0"/><path d="M0 128H256M128 0V256" stroke="#cbd5e1"/></svg>'}));
    await page.route('**/modals-fixture',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
    await page.goto(`${process.env.GAKIT_BASE_URL||'http://localhost:3000'}/modals-fixture`);
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:js});
    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>window.showReportList());
      await page.getByRole('button',{name:'View report fixture- details',exact:true}).click();
      const details=page.getByRole('dialog',{name:'Report details',exact:true});
      await details.waitFor();
      const thumbnail=details.getByRole('button',{name:'Open this location on the incident map',exact:true});
      const bounds=await thumbnail.boundingBox();
      assert(bounds&&Math.abs(bounds.height-160)<1,'Real thumbnail must stay inside the 160px map preview, not cover the modal');
      assert(bounds.width<=(await details.boundingBox()).width-24,'Real thumbnail must stay inside the modal evidence area');
      assert.equal(await page.evaluate(()=>window.mapOpens),0,'View details must not open the incident map');
      await details.getByRole('button',{name:'Update report status',exact:true}).click();
      const decision=page.getByRole('dialog',{name:'Update report status',exact:true});
      await decision.waitFor();
      await decision.getByRole('button',{name:'Cancel',exact:true}).click();
      await details.getByRole('button',{name:'Close report details',exact:true}).click();
      await details.waitFor({state:'detached'});
      assert.equal(await page.evaluate(()=>window.mapOpens),0,'Dialog controls must not trigger the incident map');
    }
    failTiles=true;
    await page.evaluate(()=>window.showModal('details','map-error'));
    await page.getByText('Map unavailable',{exact:true}).waitFor();
    assert.equal(Math.round((await page.getByRole('button',{name:'Open this location on the incident map',exact:true}).boundingBox()).height),160,'Failed tile preview is also bounded');
    await page.getByRole('button',{name:'Open this location on the incident map',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.mapOpens),1,'Map opens only through the explicit map action');
    failTiles=false;

    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:width===320?640:900});
      for(const mode of ['details','receipt'])for(const state of ['rejected','pending','accepted','manual','new-evidence','anomaly']) {
        await page.evaluate(([mode,state])=>window.showModal(mode,state),[mode,state]);
        const dialog=page.getByRole('dialog');
        await dialog.waitFor();
        const box=await dialog.boundingBox();
        assert(box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1,mode+' horizontal bounds');
        assert(box.y+box.height<=(width===320?640:900)+1,`${mode} ${state} ${width} vertical bounds: ${JSON.stringify(box)}`);
        assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),mode+' content overflow');
        const text=await dialog.innerText();
        assert(!text.includes('Assessments can change when new evidence'), 'Stale automatic reassessment promise');
        if(mode==='details') {
          const snapshot=dialog.locator('section[aria-label="Reported observation"]');
          const saved=dialog.locator('section[aria-label="Report check"]');
          const evidence=dialog.locator('section[aria-label="Report evidence"]');
          const checks=dialog.locator('details').filter({has:page.getByText('Validation checks',{exact:true})});
          assert(await snapshot.isVisible(),'Report snapshot is available');
          assert(await dialog.locator('header').innerText().then(value=>value.includes('Quezon Avenue')),'Location leads the header');
          assert(await snapshot.evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('section[aria-label="Report check"]'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Snapshot precedes saved decision');
          assert.equal(await checks.evaluate(el=>el.open),false,'Detailed checks start collapsed');
          assert(await evidence.evaluate(el=>Boolean(el.compareDocumentPosition([...document.querySelectorAll('summary')].find(node=>node.textContent.startsWith('Validation checks')))&Node.DOCUMENT_POSITION_FOLLOWING)),'Evidence precedes check details');
          assert.equal(await evidence.getByText('Reporter photo',{exact:true}).count(),0,'No empty photo card');
          assert(await evidence.getByText('No photo attached',{exact:true}).isVisible(),'Missing photo is indicated without a placeholder');
          const mapPreview=evidence.getByRole('button',{name:'Open this location on the incident map',exact:true});
          const evidenceBox=await evidence.boundingBox(),previewBox=await mapPreview.boundingBox();
          assert(previewBox.width>evidenceBox.width-4,'Location preview fills the evidence row without a photo');
          if(width===1440){
            const observationBox=await snapshot.boundingBox(),decisionBox=await saved.boundingBox();
            assert(decisionBox.x>observationBox.x+observationBox.width,'Observation and decision share one row');
            assert(Math.abs(observationBox.y-decisionBox.y)<2,'Summary cards align at the top');
            if(state==='rejected')assert(box.height<740,'Default details are compact on desktop');
          }

          if(state==='pending')assert((await saved.innerText()).includes('Required checks unavailable'),'Unresolved checks stay visible');
          if(state==='accepted')assert((await saved.innerText()).includes('do not independently confirm'),'Physical support stays distinct from independent confirmation');
          const footer=await dialog.getByRole('button',{name:'Update report status',exact:true}).boundingBox();
          assert(footer&&footer.y>=0&&footer.y+footer.height<= (width===320?640:900),'Staff action remains within the viewport');
        }

        if(state==='manual')assert(text.includes('Pending')&&text.includes('More supporting evidence needed'));
        if(mode==='receipt')assert(!text.includes('Private staff context'),'No staff-only note in receipt');
        if(state==='manual'&&mode==='details') {
          const checked=await page.locator('section[aria-label="Report check"]').innerText();
          const [assessmentDate,updatedDate]=await page.evaluate(()=>[
            '2026-10-26T04:06:00Z','2026-10-26T08:00:00Z',
          ].map(value=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})));
          assert(checked.includes(assessmentDate),'Show the saved evidence time');
          assert(!checked.includes(updatedDate),'Last-updated time must not become the staff-decision timestamp');
          await dialog.getByText('Staff decision history',{exact:true}).click();
          await dialog.getByText('Private staff context',{exact:false}).waitFor();
        }
        if(screenshots&&['rejected','new-evidence'].includes(state)&&width!==320)
          await page.screenshot({path:path.join(screenshots,mode+'-'+state+'-'+width+'.png')});
      }
    }
    await page.setViewportSize({width:390,height:900});
    for(const [state,label] of [['category','Category only'],['measured','Measured by reporter'],['unknown','Method not recorded']]) {
      await page.evaluate(state=>window.showModal('details',state),state);
      const snapshot=page.locator('section[aria-label="Reported observation"]');
      const text=await snapshot.innerText();
      assert(text.includes(label),'Depth method: '+state);
      if(state==='category')assert(!/45\s*cm/.test(text),'No invented numeric depth for category-only reports');
    }
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>window.showModal('details','photo'));
      const evidence=page.locator('section[aria-label="Report evidence"]');
      const photo=evidence.getByRole('button',{name:'View photo full size',exact:true});
      const map=evidence.getByText('Reported location',{exact:true});
      const photoBox=await photo.boundingBox(), mapBox=await map.boundingBox();
      assert(photoBox&&mapBox,'Both evidence panels render');
      assert(width===1440?mapBox.x>photoBox.x+photoBox.width-1:mapBox.y>photoBox.y+photoBox.height-1,'Evidence columns follow viewport width');
      await photo.click();
      const lightbox=page.getByRole('dialog',{name:'Report photo',exact:true});
      await lightbox.waitFor();
      await lightbox.getByRole('button',{name:'Close photo',exact:true}).focus();
      await page.keyboard.press('Tab');
      assert(await lightbox.evaluate(el=>el.contains(document.activeElement)),'Photo focus stays in the lightbox');
      await page.keyboard.press('Escape');
      await lightbox.waitFor({state:'detached'});
      await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='View photo full size');
      assert.equal(await page.getByRole('dialog',{name:'Report details',exact:true}).count(),1,'Closing the photo preserves details');
    }
    await page.evaluate(()=>window.showModal('details','rejected'));
    await page.getByText('Report history',{exact:true}).click();
    assert(await page.getByRole('button',{name:'Copy report ID',exact:true}).isVisible(),'ID copy remains in history');
    assert((await page.getByRole('dialog').innerText()).includes('Last updated'),'History exposes update time separately');
    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:width===320?640:900});
      for(const entryPoint of ['details','table']) {
        for(const [status,reasonCode] of [['VERIFIED','verified.evidence_checked'],['UNVERIFIED','pending.evidence_conflict'],['REJECTED','rejected.not_flood_incident']]) {
          await page.evaluate(entryPoint=>entryPoint==='details'?window.showModal('details','rejected'):window.showTableDecision(),entryPoint);
          await page.getByRole('button',{name:entryPoint==='details'?'Update report status':'Update status for report fixture-',exact:true}).click();
          const decision=page.getByRole('dialog',{name:'Update report status',exact:true});
          await decision.waitFor();
          const box=await decision.boundingBox();
          assert(box.x>=-1&&box.x+box.width<=width+1,'Decision dialog horizontal bounds');
          assert(await decision.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Decision dialog overflow');
          const decisionSelect=decision.getByRole('combobox',{name:/^New status/});
          assert.equal(await decisionSelect.locator('option').count(),3,'Exactly three decisions');
          await decisionSelect.selectOption('UNVERIFIED');
          await decision.getByRole('combobox',{name:/^Reason/}).selectOption('pending.check_unavailable');
          await decisionSelect.selectOption(status);
          // Switching decisions clears the old reason even when returning to Pending.
          if(status==='UNVERIFIED') {
            await decisionSelect.selectOption('VERIFIED');
            await decisionSelect.selectOption('UNVERIFIED');
          }
          const reasonSelect=decision.getByRole('combobox',{name:/^Reason/});
          assert.equal(await reasonSelect.inputValue(),'');
          assert(await decision.getByRole('button',{name:'Save status',exact:true}).isDisabled());
          await reasonSelect.selectOption(reasonCode);
          await decision.getByLabel('Staff note',{exact:false}).fill('Checked original evidence.');
          assert(await decision.getByRole('button',{name:'Save status',exact:true}).isEnabled());
          if(screenshots&&entryPoint==='details'&&status==='UNVERIFIED')
            await page.screenshot({path:path.join(screenshots,'decision-'+width+'.png')});
          await decision.getByRole('button',{name:'Save status',exact:true}).click();
          await decision.waitFor({state:'detached'});
          assert.deepEqual(await page.evaluate(()=>window.updates.at(-1)),{status,reason:{reasonCode,note:'Checked original evidence.'}});
        }
      }
    }
    await page.evaluate(()=>window.showModal('details','rejected'));
    await page.getByRole('button',{name:'Update report status',exact:true}).click();
    const decision=page.getByRole('dialog',{name:'Update report status',exact:true});
    // The nested dialog owns focus and Escape; closing it preserves report details.
    await decision.waitFor();
    const save=decision.getByRole('button',{name:'Save status',exact:true});
    await decision.getByRole('combobox',{name:/^Reason/}).selectOption('rejected.inaccurate_report');
    await save.focus();
    await page.keyboard.press('Tab');
    assert(await decision.evaluate(el=>el.contains(document.activeElement)),'Focus stays in decision dialog');
    const beforeCancel=await page.evaluate(()=>window.updates.length);
    await page.keyboard.press('Escape');
    await decision.waitFor({state:'detached'});
    assert.equal(await page.getByRole('dialog').count(),1,'Report details remain open');
    assert.equal(await page.evaluate(()=>window.updates.length),beforeCancel,'Cancel does not save');
    for(const width of [1440,1280,1024,390,320]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>window.showTableRow());
      await page.getByRole('table').waitFor();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Report table overflow at '+width);
      const row=await page.getByRole('table').innerText();
      assert(row.includes('No qualifying support'),'Table explains the saved basis');
      assert(!row.includes('0 sources'),'Source count is not the assessment basis');
    }
    assert.deepEqual(errors,[]);
    console.log('Report modal checks passed: 36 responsive report states; all three decisions from both entry points at three widths; reason reset, focus, cancellation.');
  }finally{
    await browser?.close();
    fs.unlinkSync(entry);
    fs.rmdirSync(directory);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
