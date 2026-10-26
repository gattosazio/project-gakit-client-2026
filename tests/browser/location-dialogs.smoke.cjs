const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-location-dialogs-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ReportModal } from '@/components/ReportModal';
    import { HazardAssessmentModal } from '@/components/HazardAssessmentModal';
    import { Spinner } from '@/components/ui/Spinner';
    import { FloodLoader } from '@/components/ui/FloodLoader';
    window.submissions = [];
    const check = async () => ({ floodHazard: 'high', landslide: 'low', stormSurge: null,
      precipMm: window.fixtureRainfall === undefined ? 4.5 : window.fixtureRainfall });
    function Fixture() {
      const [open, setOpen] = useState(null);
      const [location, setLocation] = useState({ lat: 8.2295, lng: 124.2398,
        address: 'Poblacion, Iligan City', source: 'manual' });
      return <><button onClick={() => setOpen('report')}>Open report</button>
        <button onClick={() => setOpen('assessment')}>Open assessment</button>
        <div id="loader-samples">
          {['xs', 'sm', 'md', 'lg'].map(size => <Spinner key={size} size={size} label={'Loading ' + size} />)}
          <FloodLoader active={false} label="Paused water animation" />
        </div>
        <ReportModal isOpen={open === 'report'} onClose={() => setOpen(null)} selectedLocation={location}
          withinCity={true} onLocationChange={async next => setLocation(next)}
          onSubmit={async data => { window.submissions.push(data); await new Promise(resolve => { window.finishSubmit = resolve; }); }} />
        <HazardAssessmentModal isOpen={open === 'assessment'} onClose={() => setOpen(null)}
          selectedLocation={location} withinCity={true} onCheckLocation={check} rainfallHours={window.fixtureRainfallHours || 1} />
      </>;
    }
    createRoot(document.getElementById('fixture')).render(<Fixture />);
  `);
  const stubs = {
    geo: `export const ILIGAN_BOUNDS = [[124.1, 7.9], [124.6, 8.4]];
      export const isRawCoordinateString = address => /^-?\\d+\\.\\d+,/.test(address || '');
      export const reverseGeocode = async () => 'Poblacion, Iligan City';`,
    heat: `export const fetchHeatIndex = async () => ({ expiresAt: new Date(Date.now() + 3600000).toISOString(), validAt: new Date().toISOString(), stale: window.fixtureHeatStale || false });
      export const sampleHeatIndex = () => window.fixtureHeatValue === undefined ? 32 : window.fixtureHeatValue;`,
    dynamic: `import React, { lazy, Suspense } from 'react';
      export default loader => { const Component = lazy(() => loader().then(value => ({ default: value.default || value })));
        return props => <Suspense fallback={null}><Component {...props} /></Suspense>; };`,
    picker: `import React from 'react'; import { Dialog } from '@/components/ui/Dialog';
      export function ReportLocationPicker({initialLocation, onClose, onConfirm}) {
        return <Dialog isOpen onClose={onClose} ariaLabel="Adjust report location">
          <button onClick={onClose}>Cancel adjustment</button>
          <button onClick={() => onConfirm({...initialLocation, lat: 8.24, address: 'Adjusted location'})}>Confirm location</button>
        </Dialog>; }`,
  };
  for (const [name, content] of Object.entries(stubs)) fs.writeFileSync(path.join(directory, name + '.jsx'), content);
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const result = await build({ configFile: false, root, logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' },
    resolve: { alias: [
      { find: '@/lib/map/geoUtils', replacement: path.join(directory, 'geo.jsx') },
      { find: '@/lib/map/heatIndex', replacement: path.join(directory, 'heat.jsx') },
      { find: '@/components/reporting/ReportLocationPicker', replacement: path.join(directory, 'picker.jsx') },
      { find: 'next/dynamic', replacement: path.join(directory, 'dynamic.jsx') },
      { find: '@', replacement: root },
      { find: /^react(\/.*)?$/, replacement: path.join(root, 'node_modules/react$1') },
      { find: /^react-dom(\/.*)?$/, replacement: path.join(root, 'node_modules/react-dom$1') },
    ] },
    build: { write: false, lib: { entry, formats: ['iife'], name: 'LocationDialogsFixture' } },
  });
  const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(items => items.map(item => item.href));
    const fontClasses = await page.evaluate(() => ({ html: document.documentElement.className, body: document.body.className }));
    assert(styles.length > 0, 'Use the running app CSS for accurate layout checks');
    await page.route('**/World_Imagery/MapServer/tile/**', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#acb7a1"/><path d="M0 160L256 90" stroke="#e9e5db" stroke-width="12"/></svg>',
    }));
    await page.route('**/__location-dialogs-fixture', route => route.fulfill({ contentType: 'text/html',
      body: `<html class="${fontClasses.html}"><head>` + styles.map(href => `<link rel="stylesheet" href="${href}">`).join('') + `</head><body class="${fontClasses.body}"><div id="fixture"></div></body></html>`,
    }));
    const load = async (width, height, options = {}) => {
      await page.setViewportSize({ width, height });
      await page.goto(base + '/__location-dialogs-fixture');
      await page.evaluate(options => Object.assign(window, options), options);
      await page.addScriptTag({ content: bundle });
    };
    const checkFit = async dialog => {
      const box = await dialog.boundingBox();
      const viewport = page.viewportSize();
      assert(box.x >= 15 && box.y >= 15 && box.x + box.width <= viewport.width - 15 && box.y + box.height <= viewport.height - 15);
      assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), 'No horizontal overflow');
      const body = dialog.locator('[data-location-dialog-body]');
      const dimensions = await body.evaluate(element => ({ content: element.scrollHeight, viewport: element.clientHeight }));
      if (viewport.height >= 800) assert(dimensions.content <= dimensions.viewport + 1, `No form scrolling: ${JSON.stringify(dimensions)} at ${JSON.stringify(viewport)}`);
      const footer = await dialog.locator('footer').boundingBox();
      assert(footer.y + footer.height <= viewport.height - 15, 'Actions remain visible');
    };
    await load(390, 844);
    const samples = page.locator('#loader-samples');
    await samples.waitFor();
    for (const [size, pixels] of [['xs', 16], ['sm', 18], ['md', 24], ['lg', 32]]) {
      const status = samples.getByRole('status', { name: 'Loading ' + size, exact: true });
      const bounds = await status.locator('svg').boundingBox();
      assert.equal(bounds.width, pixels, `${size} loading size`);
      assert.equal(bounds.height, pixels);
      assert.equal(await status.locator('.flood-loader').count(), 0, `${size} uses the simple circular loader`);
      assert.equal(await status.locator('svg').evaluate(element => getComputedStyle(element).animationName), 'spin', `${size} circular loader animates`);
    }
    const waterLoader = samples.locator('.flood-loader');
    const clipIds = await waterLoader.locator('clipPath').evaluateAll(items => items.map(item => item.id));
    assert.equal(clipIds.length, 1, 'Only the explicit main water loader uses a water animation');
    assert.equal(await waterLoader.locator('.flood-loader-tide').evaluate(element => getComputedStyle(element).animationPlayState), 'paused');
    assert.notEqual(await waterLoader.locator('.flood-loader-wave-front').evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await samples.locator('.flood-loader-tide, .flood-loader-wave-front, .flood-loader-wave-back').evaluateAll(items => items.every(element => getComputedStyle(element).animationName === 'none')), 'Water animations respect reduced motion');
    assert(await samples.getByRole('status', { name: 'Loading sm', exact: true }).locator('svg').evaluate(element => getComputedStyle(element).animationName === 'none'), 'Circular indicators respect reduced motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    console.log('Circular indicator sizes, water loader motion, status labels and reduced motion passed');
    for (const [width, height] of [[320, 568], [390, 844], [768, 600], [1440, 900]]) {
      await load(width, height);
      await page.getByRole('button', { name: 'Open report', exact: true }).click();
      const report = page.getByRole('dialog', { name: 'Report flooding', exact: true });
      await report.waitFor();
      await report.getByRole('button', { name: 'Adjust report location on map', exact: true }).waitFor();
      const categoryRows = await report.locator('[aria-label="Depth categories"] button').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().top)));
      assert.equal(new Set(categoryRows).size, 1, 'All five depth categories stay in one row');
      await checkFit(report);
      assert.equal(await report.getByRole('combobox', { name: 'Depth method' }).count(), 0);
      const reportTheme = await report.locator('header').evaluate(element => getComputedStyle(element).backgroundColor);
      await page.screenshot({ path: path.join(directory, `report-${width}.png`) });
      await page.keyboard.press('Escape');
      await report.waitFor({ state: 'hidden' });
      assert(await page.getByRole('button', { name: 'Open report', exact: true }).evaluate(element => element === document.activeElement), 'Restore focus to report trigger');
      await page.getByRole('button', { name: 'Open assessment', exact: true }).click();
      const assessment = page.getByRole('dialog', { name: 'Hazard assessment', exact: true });
      await assessment.getByText('4.5', { exact: false }).waitFor();
      await checkFit(assessment);
      assert.equal(await assessment.locator('header').evaluate(element => getComputedStyle(element).backgroundColor), reportTheme);
      await page.screenshot({ path: path.join(directory, `assessment-${width}.png`) });
      await assessment.getByRole('button', { name: 'Back to map', exact: true }).click();
      console.log(`${width}×${height}: dialog bounds, visible minimap, theme and dismissal passed`);
    }

    for (const [rain, hours, heat, category, stale] of [
      [0, 1, 32, 'Caution', false], [0, 4, 42, 'Danger', false],
      [null, 1, null, 'No forecast data', false], [4.5, 1, 35, 'Extreme caution', true],
    ]) {
      await load(390, 844, { fixtureRainfall: rain, fixtureRainfallHours: hours, fixtureHeatValue: heat, fixtureHeatStale: stale });
      await page.getByRole('button', { name: 'Open assessment', exact: true }).click();
      const assessment = page.getByRole('dialog', { name: 'Hazard assessment', exact: true });
      const rainfall = assessment.getByRole('region', { name: 'Rainfall', exact: true });
      if (rain === null) await rainfall.getByText('Unavailable', { exact: true }).waitFor();
      else {
        await rainfall.getByText(new RegExp('^' + rain.toFixed(1).replace('.', '\\.') + '\\s')).waitFor();
        assert((await rainfall.innerText()).includes(hours === 1 ? 'mm/hr' : 'mm'));
        assert(!(await rainfall.innerText()).includes('No rainfall recorded'));
        assert((await rainfall.innerText()).includes(hours === 1 ? '1-hour rate' : `${hours}-hour total`));
      }
      const heatCard = assessment.getByRole('region', { name: 'Heat index forecast', exact: true });
      await heatCard.getByText(category, { exact: true }).waitFor();
      assert(!(await heatCard.innerText()).includes('Feels like'));
      assert(!(await heatCard.innerText()).includes('Regional estimate'));
      assert(!(await heatCard.innerText()).includes('Earlier forecast'));
      await checkFit(assessment);
    }
    console.log('Dry versus missing rainfall, accumulation units and heat-stress categories passed');

    await load(390, 844);
    await page.getByRole('button', { name: 'Open report', exact: true }).click();
    const report = page.getByRole('dialog', { name: 'Report flooding', exact: true });
    await report.getByRole('textbox', { name: 'Reported water depth in centimeters' }).fill('45');
    const photoBuffer = await require('sharp')({ create: { width: 40, height: 40, channels: 3, background: '#345678' } }).png().toBuffer();
    await report.locator('input[type=file]').setInputFiles({ name: 'evidence.png', mimeType: 'image/png', buffer: photoBuffer });
    await report.getByText('Photo added', { exact: true }).waitFor();
    await report.getByRole('button', { name: 'Adjust report location on map', exact: true }).click();
    const adjustment = page.getByRole('dialog', { name: 'Adjust report location', exact: true });
    await adjustment.waitFor();
    await adjustment.getByRole('button', { name: 'Confirm location', exact: true }).click();
    await report.waitFor();
    await report.getByText('Adjusted location', { exact: true }).waitFor();
    assert.equal(await report.getByRole('textbox', { name: 'Reported water depth in centimeters' }).inputValue(), '45');
    assert(await report.getByRole('img', { name: 'Selected flood evidence preview' }).evaluate(async element => (await fetch(element.src)).ok), 'Keep photo blob alive during location adjustment');
    await report.getByRole('combobox', { name: 'Observed', exact: true }).selectOption('earlier');
    await report.locator('input[type=datetime-local]').fill('2026-10-23T10:00');
    await checkFit(report);
    await report.getByRole('button', { name: 'Submit report', exact: true }).click();
    await page.waitForFunction(() => window.submissions.length === 1);
    assert.equal(await report.locator('footer .flood-loader').count(), 1, 'Submitting uses the shared water animation');
    await page.keyboard.press('Escape');
    assert(await report.isVisible(), 'Submitting blocks dismissal');
    const submitted = await page.evaluate(() => ({ depth: window.submissions[0].depthCm,
      observation: window.submissions[0].observation, lat: window.submissions[0].location.lat, photo: !!window.submissions[0].photo }));
    assert.equal(submitted.depth, 45);
    assert.equal(submitted.observation.depthMethod, 'estimated');
    assert.equal(submitted.lat, 8.24);
    assert(submitted.photo);
    await page.evaluate(() => window.finishSubmit());
    await report.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log('Submission metadata, observation time, photo retention, location adjustment and busy dismissal passed');
    console.log(`Screenshots: ${directory}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
