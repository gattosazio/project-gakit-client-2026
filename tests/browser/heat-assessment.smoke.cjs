// Real modal/map flow, fixture weather: no upstream forecast requests.
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('../downloads/heat-assessment');
fs.mkdirSync(output, { recursive: true });

function fixture(mode) {
  return {
    source: 'ECMWF IFS', unit: '°C', validAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    stale: mode === 'stale', bounds: { west: 116.5, east: 127, south: 4.5, north: 21.5 },
    rows: 25, cols: 10, latitude: Array(25).fill(8), longitude: Array(10).fill(124),
    values: Array(250).fill(mode === 'missing' ? null : 36.4), sampleCount: 250, refreshHours: 3,
  };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let mode = 'ready'; let calls = 0; let delay = 0;
      await page.addInitScript(() => {
        sessionStorage.setItem('gakit:onboarding-auto-located', 'true');
      });
      await page.route('**/api/v1/heat-index/grid?*', async (route) => {
        calls++;
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (mode === 'error') return route.fulfill({ status: 503, json: {}, headers: { 'access-control-allow-origin': '*' } });
        return route.fulfill({ json: fixture(mode), headers: { 'access-control-allow-origin': '*' } });
      });
      const open = async () => {
        await page.goto(process.env.GAKIT_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
        await page.locator('.maplibregl-canvas').waitFor({ timeout: 45000 });
        // Select a known land coordinate after the boundary tiles are ready.
        await page.waitForFunction(() => {
          const element = document.querySelector('.maplibregl-map');
          let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
          while (fiber) {
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const map = hook.memoizedState?.current;
              if (map?.getSource && map?.getStyle) { window.__testAssessmentMap = map; return true; }
            }
            fiber = fiber.return;
          }
          return false;
        });
        await page.evaluate(() => window.__testAssessmentMap.jumpTo({ center: [124.265, 8.24], zoom: 13, pitch: 0 }));
        await page.waitForTimeout(250);
        await page.waitForFunction(() => {
          const map = window.__testAssessmentMap;
          const layer = map.getLayer('assessment-water-mask');
          return layer && map.isSourceLoaded(layer.source);
        });
        const point = await page.evaluate(() => {
          const p = window.__testAssessmentMap.project([124.265, 8.24]);
          return { x: p.x, y: p.y };
        });
        await page.locator('.maplibregl-canvas').click({ position: point });
        await page.getByRole('dialog', { name: 'Hazard assessment', exact: true }).waitFor({ timeout: 45000 });
      };
      await open();
      const dialog = page.getByRole('dialog', { name: 'Hazard assessment', exact: true });
      const heat = dialog.getByRole('region', { name: 'Heat index forecast', exact: true });
      await heat.getByText('36.4', { exact: false }).waitFor();
      assert.equal(calls, 1);
      await heat.getByText('Feels like', { exact: true }).waitFor();
      assert.match(await heat.getByText('Feels like', { exact: true }).getAttribute('title'), /Regional model estimate.*Valid .*PHT/);
      assert.equal(await heat.getByText(/^Valid /).count(), 0);
      await page.screenshot({ path: path.join(output, `${viewport.width}-ready.png`) });
      assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth));
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0);

      mode = 'stale'; await open();
      await heat.getByText('Earlier forecast', { exact: true }).waitFor();
      mode = 'missing'; await open();
      await heat.getByText('Unavailable', { exact: true }).waitFor();
      assert.equal(await heat.getByText(/^Valid /).count(), 0);
      mode = 'error'; await open();
      await heat.getByRole('button', { name: 'Try again', exact: true }).waitFor();
      mode = 'ready'; await heat.getByRole('button', { name: 'Try again', exact: true }).click();
      await heat.getByText('36.4', { exact: false }).waitFor();
      delay = 1500; await open();
      await heat.getByRole('status', { name: 'Loading', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1800);
      assert.equal(await dialog.count(), 0);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ viewport, states: 'ready, stale, missing, error, retry, close while loading passed', calls }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
