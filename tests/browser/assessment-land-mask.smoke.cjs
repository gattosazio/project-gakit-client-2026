const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('../downloads/assessment-land-mask');
fs.mkdirSync(output, { recursive: true });
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
      await page.goto(process.env.GAKIT_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
      await page.locator('.maplibregl-canvas').waitFor({ timeout: 45000 });
      await page.waitForFunction(() => {
        const element = document.querySelector('.maplibregl-map');
        let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
        while (fiber) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const map = hook.memoizedState?.current;
            if (map?.getSource && map?.getStyle) { window.__testLandMap = map; return true; }
          }
          fiber = fiber.return;
        }
        return false;
      });
      const select = async (coordinates, allowed) => {
        await page.evaluate(center => window.__testLandMap.jumpTo({ center, zoom: 12, pitch: 0 }), coordinates);
        await page.waitForTimeout(250);
        await page.waitForFunction(() => {
          const map = window.__testLandMap;
          const layer = map.getLayer('assessment-water-mask');
          return layer && map.isSourceLoaded(layer.source);
        }, { timeout: 20000 });
        const point = await page.evaluate(coords => {
          const p = window.__testLandMap.project(coords); return { x: p.x, y: p.y };
        }, coordinates);
        await page.locator('.maplibregl-canvas').click({ position: point });
        const dialog = page.getByRole('dialog', { name: 'Hazard assessment', exact: true });
        if (allowed) {
          await dialog.waitFor({ timeout: 15000 });
          await page.screenshot({ path: path.join(output, `${viewport.width}-land.png`) });
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
        } else {
          await page.waitForTimeout(400);
          assert.equal(await dialog.count(), 0, `Water at ${coordinates} must not open assessment`);
        }
      };
      for (const basemap of ['Light', 'Bright', 'Dark', 'Satellite']) {
        if (basemap !== 'Light') {
          await page.getByRole('button', { name: 'Map display settings', exact: true }).click();
          await page.getByRole('button', { name: basemap, exact: true }).click();
          await page.getByRole('button', { name: 'Close display settings', exact: true }).click();
        }
        await select([124.18, 8.25], false); // Iligan Bay
        await select([124.27, 7.96], false); // Lake Lanao
        await select([124.265, 8.24], true); // Iligan land
        console.log(`${viewport.width} ${basemap}: sea/lake blocked, land assessment opened`);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
