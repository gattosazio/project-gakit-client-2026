// Real React receipt: saved assessment, later reassessment, and polling cleanup.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-receipt-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { SuccessModal } from '@/app/public-view/components/SuccessModal';
    const root = createRoot(document.getElementById('root'));
    const report = { id:'fixture', status:'VERIFIED', decisionSource:'automated',
      location:{lat:8.2,lng:124.2,address:'Fixture location'},
      depth:{code:'knee',label:'Knee',approximateCm:45}, submittedAt:'Now',
      validationSummary:{explanation:'Original saved assessment'} };
    window.closeReceipt = () => root.render(React.createElement(SuccessModal, {
      isOpen:false, report, onClose:()=>{} }));
    root.render(React.createElement(SuccessModal, {
      isOpen:true, report, onClose:window.closeReceipt }));
  `);
  let browser;
  try {
    const result = await build({
      configFile:false, root, logLevel:'error', define:{'process.env.NODE_ENV':'"production"'},
      resolve:{alias:[
        {find:'react', replacement:path.join(root,'node_modules/react')},
        {find:'react-dom', replacement:path.join(root,'node_modules/react-dom')},
        {find:'@', replacement:root},
      ]},
      plugins:[{name:'receipt-fixture', enforce:'pre',
        resolveId(id) {
          if (id.replaceAll('\\','/').endsWith('/app/public-view/actions/publicView')) return '\0receipt-api';
        },
        load(id) {
          if (id === '\0receipt-api') return `export async function fetchReportReceipt(id,signal) {
            const r=await fetch('/receipt-api/'+id,{signal}); if(!r.ok) throw Error(); return r.json();
          }`;
        },
      }],
      build:{write:false, minify:false, lib:{entry, formats:['iife'], name:'ReceiptFixture'}},
    });
    const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
    browser = await chromium.launch({channel:process.platform === 'win32' ? 'msedge' : undefined, headless:true});
    const page = await browser.newPage();
    let requests = 0;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/receipt-fixture', route => route.fulfill({contentType:'text/html', body:'<div id="root"></div>'}));
    await page.route('**/receipt-api/fixture', route => {
      requests++;
      return route.fulfill({json:{status:requests > 1 ? 'ANOMALY' : 'VERIFIED', decisionSource:'automated',
        validationSummary:{explanation:requests > 1 ? 'Saved reassessment requires review' : 'Saved current assessment',
          assessedAt:'2026-10-19T04:45:00Z'}}});
    });
    await page.goto(`${process.env.GAKIT_BASE_URL || 'http://localhost:3000'}/receipt-fixture`);
    await page.addScriptTag({content:bundle});
    await page.getByText('Saved current assessment', {exact:true}).waitFor();
    await page.getByText('Saved reassessment requires review', {exact:true}).waitFor({timeout:10000});
    await page.getByText('Updated after submission.', {exact:true}).waitFor();
    const dialog = await page.locator('[role="dialog"]').innerText();
    assert(dialog.includes('Flagged for review'));
    assert(!dialog.includes('Original saved assessment'));
    await page.getByRole('button', {name:'Done', exact:true}).click();
    const atClose = requests;
    await page.waitForTimeout(5500);
    assert.equal(requests, atClose);
    assert.deepEqual(errors, []);
    console.log('Receipt browser check passed: saved explanation, changed status, polling cleanup.');
  } finally {
    await browser?.close();
    fs.unlinkSync(entry);
    fs.rmdirSync(directory);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
