const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-display-loading-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React, { useRef, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { useMapDisplayLoading } from '@/hooks/useMapDisplayLoading';
    import { PageLoader } from '@/components/ui/LoadingState';
    import { MapDisplayPopover } from '@/components/header/MapDisplayPopover';
    const listeners = new Map();
    let ready = true, moving = false, layerPending = false;
    const map = {
      on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
      off(type, fn) { listeners.get(type)?.delete(fn); },
      isStyleLoaded: () => ready, areTilesLoaded: () => ready, isMoving: () => moving,
      triggerRepaint() { requestAnimationFrame(() => window.emit('render')); },
    };
    window.emit = type => [...(listeners.get(type) || [])].forEach(fn => fn());
    window.finishTiles = () => { ready = true; window.emit('render'); };
    window.finishCamera = () => { moving = false; window.emit('render'); };
    window.listenerCount = () => [...listeners.values()].reduce((total, set) => total + set.size, 0);
    function Fixture() {
      const mapRef = useRef(map), layers = useRef(true);
      const { loading, run } = useMapDisplayLoading(mapRef, layers);
      const [settings, setSettings] = useState({ basemap: 'light', mode: '2d', showBuildings: true, smoothPolygons: true, showRoads: false, showBarangayBoundaries: false });
      const change = (key, field) => value => {
        setSettings(previous => ({ ...previous, [field]: value }));
        if (['basemap', 'mode', 'buildings'].includes(key)) run(key, () => { ready = false; });
      };
      window.pending = loading;
      window.runDeferred = () => run('mode', () => new Promise(resolve => { window.finishWork = resolve; }));
      window.runCamera = () => run('mode', () => { moving = true; });
      window.runLayer = () => run('layers', () => { layerPending = true; }, () => layerPending);
      window.finishLayerData = () => { layerPending = false; map.triggerRepaint(); };
      window.runFailure = () => run('buildings', () => { throw new Error('Expected fixture failure'); });
      return <><PageLoader isLoading={Object.values(loading).some(Boolean)} /><MapDisplayPopover {...settings}
        onBasemapChange={change('basemap', 'basemap')} onModeChange={change('mode', 'mode')}
        onBuildingsChange={change('buildings', 'showBuildings')} onSmoothingChange={change('smoothing', 'smoothPolygons')}
        onRoadsChange={change('roads', 'showRoads')} onBarangayBoundariesChange={change('boundaries', 'showBarangayBoundaries')} /></>;
    }
    const instance = createRoot(document.getElementById('fixture'));
    instance.render(<Fixture />);
    window.unmountFixture = () => instance.unmount();
  `);
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const result = await build({ configFile: false, root, logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' },
    resolve: { alias: { '@': root, react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') } },
    build: { write: false, lib: { entry, formats: ['iife'], name: 'MapDisplayFixture' } },
  });
  const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(elements => elements.map(element => element.href));
    await page.route('**/__display-loading-fixture', route => route.fulfill({ contentType: 'text/html',
      body: styles.map(href => '<link rel="stylesheet" href="' + href + '">').join('') + '<div id="fixture" style="position:absolute;right:24px;top:16px"></div>',
    }));
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/__display-loading-fixture');
      await page.addScriptTag({ content: bundle });
      await page.getByRole('button', { name: 'Map display settings', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Map display settings' });
      const initialHeight = (await panel.boundingBox()).height;
      const actions = [
        ['basemap', page.getByRole('button', { name: 'Satellite', exact: true })],
        ['mode', page.getByRole('switch', { name: '3D view', exact: true })],
        ['buildings', page.getByRole('switch', { name: 'Buildings', exact: true })],
      ];
      for (const [key, control] of actions) {
        await control.click();
        await page.waitForFunction(key => window.pending[key] && window.listenerCount() > 0, key);
        const overlay = page.getByRole('status', { name: 'Loading page', exact: true });
        await overlay.waitFor();
        assert.equal(await panel.locator('.flood-loader').count(), 0, 'No compact display animations');
        const bounds = await overlay.boundingBox();
        assert.equal(bounds.width, width);
        assert.equal(bounds.height, 900);
        assert.equal((await overlay.locator('.flood-loader').boundingBox()).width, 80, 'Full-size water animation');
        assert.equal((await panel.boundingBox()).height, initialHeight, 'Loading never changes panel height');
        await page.evaluate(() => window.emit('idle'));
        assert(await page.evaluate(key => window.pending[key], key), 'An early idle event cannot hide loading before tiles finish');
        await page.evaluate(() => window.finishTiles());
        await page.waitForFunction(key => !window.pending[key], key);
        assert.equal(await page.evaluate(() => window.listenerCount()), 0);
      }
      for (const label of ['Polygon smoothing', 'Roads', 'Barangay boundaries']) {
        await page.getByRole('switch', { name: label, exact: true }).click();
        assert.equal(await page.getByRole('status', { name: 'Loading page', exact: true }).count(), 0, label + ' does not show a full-page loader');
      }
      await page.evaluate(() => window.runDeferred());
      await page.waitForFunction(() => Boolean(window.finishWork));
      await page.evaluate(() => window.emit('idle'));
      assert(await page.evaluate(() => window.pending.mode), 'Wait for asynchronous setup before map readiness');
      await page.evaluate(() => window.finishWork());
      await page.waitForFunction(() => !window.pending.mode);
      await page.evaluate(() => window.runCamera());
      await page.waitForFunction(() => window.listenerCount() > 0);
      await page.evaluate(() => window.emit('render'));
      assert(await page.evaluate(() => window.pending.mode), 'Wait for camera motion to finish');
      await page.evaluate(() => window.finishCamera());
      await page.waitForFunction(() => !window.pending.mode);
      await page.evaluate(() => window.runFailure());
      await page.waitForFunction(() => !window.pending.buildings);
      await page.evaluate(() => window.runLayer());
      await page.waitForFunction(() => window.pending.layers && window.listenerCount() > 0);
      await page.evaluate(() => window.emit('idle'));
      assert(await page.evaluate(() => window.pending.layers), 'Layer downloads keep the full-page animation visible after map idle');
      await page.evaluate(() => window.finishLayerData());
      await page.waitForFunction(() => !window.pending.layers);
      await page.getByRole('switch', { name: 'Buildings', exact: true }).click();
      await page.waitForFunction(() => window.listenerCount() > 0);
      await page.evaluate(() => window.unmountFixture());
      assert.equal(await page.evaluate(() => window.listenerCount()), 0, 'Unmount removes map listeners');
      console.log('Map display ' + width + 'px: basemap/3D/buildings and layer downloads, stable height, tile/setup/camera completion, errors and cleanup passed');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
