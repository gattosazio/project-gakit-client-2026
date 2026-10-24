const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-welcome-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { OnboardingWelcome } from '@/components/onboarding/OnboardingWelcome';
    window.choices = [];
    function Fixture() {
      const [open, setOpen] = useState(true);
      return <OnboardingWelcome isOpen={open} status={window.fixtureStatus || 'idle'}
        onContinue={gps => { window.choices.push(gps); setOpen(false); }} />;
    }
    createRoot(document.getElementById('fixture')).render(<Fixture />);
  `);
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const result = await build({ configFile: false, root, logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' },
    resolve: { alias: { '@': root, react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') } },
    build: { write: false, lib: { entry, formats: ['iife'], name: 'WelcomeFixture' } },
  });
  const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(items => items.map(item => item.href));
    await page.route('**/__welcome-fixture', route => route.fulfill({ contentType: 'text/html',
      body: styles.map(href => `<link rel="stylesheet" href="${href}">`).join('') + '<div id="fixture"></div>',
    }));
    const load = async (status = 'idle') => {
      await page.goto(base + '/__welcome-fixture');
      await page.evaluate(status => { window.fixtureStatus = status; }, status);
      await page.addScriptTag({ content: bundle });
      return page.getByRole('dialog', { name: 'Welcome to GAKIT', exact: true });
    };
    for (const [width, height] of [[320, 568], [390, 844], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      const dialog = await load();
      await dialog.waitFor();
      const bounds = await dialog.boundingBox();
      assert(bounds.y >= 16 && bounds.y + bounds.height <= height - 16);
      const next = dialog.getByRole('button', { name: 'Continue', exact: true });
      assert(await next.isDisabled());
      await dialog.getByRole('button', { name: 'Privacy notice', exact: true }).click();
      await dialog.getByRole('region', { name: 'Privacy notice', exact: true }).waitFor();
      const agreement = dialog.getByRole('checkbox');
      assert.equal(await agreement.isChecked(), false, 'Reading a notice never checks agreement');
      await dialog.getByRole('button', { name: 'Terms of use', exact: true }).click();
      await dialog.getByRole('region', { name: 'Terms of use', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      assert(await dialog.isVisible());
      await agreement.check();
      assert(await dialog.getByRole('radio', { name: 'Not now. I will find my place myself.', exact: true }).isChecked());
      await next.click();
      await dialog.waitFor({ state: 'hidden' });
      assert.deepEqual(await page.evaluate(() => window.choices), [false]);
      console.log(`${width}px: readable notice, explicit acknowledgement, optional location, stable footer`);
    }
    let dialog = await load();
    await dialog.getByRole('radio', { name: 'Yes, move the map to where I am.', exact: true }).check();
    assert.deepEqual(await page.evaluate(() => window.choices), []);
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => window.choices), [true]);
    dialog = await load('denied');
    assert(await dialog.getByRole('radio', { name: 'Yes, move the map to where I am.', exact: true }).isDisabled());
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => window.choices), [false]);
    await page.close();

    // Exercise the real public-map integration with pre-existing browser permission.
    for (const action of [null, 'assess', 'report', 'dismiss']) {
      const gps = action !== null;
      const context = await browser.newContext({ viewport: { width: 390, height: 844 },
        permissions: ['geolocation'], geolocation: { latitude: 8.2303, longitude: 124.242 } });
      const actual = await context.newPage();
      await actual.addInitScript(() => {
        window.gpsCalls = 0;
        navigator.geolocation.getCurrentPosition = success => {
          window.gpsCalls++;
          success({ coords: { latitude: 8.2303, longitude: 124.242, accuracy: 20,
            altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
        };
      });
      await actual.goto(base, { waitUntil: 'domcontentloaded' });
      const welcome = actual.getByRole('dialog', { name: 'Welcome to GAKIT', exact: true });
      await welcome.waitFor({ timeout: 45000 });
      assert.equal(await actual.evaluate(() => window.gpsCalls), 0, 'Granted permission does not bypass the welcome choice');
      if (gps) await welcome.getByRole('radio', { name: 'Yes, move the map to where I am.', exact: true }).check();
      await welcome.getByRole('checkbox').check();
      await welcome.getByRole('button', { name: 'Continue', exact: true }).click();
      await welcome.waitFor({ state: 'hidden', timeout: 45000 });
      assert.equal(await actual.evaluate(() => window.gpsCalls), gps ? 1 : 0);
      const record = await actual.evaluate(() => JSON.parse(localStorage.getItem('gakit:onboarding-v1')));
      assert.equal(record.locationChoice, gps ? 'gps' : 'skipped');
      const actions = actual.getByRole('group', { name: 'Pinned location actions', exact: true });
      if (gps) {
        await actions.waitFor();
        assert.equal(await actual.getByRole('dialog').count(), 0, 'Pinning never opens an assessment or report automatically');
        const bounds = await actions.boundingBox();
        assert(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'Pin actions fit the mobile map');
        if (action === 'assess') {
          await actions.getByRole('button', { name: 'Assess location', exact: true }).click();
          const assessment = actual.getByRole('dialog', { name: 'Hazard assessment', exact: true });
          await assessment.waitFor();
          await assessment.getByText('8.23030, 124.24200', { exact: true }).waitFor();
        } else if (action === 'report') {
          await actions.getByRole('button', { name: 'Report flooding', exact: true }).click();
          const report = actual.getByRole('dialog', { name: 'Report Flooding', exact: true });
          await report.waitFor();
          await report.getByText('8.2303, 124.2420', { exact: true }).waitFor();
        } else {
          await actions.getByRole('button', { name: 'Dismiss location actions', exact: true }).click();
          await actual.locator('.maplibregl-marker[aria-label="Selected location"]').waitFor();
          assert.equal(await actual.getByRole('dialog').count(), 0);
        }
        await actions.waitFor({ state: 'hidden' });
      } else {
        assert.equal(await actions.count(), 0);
      }
      console.log(`Public map: ${gps ? 'GPS' : 'manual'} choice persisted; no location before Continue`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
