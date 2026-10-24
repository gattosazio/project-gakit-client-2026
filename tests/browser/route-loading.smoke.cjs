const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-route-loading-'));
  const entry = path.join(directory, 'entry.jsx');
  fs.writeFileSync(entry, `
    import React, { useEffect, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { RouteLoaderProvider, useRouteLoader } from '@/components/RouteLoader';
    import { PageLoader } from '@/components/ui/LoadingState';
    function Portal() {
      const [pending, setPending] = useState(false);
      const [reportsPending, setReportsPending] = useState(true);
      const [arrived, setArrived] = useState(false);
      const { navigate } = useRouteLoader();
      window.beginPortalLoad = () => setPending(true);
      window.finishReportLoad = () => setReportsPending(false);
      window.finishPortalLoad = () => { setArrived(true); setPending(false); };
      useEffect(() => {
        const canvas = document.querySelector('[data-fixture-canvas]');
        if (canvas) { const context = canvas.getContext('2d'); context.fillStyle = '#7a0019'; context.fillRect(0, 0, 100, 40); }
      }, [arrived, pending]);
      if (pending) return <><PageLoader label="Loading administration…" />{reportsPending && <PageLoader label="Loading flood reports…" />}</>;
      return <main style={{ minHeight: '100vh', padding: 24, background: '#f8fafc' }}>
        <h1>{arrived ? 'Administration portal' : 'Monitoring portal'}</h1>
        <button onClick={() => navigate('/admin')}>Switch portal</button>
        <div data-fixture-scroll style={{ height: 60, overflow: 'auto' }}><div style={{ height: 600 }}>Portal records</div></div>
        <canvas data-fixture-canvas width="100" height="40" />
        <svg width="100" height="40"><defs><clipPath id="fixture-clip"><rect width="100" height="40" /></clipPath></defs><rect clipPath="url(#fixture-clip)" width="100" height="40" fill="blue" /></svg>
      </main>;
    }
    createRoot(document.getElementById('fixture')).render(<RouteLoaderProvider><Portal /></RouteLoaderProvider>);
  `);
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const result = await build({
    configFile: false, root, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' },
    resolve: { alias: { 'next/navigation': '\0fixture-navigation', '@': root, react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') } },
    esbuild: { jsx: 'automatic' },
    plugins: [{
      name: 'route-loading-navigation',
      enforce: 'pre',
      resolveId(id) { if (id === 'next/navigation') return '\0fixture-navigation'; },
      load(id) {
        if (id !== '\0fixture-navigation') return;
        return `
          import { useSyncExternalStore } from 'react';
          let pathname = '/monitoring'; const listeners = new Set(); const params = new URLSearchParams();
          const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
          const getPath = () => pathname;
          const router = { push(path) { pathname = path; listeners.forEach(listener => listener()); window.beginPortalLoad(); } };
          export const useRouter = () => router;
          export const usePathname = () => useSyncExternalStore(subscribe, getPath, getPath);
          export const useSearchParams = () => params;
        `;
      },
    }],
    build: { write: false, lib: { entry, formats: ['iife'], name: 'RouteLoadingFixture' } },
  });
  const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error('Fixture page error:', error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(elements => elements.map(element => element.href));
    await page.route('**/__route-loading-fixture', route => route.fulfill({ contentType: 'text/html',
      body: styles.map(href => `<link rel="stylesheet" href="${href}">`).join('') + '<div id="fixture"></div>',
    }));
    await page.clock.install();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/__route-loading-fixture`);
      await page.addScriptTag({ content: bundle });
      await page.getByRole('button', { name: 'Switch portal' }).waitFor({ timeout: 10000 });
      await page.locator('[data-fixture-scroll]').evaluate(element => { element.scrollTop = 120; });
      await page.getByRole('button', { name: 'Switch portal' }).click();
      const overlay = page.getByRole('status', { name: 'Loading page', exact: true });
      await overlay.waitFor();
      assert.equal(await overlay.count(), 1, 'Nested route fallbacks share one overlay');
      await overlay.getByText('Loading flood reports…', { exact: true }).waitFor();
      await page.evaluate(() => window.finishReportLoad());
      await overlay.getByText('Loading administration…', { exact: true }).waitFor();
      const snapshot = page.locator('[data-route-snapshot]');
      assert((await snapshot.textContent()).includes('Monitoring portal'));
      assert.equal(await snapshot.locator('[data-fixture-scroll]').evaluate(element => element.scrollTop), 120);
      assert.equal(await snapshot.locator('[data-fixture-canvas]').evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, 1, 1).data[0]), 122);
      assert.equal(await snapshot.locator('#fixture-clip').count(), 0, 'Snapshot IDs do not collide with the live page');
      await page.clock.runFor(9000);
      assert(await overlay.isVisible(), 'An active server fallback keeps the outgoing view through a slow load');
      await page.evaluate(() => window.finishPortalLoad());
      await page.clock.runFor(400);
      await overlay.waitFor({ state: 'hidden' });
      assert.equal(await snapshot.locator(':scope > *').count(), 0, 'Outgoing content is removed after arrival');
      await page.getByRole('heading', { name: 'Administration portal' }).waitFor();
      console.log(`Route transition ${width}px: single overlay, preserved scroll/canvas, slow fallback and cleanup passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
