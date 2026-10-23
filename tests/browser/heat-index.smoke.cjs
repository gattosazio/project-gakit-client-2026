// Run against the dev client. Weather grids are fixtures; map drawing is real.
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const output = path.resolve(process.env.GAKIT_SCREENSHOT_DIR || '../downloads/heat-index');
fs.mkdirSync(output, { recursive: true });

function fixture(hour, stale = false) {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return {
    source: 'Open-Meteo · ECMWF IFS', model: 'ecmwf_ifs', unit: '°C',
    fetchedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    validAt: new Date(+now + hour * 3600000).toISOString(), stale,
    bounds: { west: 116.5, east: 127, south: 4.5, north: 21.5 }, rows: 25, cols: 10,
    latitude: Array.from({ length: 25 }, (_, i) => 21.16 - 0.68 * i),
    longitude: Array.from({ length: 10 }, (_, i) => 117.025 + 1.05 * i),
    values: Array(250).fill(hour === 24 ? 45 : 35), sampleCount: 250, refreshHours: 3,
  };
}

(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /heat-index/.test(message.text())) errors.push(message.text());
      });
      await page.addInitScript(() => {
        localStorage.setItem('gakit:first-visit-seen', 'true');
        sessionStorage.setItem('gakit:onboarding-auto-located', 'true');
      });
      const requests = [];
      let unavailable = false;
      await page.route('**/api/v1/heat-index/grid?*', async (route) => {
        const hour = Number(new URL(route.request().url()).searchParams.get('forecast_hour'));
        requests.push(hour);
        if (hour === 6) await new Promise((resolve) => setTimeout(resolve, 800));
        if (unavailable) return route.fulfill({ status: 503, json: { detail: 'Unavailable' }, headers: { 'access-control-allow-origin': '*' } });
        return route.fulfill({ json: fixture(hour, hour === 12), headers: { 'access-control-allow-origin': '*' } });
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const layers = page.getByRole('button', { name: viewport.width < 768 ? 'Map Layers' : 'Expand Layers', exact: true });
      await layers.waitFor({ timeout: 45000 });
      await layers.click();
      const toggle = page.getByRole('switch', { name: 'Heat index', exact: true });
      await toggle.click();
      await page.getByText(/^Valid .* PHT$/).waitFor();
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(output, `${viewport.width}-heat.png`) });
      assert.equal(await toggle.getAttribute('aria-checked'), 'true');
      const hours = page.getByRole('group', { name: 'Heat-index forecast hour' });
      await hours.getByRole('button', { name: '+24h', exact: true }).click();
      await page.getByText(/^Valid .* PHT$/).waitFor();
      assert(requests.includes(24));
      await hours.getByRole('button', { name: '+12h', exact: true }).click();
      await page.getByText('Using an earlier forecast. Update pending.').waitFor();
      await hours.getByRole('button', { name: '+6h', exact: true }).click();
      await toggle.click();
      await page.waitForTimeout(1000);
      assert.equal(await toggle.getAttribute('aria-checked'), 'false');
      assert.equal(await page.getByRole('group', { name: 'Heat-index forecast hour' }).count(), 0);
      await toggle.click();
      await page.getByText(/^Valid .* PHT$/).waitFor();

      if (viewport.width > 768) {
        await hours.getByRole('button', { name: '+24h', exact: true }).click();
        await page.getByText(/^Valid .* PHT$/).waitFor();
        await page.waitForTimeout(500);
        const enabled = await page.screenshot();
        await toggle.click();
        await page.waitForTimeout(500);
        const disabled = await page.screenshot();
        const area = { left: 900, top: 250, width: 100, height: 100 };
        const [on, off] = await Promise.all([enabled, disabled].map((png) => sharp(png).extract(area).removeAlpha().raw().toBuffer()));
        const delta = on.reduce((sum, value, index) => sum + Math.abs(value - off[index]), 0) / on.length;
        assert(delta > 5, `Heat toggle must alter the actual map pixels (delta=${delta})`);
        await toggle.click();
        await page.getByText(/^Valid .* PHT$/).waitFor();
        await page.getByRole('button', { name: 'Map display settings', exact: true }).click();
        await page.getByRole('button', { name: 'Satellite', exact: true }).click();
        await page.getByRole('button', { name: 'Close display settings', exact: true }).click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(output, 'satellite-heat.png') });
        assert.equal(await toggle.getAttribute('aria-checked'), 'true');
      }

      unavailable = true;
      await hours.getByRole('button', { name: '+3h', exact: true }).click();
      await page.getByText('Heat-index forecast is temporarily unavailable.').waitFor();
      unavailable = false;
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.getByText(/^Valid .* PHT$/).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ viewport, requests, states: 'loaded, forecast, stale, late response, error, retry passed' }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack); process.exit(1); });
