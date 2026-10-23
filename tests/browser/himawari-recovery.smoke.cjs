const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=', 'base64');
const frames = ['20261023023000', '20261023022000', '20261023021000', '20261023020000', '20261023015000', '20261023014000'];
async function until(predicate) {
  const end = Date.now() + 15000;
  while (!predicate()) {
    if (Date.now() > end) throw Error('Timed out waiting for satellite request');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.addInitScript(() => {
      sessionStorage.setItem('gakit:onboarding-auto-located', 'true');
    });
    let outage = true;
    let published = frames;
    let heldFrame = null;
    let heldRoute = null;
    let manifests = 0;
    const images = [];
    await page.route('**/api/himawari-proxy?*', route => {
      const params = new URL(route.request().url()).searchParams;
      if (params.has('manifest')) {
        manifests++;
        return route.fulfill(outage
          ? { status: 503, json: { error: 'upstream outage' } }
          : { json: { frames: published } });
      }
      images.push(params.get('time'));
      if (params.get('time') === heldFrame) {
        heldRoute = route;
        return;
      }
      return route.fulfill({ body: png, contentType: 'image/png' });
    });
    await page.goto(process.env.GAKIT_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Expand Layers', exact: true }).click({ timeout: 45000 });
    await page.waitForFunction(() => {
      const element = document.querySelector('.maplibregl-map');
      let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
      while (fiber) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const map = hook.memoizedState?.current;
          const source = map?.getSource?.('himawari-ir');
          if (!source) continue;
          window.__himawariDraws = [];
          const update = source.updateImage;
          source.updateImage = function (options) {
            window.__himawariDraws.push(new URL(options.image.src).searchParams.get('time'));
            return update.call(this, options);
          };
          return true;
        }
        fiber = fiber.return;
      }
      return false;
    });
    const toggle = page.getByRole('switch', { name: 'Satellite imagery', exact: true });
    await toggle.click();
    const failure = page.getByText('Himawari satellite imagery is temporarily unavailable. Please try again later.', { exact: true });
    await failure.waitFor();
    assert.equal(images.length, 0, 'No guessed slots during discovery outage');
    outage = false;
    await page.clock.fastForward(31_000);
    await until(() => images.length === 6);
    await failure.waitFor({ state: 'hidden' });
    assert.deepEqual([...images].sort(), [...frames].sort());
    outage = true;
    const previous = manifests;
    await page.clock.fastForward(5 * 60_000 + 1000);
    await until(() => manifests > previous);
    await page.waitForTimeout(300);
    assert.equal(await failure.isVisible(), false, 'Last good frames survive one failed refresh');
    assert.equal(images.length, 6);

    // Hold a newly published scan while five decoded scans are reused. The
    // previous six-frame animation must keep playing until refresh completes.
    outage = false;
    heldFrame = '20261023024000';
    published = [heldFrame, ...frames];
    await page.clock.fastForward(31_000);
    await until(() => heldRoute !== null);
    await page.evaluate(() => { window.__himawariDraws = []; });
    await page.clock.runFor(1500);
    const duringRefresh = await page.evaluate(() => [...new Set(window.__himawariDraws)].sort());
    assert.deepEqual(duringRefresh, [...frames].sort(), 'Refresh preserves the whole previous animation');
    assert.equal(images.length, 7, 'Only the newly published scan is downloaded');
    await heldRoute.fulfill({ body: png, contentType: 'image/png' });
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__himawariDraws = []; });
    await page.clock.runFor(1500);
    const afterRefresh = await page.evaluate(() => [...new Set(window.__himawariDraws)].sort());
    assert.deepEqual(afterRefresh, published.slice(0, 6).sort(), 'Completed refresh replaces the oldest scan');
    await toggle.click();
    const stopped = manifests;
    await page.clock.fastForward(61_000);
    assert.equal(manifests, stopped, 'Disabling the layer stops retries');
    assert.deepEqual(errors, []);
    console.log('Himawari recovery: retry, preserved animation during refresh, cached frame reuse and disable cleanup passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
