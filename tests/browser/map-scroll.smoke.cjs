const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
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
            if (map?.getZoom && map?.getStyle) { window.__testScrollMap = map; return true; }
          }
          fiber = fiber.return;
        }
        return false;
      });
      const state = () => page.evaluate(() => ({
        top: document.getElementById('hazard-map').parentElement.parentElement.scrollTop,
        hash: location.hash, zoom: window.__testScrollMap.getZoom(),
      }));
      const wheel = async (locator, delta) => {
        await locator.hover();
        await page.mouse.wheel(0, delta);
        await page.waitForTimeout(500);
        assert.equal((await state()).top, 0, 'Map wheel gestures must not scroll the page');
        assert.notEqual((await state()).hash, '#about');
      };
      const canvas = page.locator('.maplibregl-canvas');
      const initial = await state();
      await wheel(canvas, 700);
      assert((await state()).zoom < initial.zoom, 'Wheel still zooms the map');
      await page.evaluate(() => window.__testScrollMap.setZoom(window.__testScrollMap.getMinZoom()));
      await wheel(canvas, 1600);
      // Mobile attribution sits underneath the fixed bottom navigation. Use a
      // visible map control there so hover does not scroll it into view first.
      const overlay = viewport.width > 768
        ? page.locator('#hazard-map a', { hasText: 'OpenStreetMap' }).last()
        : page.getByRole('button', { name: 'Reset orientation and view to Iligan City', exact: true });
      await wheel(overlay, 1600);
      // A real nested scroll area exercises the shared guard even on small
      // screens where the production sidebar changes to sheets.
      await page.evaluate(() => {
        const panel = document.createElement('div');
        panel.id = 'test-map-scroll-panel';
        Object.assign(panel.style, { position: 'absolute', left: '40%', top: '30%', width: '120px', height: '100px', overflowY: 'auto', zIndex: '1500' });
        const content = document.createElement('div'); content.style.height = '600px';
        panel.appendChild(content);
        document.querySelector('.maplibregl-map').parentElement.appendChild(panel);
      });
      const panel = page.locator('#test-map-scroll-panel');
      await wheel(panel, 180);
      assert(await panel.evaluate(element => element.scrollTop > 0), 'Nested panel still scrolls');
      await panel.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await wheel(panel, 1600);
      await panel.evaluate(element => { element.scrollTop = 0; });
      await wheel(panel, -1600);
      await panel.evaluate(element => element.remove());
      if (viewport.width > 768) {
        await page.getByRole('button', { name: 'Jump to about section', exact: true }).click();
      } else {
        await page.evaluate(() => document.getElementById('about').scrollIntoView());
      }
      await page.waitForTimeout(700);
      assert((await state()).top > 0, 'Intentional About navigation still works');
      const previous = (await state()).top;
      await page.locator('#about').hover({ position: { x: 200, y: 160 } });
      await page.mouse.wheel(0, -1600);
      await page.waitForTimeout(500);
      assert((await state()).top < previous, 'About retains normal page scrolling');
      assert.deepEqual(errors, []);
      console.log(`${viewport.width}: zoom, zoom limit, attribution, nested scrolling and About navigation passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
