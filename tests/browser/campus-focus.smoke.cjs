// Real public map: campus search, opt-in, scoped reports, satellite display and exit.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      const imageryZooms = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        const match = /World_Imagery\/MapServer\/tile\/(\d+)\//.exec(request.url());
        if (match) imageryZooms.push(Number(match[1]));
      });
      await page.addInitScript(() => localStorage.setItem('gakit:onboarding-v1', JSON.stringify({
        version: 1, locationChoice: 'skipped', completedAt: new Date().toISOString(),
      })));
      const report = (id, coordinates, address, age) => ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties: {
        id, address, status: 'VERIFIED', depth: { code: 'knee', label: 'Knee Deep', approximateCm: 50 }, depthCm: 50,
        createdAt: new Date(Date.now() - age).toISOString(), updatedAt: new Date().toISOString(), observedAt: new Date().toISOString(),
      } });
      await page.route('**/api/v1/reports/map?**', route => route.fulfill({ json: { type: 'FeatureCollection', features: [
        report('00000000-0000-4000-8000-000000000001', [124.2435, 8.2416], 'Campus report fixture', 60_000),
        report('00000000-0000-4000-8000-000000000002', [124.251, 8.23], 'Outside campus report fixture', 10_000),
      ] } }));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Map display settings', exact: true }).waitFor({ state: 'visible' });
      if (width < 768) {
        const locationPrompt = page.getByRole('dialog', { name: 'See reports near you', exact: true });
        await locationPrompt.waitFor();
        await locationPrompt.getByRole('button', { name: 'Not now', exact: true }).click();
      }
      const search = page.getByRole('textbox', { name: 'Search for a location in Iligan City', exact: true }).first();
      await search.fill('Mindanao State University');
      await page.getByRole('button', { name: /Mindanao State University – Iligan Institute of Technology/ }).first().click();
      const prompt = page.getByRole('dialog', { name: 'Focus on MSU-IIT', exact: true });
      await prompt.waitFor();
      assert.equal(await page.getByRole('dialog', { name: 'Hazard assessment', exact: true }).count(), 0);
      await prompt.getByRole('button', { name: 'Enable focus view', exact: true }).click();
      const focus = page.getByRole('region', { name: 'Campus focus', exact: true });
      await focus.waitFor();
      assert(!(await focus.innerText()).includes('Satellite view'));
      assert.equal(await page.locator('[data-map-header]').isVisible(), width < 768);
      if (width >= 768) {
        await page.getByRole('button', { name: 'Citizen Flood Reports', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Citizen Flood Reports', exact: true }).click();
        const reports = page.locator('[data-tour="reports"]');
        await reports.getByText('Campus report fixture', { exact: true }).waitFor();
        assert(!(await reports.innerText()).includes('Outside campus report fixture'));
        await page.getByRole('button', { name: 'Minimize sidebar', exact: true }).click();
      }
      await page.waitForTimeout(1500);
      const exit = focus.getByRole('button', { name: 'Exit campus focus', exact: true });
      const bounds = await exit.boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
      const orientation = await page.getByRole('button', { name: 'Reset orientation and view to Iligan City', exact: true }).locator('svg g').getAttribute('transform');
      assert.equal(orientation, width >= 768 ? 'rotate(90 16 16)' : 'rotate(0 16 16)', 'Desktop faces sideways; mobile stays north-up');
      if (width < 768) {
        const region = await focus.boundingBox();
        assert(Math.abs(region.x + region.width / 2 - width / 2) < 2, 'Focus control is centered');
        assert(region.y > height/2 && region.y + region.height <= height-110, 'Mobile focus control clears the header and sits above navigation');
      }
      await page.screenshot({ path: path.join(os.tmpdir(), `gakit-campus-focus-${width}.png`) });
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, -2000);
      await page.waitForTimeout(1200);
      assert(imageryZooms.length > 0 && imageryZooms.every(zoom => zoom <= 18), `Zooming keeps valid imagery instead of requesting unavailable tiles: ${imageryZooms}`);
      await exit.click();
      await focus.waitFor({ state: 'detached' });
      assert.equal(await page.locator('[data-map-header]').isVisible(), true);
      if (width >= 768) await page.locator('[data-tour="reports"]').getByText('Outside campus report fixture', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`${width}x${height}: campus prompt, satellite focus, report scope and exit passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
