// Actual Canvas alpha checks plus real basemap-water masking (no weather requests).
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');

const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const land = moduleUrl(compile('lib/map/heatLandMask.ts'));
const api = moduleUrl(compile('lib/backend/apiCache.ts'));
const raster = moduleUrl(compile('lib/map/heatIndex.ts')
  .replace(/from ['"]@\/lib\/map\/heatLandMask['"]/, `from '${land}'`)
  .replace(/from ['"]@\/lib\/backend\/apiCache['"]/, `from '${api}'`));

(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const context = await browser.newContext({ bypassCSP: true, viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const unit = await page.evaluate(async ({ raster, land }) => {
      const { renderHeatIndexImage } = await import(raster);
      const { prepareMaskPolygons, mercatorY } = await import(land);
      const mask = prepareMaskPolygons({ type: 'Polygon', coordinates: [
        [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]],
        [[3, 3], [4, 3], [4, 4], [3, 4], [3, 3]],
      ] });
      const water = prepareMaskPolygons({ type: 'Polygon', coordinates: [[[5, 5], [7, 5], [7, 7], [5, 7], [5, 5]]] });
      const grid = { bounds: { west: 0, east: 10, south: 0, north: 10 }, rows: 25, cols: 10, values: Array(250).fill(35) };
      const output = renderHeatIndexImage(grid, mask, [...water, ...water], { bounds: grid.bounds, width: 400, height: 400 });
      const image = new Image(); image.src = output.url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 400;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const alpha = (lon, lat) => ctx.getImageData(Math.floor(lon * 40), Math.floor((mercatorY(10) - mercatorY(lat)) / mercatorY(10) * 400), 1, 1).data[3];
      return {
        ocean: alpha(1, 5), land: alpha(4.5, 4.5), hole: alpha(3.5, 3.5), lake: alpha(6, 6),
        outside: renderHeatIndexImage(grid, mask, [], { bounds: { west: 20, east: 30, south: 0, north: 10 }, width: 100, height: 100 }),
      };
    }, { raster, land });
    assert.deepEqual(unit, { ocean: 0, land: 255, hole: 0, lake: 0, outside: null });

    await page.route('**/api/v1/heat-index/grid?*', (route) => route.fulfill({ json: {
      source: 'fixture', unit: '°C', validAt: new Date().toISOString(), fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), stale: false,
      bounds: { west: 116.5, east: 127, south: 4.5, north: 21.5 }, rows: 25, cols: 10,
      latitude: Array(25).fill(0), longitude: Array(10).fill(0), values: Array(250).fill(35), sampleCount: 250, refreshHours: 3,
    }, headers: { 'access-control-allow-origin': '*' } }));
    await page.goto(process.env.GAKIT_BASE_URL || 'http://localhost:3000');
    await page.getByRole('button', { name: 'Expand Layers', exact: true }).click();
    await page.getByRole('switch', { name: 'Heat index', exact: true }).click();
    await page.getByText(/^Valid .* PHT$/).waitFor();
    // Find the existing map ref in React's test-only component tree. Nothing is
    // exposed on the production window or added to the app for this assertion.
    const attach = async () => page.evaluate(() => {
      const element = document.querySelector('.maplibregl-map');
      let fiber = element[Object.keys(element).find((key) => key.startsWith('__reactFiber$'))];
      while (fiber) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const map = hook.memoizedState?.current;
          if (map?.getSource && map?.getStyle) { window.__testHeatMap = map; return true; }
        }
        fiber = fiber.return;
      }
      return false;
    });
    assert(await attach());
    const sample = async () => page.evaluate(async () => {
      const map = window.__testHeatMap;
      const source = map.getSource('heat-index');
      if (!source) return null;
      const { url, coordinates } = source.serialize();
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const my = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
      const alpha = (lon, lat) => {
        const x = Math.floor((lon - coordinates[0][0]) / (coordinates[1][0] - coordinates[0][0]) * canvas.width);
        const y = Math.floor((my(coordinates[0][1]) - my(lat)) / (my(coordinates[0][1]) - my(coordinates[2][1])) * canvas.height);
        return ctx.getImageData(x, y, 1, 1).data[3];
      };
      return { sea: alpha(124.18, 8.25), land: alpha(124.265, 8.24), width: image.width,
        resampling: map.getPaintProperty('heat-index-layer', 'raster-resampling'),
        waterFeatures: map.getSource('heat-index-water') ? map.querySourceFeatures('heat-index-water', { sourceLayer: 'water' }).length : null };
    });
    await page.waitForTimeout(1800);
    const light = await sample();
    assert.equal(light.sea, 0); assert.equal(light.land, 255); assert.equal(light.resampling, 'linear');
    await page.getByRole('button', { name: 'Map display settings', exact: true }).click();
    await page.getByRole('button', { name: 'Satellite', exact: true }).click();
    await page.getByRole('button', { name: 'Close display settings', exact: true }).click();
    await page.waitForTimeout(2500);
    const satellite = await sample();
    assert.equal(satellite.sea, 0); assert.equal(satellite.land, 255); assert(satellite.waterFeatures > 0);
    await page.evaluate(() => window.__testHeatMap.jumpTo({ center: [124.27, 7.96], zoom: 11 }));
    await page.waitForTimeout(2200);
    const lake = await page.evaluate(async () => {
      const map = window.__testHeatMap;
      const source = map.getSource('heat-index').serialize();
      const image = new Image(); image.src = source.url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const my = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
      const [west, north] = source.coordinates[0], [east, south] = source.coordinates[2];
      return ctx.getImageData(Math.floor((124.27-west)/(east-west)*canvas.width), Math.floor((my(north)-my(7.96))/(my(north)-my(south))*canvas.height), 1, 1).data[3];
    });
    assert.equal(lake, 0, 'Lake Lanao must stay transparent on the satellite basemap');
    console.log(JSON.stringify({ unit, light, satellite, lakeLanaoAlpha: lake }));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack); process.exit(1); });
