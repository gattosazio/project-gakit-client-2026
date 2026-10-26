// Public header menu alignment and recent-search persistence in the browser.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({channel:process.platform === 'win32' ? 'msedge' : undefined,headless:true});
  try {
    for (const [width,height] of [[1440,900],[390,844],[320,568]]) {
      const page = await browser.newPage({viewport:{width,height}});
      const errors = [];
      page.on('pageerror',error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('gakit:onboarding-v1',JSON.stringify({version:1,locationChoice:'skipped',completedAt:new Date().toISOString()})));
      const load = async () => {
        await page.goto(base,{waitUntil:'domcontentloaded'});
        if (width < 768) await page.getByRole('dialog',{name:'See reports near you',exact:true}).getByRole('button',{name:'Not now',exact:true}).click();
      };
      await load();
      assert(!(await page.locator('[data-map-header]').innerText()).includes('DEMO'));
      const search = page.getByRole('textbox',{name:'Search for a location in Iligan City',exact:true}).first();
      await search.fill('Mindanao State University');
      await page.getByRole('button',{name:/Mindanao State University – Iligan Institute of Technology/}).first().click();
      const campusPrompt = page.getByRole('dialog',{name:'Focus on MSU-IIT',exact:true});
      await campusPrompt.getByRole('button',{name:'Enable focus view',exact:true}).waitFor();
      assert.equal(await campusPrompt.getByRole('button',{name:'Assess this location',exact:true}).count(),0);
      await campusPrompt.getByRole('button',{name:'Go to this location',exact:true}).click();
      await campusPrompt.waitFor({state:'detached'});
      const pinActions = page.getByRole('group',{name:'Pinned location actions',exact:true});
      await pinActions.getByRole('button',{name:'Assess location',exact:true}).waitFor();
      await pinActions.getByRole('button',{name:'Report flooding',exact:true}).waitFor();
      assert.equal(await page.getByRole('dialog',{name:'Hazard assessment',exact:true}).count(),0);
      assert.equal(await page.getByRole('region',{name:'Campus focus',exact:true}).count(),0);
      await load();
      await search.click();
      const recent = page.locator('[aria-label="Recent searches"]');
      await recent.getByRole('button',{name:/Mindanao State University – Iligan Institute of Technology/}).waitFor();
      const positions = [];
      const measure = async label => {
        const panel = page.locator('[data-header-dropdown]:visible').last();
        await panel.waitFor();
        await page.waitForTimeout(180);
        const box = await panel.boundingBox();
        assert(box && box.x >= 0 && box.x + box.width <= width + 1, `${label} fits the viewport`);
        positions.push({label,...box});
      };
      await measure('Search');
      await recent.getByRole('button',{name:/Mindanao State University – Iligan Institute of Technology/}).click();
      await page.getByRole('dialog',{name:'Focus on MSU-IIT',exact:true}).waitFor();
      await page.getByRole('button',{name:'Close campus focus prompt',exact:true}).click();
      await search.click();
      await page.getByRole('button',{name:'Clear recent searches',exact:true}).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('gakit:recent-locations:v1')),null);
      await page.getByRole('button',{name:'Platform Guide',exact:true}).click();
      await measure('Guide');
      await page.getByRole('button',{name:'Close guide',exact:true}).click();
      await page.getByRole('button',{name:'Map display settings',exact:true}).click();
      await measure('Display');
      await page.getByRole('button',{name:'Close display settings',exact:true}).click();
      await page.getByRole('button',{name:width < 768 ? 'Advisories' : 'Notifications',exact:true}).click();
      await measure('Alerts');
      await page.getByRole('button',{name:'Close notifications',exact:true}).click();
      if (width >= 768) {
        await page.getByRole('button',{name:'Open menu',exact:true}).click();
        await measure('Menu');
      }
      assert(Math.max(...positions.map(p=>p.y))-Math.min(...positions.map(p=>p.y)) <= 2,JSON.stringify(positions));
      if (width < 768) assert(Math.max(...positions.map(p=>p.width))-Math.min(...positions.map(p=>p.width)) <= 2,JSON.stringify(positions));
      await page.screenshot({path:path.join(os.tmpdir(),`gakit-header-menu-${width}.png`)});
      assert.deepEqual(errors,[]);
      console.log(`${width}x${height}: aligned menus, recent locations after reload, selection and clearing passed`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
