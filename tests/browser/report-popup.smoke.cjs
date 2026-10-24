// Real MapLibre events: minimal desktop hover, persistent click card and mobile taps.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gakit-report-popup-'));
  const entry = path.join(directory, 'fixture.jsx');
  fs.writeFileSync(entry, `
    import React, { useEffect, useRef, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import * as gl from 'maplibre-gl';
    import { useMapPopups } from '@/hooks/useMapPopups';
    function Fixture() {
      const container = useRef(null), mapRef = useRef(null);
      const [ready, setReady] = useState(false);
      const boundaries = useRef(false), onReportClick = useRef(undefined);
      const { attachLayerEvents } = useMapPopups({ mapRef, mapReady: ready,
        showBarangayBoundariesRef: boundaries, onReportClickRef: onReportClick });
      const attach = useRef(attachLayerEvents);
      attach.current = attachLayerEvents;
      useEffect(() => {
        gl.setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs');
        const map = new gl.Map({ container: container.current, center: [124.26,8.22], zoom: 16,
          attributionControl: false, style: { version: 8, sources: {},
            layers: [{id:'background', type:'background', paint:{'background-color':'#e2e8f0'}}] } });
        mapRef.current = map;
        window.fixtureMap = map;
        map.on('load', () => {
          map.addSource('reports', {type:'geojson', cluster:true, clusterMaxZoom:12, clusterRadius:50,
            data:{type:'FeatureCollection', features:[0,1,2].map(index => ({
            type:'Feature', geometry:{type:'Point',coordinates:[124.26+index*0.002,8.22]}, properties:{
              id:'test-report-'+index, kind:'report', depthLabel:'Knee Deep (50 cm)', status:'VERIFIED',
              address:'Quezon Avenue, Iligan City', demoAutoValidated:true,
              createdAt:new Date(Date.now()-300000).toISOString(),
            }}))}});
          map.addLayer({id:'report-clusters',type:'circle',source:'reports',filter:['has','point_count'],
            paint:{'circle-radius':14,'circle-color':'#2563eb'}});
          map.addLayer({id:'report-points',type:'circle',source:'reports',filter:['!',['has','point_count']],paint:{
            'circle-radius':10,'circle-color':'#2563eb','circle-stroke-width':2,'circle-stroke-color':'#fff'}});
          attach.current(map);
          window.rebindEvents = () => attach.current(map);
          setReady(true);
        });
        return () => map.remove();
      }, []);
      return <div ref={container} style={{position:'fixed',inset:0}} />;
    }
    createRoot(document.getElementById('fixture')).render(<Fixture />);
  `);
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const result = await build({ configFile: false, root, logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' },
    resolve: { alias: [
      { find: '@', replacement: root },
      { find: /^react(\/.*)?$/, replacement: path.join(root, 'node_modules/react$1') },
      { find: /^react-dom(\/.*)?$/, replacement: path.join(root, 'node_modules/react-dom$1') },
      { find: 'maplibre-gl', replacement: path.join(root, 'node_modules/maplibre-gl/dist/maplibre-gl.mjs') },
    ] }, build: { write: false, lib: { entry, formats: ['iife'], name: 'ReportPopupFixture' } },
  });
  const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    for (const [width, height] of [[1440,900],[390,844]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 768 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base, {waitUntil:'domcontentloaded'});
      const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(items => items.map(item => item.href));
      await page.route('**/__report-popup/page', route => route.fulfill({ contentType: 'text/html',
        body: '<html><head>' + styles.map(url => '<link rel="stylesheet" href="' + url + '">').join('') + '</head><body><div id="fixture"></div></body></html>' }));
      await page.goto(`${base}/__report-popup/page`);
      await page.addStyleTag({ content: fs.readFileSync(path.join(root,'node_modules/maplibre-gl/dist/maplibre-gl.css'),'utf8') });
      await page.addScriptTag({ content: bundle });
      await page.waitForFunction(() => window.fixtureMap?.getLayer('report-points') && window.fixtureMap.isStyleLoaded());
      const point = await page.evaluate(() => window.fixtureMap.project([124.26,8.22]));
      await page.mouse.move(point.x, point.y);
      if (width >= 768) {
        const hover = page.getByRole('tooltip');
        await hover.waitFor();
        assert((await hover.innerText()).includes('Knee Deep (50 cm)'));
        assert((await hover.innerText()).includes('Verified'));
        assert(!(await hover.innerText()).includes('Quezon Avenue'));
        await page.screenshot({path:path.join(os.tmpdir(),'gakit-report-hover.png')});
        await page.mouse.move(10,10);
        await hover.waitFor({state:'detached'});
      } else assert.equal(await page.getByRole('tooltip').count(),0);
      await page.mouse.click(point.x,point.y);
      const popup = page.locator('.gakit-report-popup');
      await popup.waitFor();
      assert((await popup.innerText()).includes('Quezon Avenue, Iligan City'));
      assert(!(await popup.innerText()).includes('Origin'));
      assert(!(await popup.innerText()).includes('evidence checks skipped'));
      await page.mouse.move(10,10);
      assert(await popup.isVisible());
      await page.screenshot({path:path.join(os.tmpdir(),`gakit-report-popup-${width}.png`)});
      await popup.getByRole('button',{name:'Close popup',exact:true}).click();
      await popup.waitFor({state:'detached'});
      await page.evaluate(() => { window.rebindEvents(); window.rebindEvents(); });
      await page.mouse.click(point.x,point.y);
      await popup.waitFor();
      assert.equal(await page.locator('.gakit-report-popup').count(),1);
      await popup.getByRole('button',{name:'Close popup',exact:true}).click();
      await page.mouse.move(10,10);
      await page.evaluate(() => window.fixtureMap.jumpTo({zoom:10}));
      await page.waitForFunction(() => window.fixtureMap.queryRenderedFeatures({layers:['report-clusters']}).some(feature => feature.properties.point_count === 3));
      const clusterPoint = await page.evaluate(() => {
        const feature = window.fixtureMap.queryRenderedFeatures({layers:['report-clusters']})[0];
        return window.fixtureMap.project(feature.geometry.coordinates);
      });
      await page.mouse.move(clusterPoint.x,clusterPoint.y);
      if (width >= 768) {
        const hover = page.getByRole('tooltip');
        await hover.waitFor();
        assert((await hover.innerText()).includes('3 reports'));
        assert((await hover.innerText()).includes('Click to expand'));
        await page.screenshot({path:path.join(os.tmpdir(),'gakit-report-cluster-hover.png')});
        await page.mouse.click(clusterPoint.x,clusterPoint.y);
      } else {
        assert.equal(await page.getByRole('tooltip').count(),0);
        await page.touchscreen.tap(clusterPoint.x,clusterPoint.y);
      }
      await page.waitForFunction(() => window.fixtureMap.getZoom() > 10
        && window.fixtureMap.queryRenderedFeatures({layers:['report-points']}).length === 3);
      assert.deepEqual(errors,[]);
      console.log(`${width}x${height}: pin previews, cluster hover, click/tap expansion and listener rebinding passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
