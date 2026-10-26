// A review recommendation must not replace the report's saved decision.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-evidence-review-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { ReportAssessment } from '@/app/monitoring/features/reports/ReportAssessment';
    const report = { id:'fixture', status:'REJECTED', decisionSource:'automated',
      validationSummary:{assessedAt:'2026-10-26T00:00:00Z',recommendedStatus:'REJECTED',
        decisionBasis:null,checkState:'complete',reviewAvailable:true,support:[],missing:[],
        conflicts:['CURRENT_CONDITIONS_UNSUPPORTED'],context:[],explanation:'Saved rejection'} };
    createRoot(document.getElementById('root')).render(React.createElement(ReportAssessment,{report}));
  `);
  let browser;
  try {
    const result = await build({
      configFile:false, root, logLevel:'error', define:{'process.env.NODE_ENV':'"production"'},
      resolve:{alias:[{find:'react',replacement:path.join(root,'node_modules/react')},
        {find:'react-dom',replacement:path.join(root,'node_modules/react-dom')},{find:'@',replacement:root}]},
      plugins:[{name:'review-fixture', enforce:'pre',
        resolveId(id) { if (id.endsWith('/actions/reports')) return '\0review-api'; },
        load(id) { if(id==='\0review-api') return `
          export async function fetchReportReviewHistory(id,signal) {
            return (await fetch('/review-api/'+id,{signal})).json();
          }
          export async function requestReportReassessment(id) {
            await fetch('/review-api/'+id,{method:'POST'});
          }`;
        },
      }],
      build:{write:false,minify:false,lib:{entry,formats:['iife'],name:'ReviewFixture'}},
    });
    const bundle = (Array.isArray(result)?result[0]:result).output.find(item=>item.type==='chunk').code;
    browser = await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
    const page = await browser.newPage({viewport:{width:390,height:844}});
    let requested = 0;
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/review-fixture',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
    await page.route('**/review-api/fixture',route=>{
      if(route.request().method()==='POST') {
        requested++;
        return route.fulfill({json:{status:'queued'}});
      }
      return route.fulfill({json:{reportRevision:1,jobs:[],assessments:requested ? [{
        id:2,report_revision:1,applied:false,trigger:'staff_request',
        assessment:{result:{assigned_status:'VERIFIED',explanation:'New evidence supports flooding.'}},
      }] : []}});
    });
    await page.goto(`${process.env.GAKIT_BASE_URL || 'http://localhost:3000'}/review-fixture`);
    await page.addScriptTag({content:bundle});
    await page.getByText('Rainfall and flood estimates do not support this report.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Request evidence review',exact:true}).click();
    await page.getByText('Assessment recommendation: Validated',{exact:true}).waitFor();
    assert(await page.getByText('Rainfall and flood estimates do not support this report.',{exact:true}).isVisible());
    assert(await page.getByText('Review recommendation only. Use the report actions to record your decision.',{exact:true}).isVisible());
    assert.equal(requested,1);
    assert.deepEqual(errors,[]);
    console.log('Evidence review browser check passed: new recommendation leaves saved decision visible.');
  } finally {
    await browser?.close();
    fs.unlinkSync(entry);
    fs.rmdirSync(directory);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
