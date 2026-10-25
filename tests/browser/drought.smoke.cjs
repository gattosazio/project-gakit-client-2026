// Isolated climate fixtures exercise the real map; nothing is published as live data.
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('../downloads/drought');
fs.mkdirSync(output, { recursive: true });
const today = new Date().toISOString();
const issued = new Date(Date.now() - 86400000).toISOString();
const expires = new Date(Date.now() + 86400000).toISOString();
function catalog(available = true) {
  return { generatedAt: today, forecastStatus: available ? 'available' : 'unavailable',
    forecastMessage: 'Published DOST-PAGASA outlooks.',
    periods: [{ mode: 'observed', month: '2026-08', stale: false }, { mode: 'observed', month: '2026-09', stale: false },
      ...(available ? Array.from({ length: 6 }, (_, i) => ({ mode: 'forecast', month: i < 3 ? `2026-${10 + i}` : `2027-0${i - 2}`, issuedAt: issued, expiresAt: expires, stale: false })) : [])] };
}
function frame(mode, month) {
  const forecast = mode === 'forecast';
  return { version: 2, mode, month, generatedAt: today, issuedAt: issued,
    expiresAt: forecast ? expires : null, source: 'DOST-PAGASA', sourceUrl: 'https://droughtcaster.pagasa.dost.gov.ph/',
    classification: 'pagasa', metric: 'status', stale: false,
    provinces: [{ id: 'PH10035', name: 'Lanao del Norte',
      status: forecast ? 'dry_spell' : 'drought', sourceId: '1003500000', sourceName: 'Lanao del Norte',
      sourceStatus: forecast ? 'Dry spell' : 'Drought', islandGroup: 'Mindanao', issuedAt: issued },
      { id: 'PH07061', name: 'Siquijor', status: null, sourceId: null, sourceName: null,
        sourceStatus: null, islandGroup: null, issuedAt: null }] };
}
(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  let latestPage;
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      latestPage = page;
      page.setDefaultTimeout(25_000);
      page.setDefaultNavigationTimeout(30_000);
      console.log(`Checking ${width}px drought controls`);
      const errors = [], requests = [];
      let pending = false;
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        sessionStorage.setItem('gakit:onboarding-auto-located', 'true');
        localStorage.setItem('gakit:onboarding-v1', JSON.stringify({ version: 1, locationChoice: 'skipped', completedAt: new Date().toISOString() }));
      });
      await page.route('**/api/v1/drought/**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/catalog')) return route.fulfill({ json: pending ? {
          status: 'pending', generatedAt: null, periods: [], forecastStatus: 'unavailable',
          observedMessage: 'PAGASA assessments are waiting for the first data refresh.',
          forecastMessage: 'PAGASA outlooks are waiting for the first data refresh.',
        } : catalog(), headers: { 'access-control-allow-origin': '*' } });
        const mode = url.searchParams.get('mode'), month = url.searchParams.get('month');
        requests.push({ mode, month });
        return route.fulfill({ json: frame(mode, month), headers: { 'access-control-allow-origin': '*' } });
      });
      await page.goto(process.env.GAKIT_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1800);
      const dismiss = page.getByRole('button', { name: 'Not now', exact: true });
      if (await dismiss.isVisible()) await dismiss.click();
      const toggle = page.getByRole('switch', { name: 'Drought conditions', exact: true });
      const enable = async () => {
        if (!await toggle.isVisible()) await page.getByRole('button', { name: width < 768 ? 'Layers' : 'Map Layers', exact: true }).click();
        await toggle.click();
        await page.getByRole('region', { name: 'Drought timeline', exact: true }).waitFor();
      };
      await enable();
      assert.equal(await page.getByRole('button', { name: 'Report flooding', exact: true }).count(), 0);
      const timelineBox = await page.getByRole('region', { name: 'Drought timeline', exact: true }).boundingBox();
      assert(timelineBox.width <= 620, 'Timeline must stay narrow');
      assert(timelineBox.height <= (width < 768 ? 92 : 96), 'Timeline must stay minimal');
      const legend = page.getByLabel('Drought map legend', { exact: true });
      await legend.waitFor({ state: 'visible' });
      for (const status of ['Not affected', 'Dry condition', 'Dry spell', 'Drought']) assert.equal(await legend.getByText(status, { exact: true }).isVisible(), true);
      if (width < 768) {
        const nav = await page.getByRole('navigation', { name: 'Map navigation', exact: true }).boundingBox();
        assert(timelineBox.y + timelineBox.height <= nav.y, 'Timeline must clear bottom navigation');
        assert(timelineBox.y + timelineBox.height >= 930, 'Mobile timeline should sit near the bottom');
      }
      await page.getByRole('button', { name: 'Sep 2026 observed', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Drought province', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('group', { name: 'Drought months' }).getByRole('button').count(), 8);
      if (width < 768) assert.equal(await page.getByLabel('Drought island summaries', { exact: true }).isVisible(), false);
      else await page.getByLabel('Drought island summaries', { exact: true }).waitFor();
      if (width < 768) assert.equal(requests.length, 1, 'Mobile must not fetch hidden overview previews');
      await page.waitForFunction(() => {
        const element = document.querySelector('.maplibregl-map');
        let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
        while (fiber) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const map = hook.memoizedState?.current;
            if (map?.getLayer?.('drought-provinces-layer')) { window.__testDroughtMap = map; return true; }
          }
          fiber = fiber.return;
        }
        return false;
      });
      assert.equal((await page.locator('.maplibregl-map').boundingBox()).y, 0, 'Month selection must not scroll the surrounding page');
      await page.evaluate(() => {
        const source = window.__testDroughtMap.getSource('drought-provinces');
        window.__droughtGeometryUpdates = 0;
        const original = source.setData.bind(source);
        source.setData = (...args) => { window.__droughtGeometryUpdates++; return original(...args); };
      });
      const selectProvince = async coordinates => {
        await page.evaluate(center => window.__testDroughtMap.jumpTo({ center, zoom: 7, pitch: 0 }), coordinates);
        await page.waitForTimeout(350);
        await page.evaluate(coords => {
          const map = window.__testDroughtMap;
          map.fire('click', { point: map.project(coords), lngLat: { lng: coords[0], lat: coords[1] } });
        }, coordinates);
      };
      await selectProvince([123.9, 8.0]);
      if (width >= 768) {
        await page.getByLabel('Province drought details', { exact: true }).getByText('Drought', { exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelectorAll('[aria-label="Drought overview"] img').length === 8);
        assert.equal(await page.getByLabel('Drought overview', { exact: true }).count(), 1);
        const handle = page.getByRole('button', { name: 'Move drought details', exact: true });
        const before = await handle.boundingBox();
        const beforeRequests = requests.length;
        await page.mouse.move(before.x + 30, before.y + 10); await page.mouse.down();
        await page.mouse.move(before.x - 50, before.y + 90, { steps: 8 }); await page.mouse.up();
        const after = await handle.boundingBox();
        assert(after.x < before.x - 60 && after.y >= 80, 'Overview must drag while staying inside the map');
        assert.equal(requests.length, beforeRequests, 'Dragging must not fetch data');
        await selectProvince([123.55, 9.2]);
        await page.getByText('No published status for this province.', { exact: true }).waitFor();
        await selectProvince([123.9, 8.0]);
      } else assert.equal(await page.getByLabel('Province drought details', { exact: true }).isVisible(), false);
      assert.equal(await page.getByRole('dialog', { name: 'Hazard assessment', exact: true }).count(), 0);
      await selectProvince([120.98, 14.6]); // Metro Manila is not a province; no assessment or pin.
      assert.equal(await page.getByRole('dialog', { name: 'Hazard assessment', exact: true }).count(), 0);
      await selectProvince([123.9, 8.0]);
      assert.equal(await page.locator('.maplibregl-marker').count(), 0);
      const raised = await page.evaluate(() => ({ filter: window.__testDroughtMap.getFilter('drought-province-raised'), translate: window.__testDroughtMap.getPaintProperty('drought-province-raised', 'fill-translate') }));
      assert.deepEqual(raised.filter, ['==', ['get', 'id'], 'PH10035']);
      assert.deepEqual(raised.translate, [0, -5]);
      const labelFilters = await page.evaluate(() => ({ base: window.__testDroughtMap.getFilter('drought-province-label'), selected: window.__testDroughtMap.getFilter('drought-province-selected-label') }));
      assert.deepEqual(labelFilters.base, ['!=', ['get', 'id'], 'PH10035']);
      assert.deepEqual(labelFilters.selected, ['==', ['get', 'id'], 'PH10035']);
      await page.getByRole('button', { name: 'Aug 2026 observed', exact: true }).click();
      await page.waitForTimeout(350);
      assert(requests.some(r => r.month === '2026-08' && r.mode === 'observed'));
      await page.screenshot({ path: path.join(output, `${width}-observed.png`) });
      await page.getByRole('button', { name: 'Mar 2027 forecast', exact: true }).click();
      await page.waitForTimeout(350);
      assert(requests.some(r => r.month === '2027-03' && r.mode === 'forecast'));
      if (width >= 768) await page.getByLabel('Province drought details', { exact: true }).getByText('Dry spell', { exact: true }).waitFor();
      const beforeRepeat = requests.length;
      await page.getByRole('button', { name: 'Mar 2027 forecast', exact: true }).click();
      await page.waitForTimeout(150);
      assert.equal(requests.length, beforeRepeat, 'Reselecting the current month must be idle');
      assert.equal(await page.getByLabel('Loading drought month', { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => window.__droughtGeometryUpdates), 0, 'Month changes must update colors without reparsing boundary geometry');
      await page.getByRole('button', { name: 'Play drought timeline', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Aug 2026 observed"]')?.getAttribute('aria-current') === 'date');
      await page.getByRole('button', { name: 'Pause drought timeline', exact: true }).click();
      await page.getByRole('slider', { name: 'Drought month slider', exact: true }).press('End');
      await page.waitForTimeout(150);
      await page.getByRole('slider', { name: 'Drought month slider', exact: true }).press('ArrowLeft');
      await page.waitForTimeout(350);
      assert(requests.some(r => r.month === '2027-02' && r.mode === 'forecast'), 'Keyboard scrubbing must select the committed month');
      await page.screenshot({ path: path.join(output, `${width}-forecast.png`) });
      await page.getByRole('button', { name: 'Close drought layer', exact: true }).click();
      assert.equal(await page.getByRole('region', { name: 'Drought timeline', exact: true }).count(), 0);
      if (width >= 768) await page.getByRole('button', { name: 'Report flooding', exact: true }).waitFor();
      console.log(`${width}px map interactions passed; checking pending publication`);
      pending = true;
      const beforePending = requests.length;
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1600);
      if (await dismiss.isVisible()) await dismiss.click();
      await enable();
      await page.getByText('PAGASA assessments are waiting for the first data refresh.', { exact: false }).waitFor();
      assert.equal(requests.length, beforePending);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Desktop/mobile timeline, draggable details, 82-province selection without pins, and zero geometry reparses passed.');
  } catch (error) {
    if (latestPage && !latestPage.isClosed()) {
      console.error((await latestPage.locator('body').innerText()).slice(0, 6500));
      await latestPage.screenshot({ path: path.join(output, 'drought-smoke-failure.png') });
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
