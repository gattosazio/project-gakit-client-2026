const assert = require('node:assert/strict');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('gakit:scenario-disclaimer-seen', 'true'));
    await page.goto(base + '/flood-scenarios', { waitUntil: 'domcontentloaded' });
    const player = page.getByRole('region', { name: 'Flood simulation timeline', exact: true });
    await player.waitFor();
    for (const [width, height] of [[1440, 900], [1024, 720], [768, 600], [1920, 1080], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150); // ResizeObserver updates player clearance.
      const header = await page.locator('header').boundingBox();
      const panel = await page.locator('[data-scenario-controls]').boundingBox();
      const timeline = await player.boundingBox();
      assert(timeline.x >= 0 && timeline.x + timeline.width <= width);
      const legend = page.getByRole('region', { name: 'Map depth legend', exact: true });
      if (width >= 768) {
        assert(Math.abs(header.x + header.width / 2 - width / 2) <= 1, 'Header stays centered');
        assert.equal(header.width, 640, 'Header matches the player width');
        assert.equal(header.height, 58);
        assert.equal(panel.x + panel.width, width - 16);
        if (panel.x >= header.x + header.width + 12) {
          assert.equal(panel.y, header.y, 'Card uses the space beside the header');
        } else {
          assert(panel.y >= header.y + header.height + 12, 'Card drops below the header when space is tight');
        }
        assert(panel.y + panel.height < timeline.y, 'Panel clears playback controls');
        assert(timeline.width <= 640 && timeline.height <= 110);
        const metrics = await page.locator('[data-flood-metric]').evaluateAll(items => items.map(el => {
          const rect = el.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width };
        }));
        assert.equal(metrics.length, 3);
        assert(metrics.every(item => Math.abs(item.y - metrics[0].y) <= 1), 'All three metrics share a desktop row');
        assert(metrics[1].x >= metrics[0].x + metrics[0].width && metrics[2].x >= metrics[1].x + metrics[1].width);
        const depth = await legend.boundingBox();
        assert(depth.x >= panel.x && depth.y + depth.height <= panel.y + panel.height, 'Legend belongs to the control panel');
        const title = await page.getByRole('button', { name: /Change scenario:/ }).locator('[title]').evaluate(el => ({
          scroll: el.scrollHeight, height: el.clientHeight,
        }));
        assert(title.scroll <= title.height, 'Desktop scenario title is not truncated');
      } else {
        assert.equal(header.height, 50);
        assert.equal(await legend.isVisible(), false);
        await page.locator('[aria-label="Flood depth legend"]').waitFor();
      }
      console.log(`${width}x${height}: controls, legend, header and player fit`);
    }
    await page.setViewportSize({ width: 1024, height: 600 });
    await page.getByRole('button', { name: 'Toggle scenario details', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: /^(Show|Hide) flood details$/ }).filter({ visible: true }).count(), 0, 'Desktop metrics do not collapse');
    const panel = await page.locator('[data-scenario-controls]').boundingBox();
    const header = await page.locator('header').boundingBox();
    const timeline = await player.boundingBox();
    assert(panel.y >= header.y + header.height, 'Expanded panel clears header');
    assert(panel.y + panel.height < timeline.y, 'Expanded details clear player on short screens');
    await page.getByRole('button', { name: /Change scenario:/ }).click();
    const menu = page.getByRole('listbox', { name: 'Choose scenario' });
    await menu.waitFor();
    const menuBounds = await menu.boundingBox();
    assert(menuBounds.y >= 0 && menuBounds.y + menuBounds.height <= 600, 'Dropdown fits short screens');
    await page.keyboard.press('Escape');
    assert(new URL(page.url()).pathname === '/flood-scenarios', 'Escape closes dropdown without navigating');
    await page.getByRole('button', { name: 'Next hour', exact: true }).click();
    await page.getByRole('button', { name: 'Previous hour', exact: true }).click();
    console.log('Expanded details, scenario dropdown and playback controls passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
