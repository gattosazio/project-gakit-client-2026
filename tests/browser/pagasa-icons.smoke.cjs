const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(process.env.GAKIT_SCREENSHOT_DIR || '../downloads/pagasa-icons');
fs.mkdirSync(output, { recursive: true });
const categories = ['LPA', 'TD', 'TS', 'STS', 'TY', 'STY'];
const fixture = {
  track: { type: 'FeatureCollection', features: categories.map((category, i) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [118 + i * 2.5, 15] },
    properties: { typhoon_name: 'ICON CHECK', typhoon_type: category, radius: 0,
      datetime: new Date(Date.now() - (5 - i) * 6 * 3600000).toISOString(), windspeed: 30 + i * 35 },
  })) },
  hasActiveTyphoon: true, stormName: 'ICON CHECK', stormCategory: 'STY',
};
(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('gakit:first-visit-seen', 'true');
        sessionStorage.setItem('gakit:onboarding-auto-located', 'true');
      });
      await page.route('**/api/typhoon-track**', route => route.fulfill({ json:
        new URL(route.request().url()).searchParams.has('history') ? { storms: [] } : fixture,
      }));
      await page.goto(process.env.GAKIT_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: viewport.width < 768 ? 'Map Layers' : 'Expand Layers', exact: true }).click({ timeout: 45000 });
      const toggle = page.getByRole('switch', { name: 'Typhoon tracks', exact: true });
      await toggle.click();
      await page.getByRole('button', { name: 'Legend', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      const images = await dialog.locator('img').evaluateAll(imgs => imgs.map(img => ({ src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth === 600 })));
      assert.equal(images.length, 6);
      assert(images.every(img => img.loaded && img.src.startsWith('/icons/pagasa/')));
      await page.screenshot({ path: path.join(output, `${viewport.width}-legend.png`) });
      await dialog.getByRole('button', { name: 'Close legend modal', exact: true }).click();
      await page.waitForTimeout(1600);
      if (viewport.width > 768) {
        await page.locator('.gakit-typhoon-date-label').last().click();
        const popupIcon = page.locator('.typhoon-popup img');
        await popupIcon.waitFor();
        assert.equal(await popupIcon.getAttribute('src'), '/icons/pagasa/STY.png');
        await page.screenshot({ path: path.join(output, '1440-popup.png') });
        await page.locator('.maplibregl-popup-close-button').click();
      }
      await page.screenshot({ path: path.join(output, `${viewport.width}-track.png`) });
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-checked'), 'false');
      assert.equal(errors.length, 0, errors.join('\n'));
      await page.close();
    }
    console.log('PAGASA icons: desktop/mobile map and legend passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
