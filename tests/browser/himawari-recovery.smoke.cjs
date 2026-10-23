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
      localStorage.setItem('gakit:first-visit-seen', 'true');
      sessionStorage.setItem('gakit:onboarding-auto-located', 'true');
    });
    let outage = true;
    let manifests = 0;
    const images = [];
    await page.route('**/api/himawari-proxy?*', route => {
      const params = new URL(route.request().url()).searchParams;
      if (params.has('manifest')) {
        manifests++;
        return route.fulfill(outage
          ? { status: 503, json: { error: 'upstream outage' } }
          : { json: { frames } });
      }
      images.push(params.get('time'));
      return route.fulfill({ body: png, contentType: 'image/png' });
    });
    await page.goto(process.env.GAKIT_BASE_URL || 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Expand Layers', exact: true }).click({ timeout: 45000 });
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
    await toggle.click();
    const stopped = manifests;
    await page.clock.fastForward(61_000);
    assert.equal(manifests, stopped, 'Disabling the layer stops retries');
    assert.deepEqual(errors, []);
    console.log('Himawari recovery: published stamps, automatic retry, retained frames and disable cleanup passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
