// Real MapLibre rendering, numeric hover, frame replacement and basemap preservation.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const root = path.resolve(__dirname, '../..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__road-fixture/maplibre/*', route => {
      const file = path.basename(new URL(route.request().url()).pathname);
      return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'node_modules/maplibre-gl/dist', file)) });
    });
    await page.route('**/__road-fixture/page', route => route.fulfill({ contentType: 'text/html',
      body: '<html><body style="margin:0"><div id="map" style="position:relative;width:900px;height:700px"></div></body></html>' }));
    await page.goto(`${base}/__road-fixture/page`);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'node_modules/maplibre-gl/dist/maplibre-gl.css'), 'utf8') });
    await page.addScriptTag({ type: 'module', content: compile('lib/map/floodDepthHover.ts') + '\nwindow.depthAPI={attachFloodDepthHover,decodePngDepth,readRasterDepthBands,withNumericDepthPatches,registerRasterDepth};' });
    await page.addScriptTag({ type: 'module', content: compile('lib/map/roadGeocoding.ts') + '\nwindow.roadAPI={getLocalRoads,RoadIndex};' });
    const raster = compile('lib/map/liveRasterController.ts').replace(/import \{([^}]+)\} from ['"].*floodDepthHover['"];?/, 'const {$1}=window.depthAPI;');
    const focus = compile('lib/map/roadFloodFocus.ts')
      .replace(/import \{([^}]+)\} from ['"].*floodDepthHover['"];?/, 'const {$1}=window.depthAPI;')
      .replace(/import \{([^}]+)\} from ['"].*roadGeocoding['"];?/, 'const {$1}=window.roadAPI;');
    await page.addScriptTag({ type: 'module', content: raster + '\nwindow.RasterController=LiveRasterController;' });
    await page.addScriptTag({ type: 'module', content: focus + '\nwindow.attachFocus=attachRoadFloodFocus;' });
    await page.waitForFunction(() => window.attachFocus && window.RasterController);
    await page.evaluate(async base => {
      const gl = await import(`${base}/__road-fixture/maplibre/maplibre-gl.mjs`);
      const MapClass = gl.Map || gl.default.Map;
      const map = new MapClass({ container: 'map', center: [124.201, 8.201], zoom: 17,
        style: { version: 8, sources: {}, layers: [{ id: 'basemap', type: 'background', paint: { 'background-color': '#9bd4ea' } }] } });
      window.fixtureMap = map;
      await new Promise(resolve => map.once('load', resolve));
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
      const context = canvas.getContext('2d'); context.fillStyle = '#dc2626'; context.fillRect(0, 0, 2, 2);
      const coordinates = [[124.2,8.202],[124.202,8.202],[124.202,8.2],[124.2,8.2]];
      map.addSource('flood', { type: 'image', url: canvas.toDataURL(), coordinates });
      map.addLayer({ id: 'flood', type: 'raster', source: 'flood', paint: { 'raster-opacity': .85 } });
      window.fixtureValues = [.075,.8,0,2];
      const controller = new window.RasterController(async () => {
        const image = await createImageBitmap(canvas);
        window.depthAPI.registerRasterDepth(image, { width: 2, height: 2, values: new DataView(new Float32Array(window.fixtureValues).buffer) });
        return image;
      });
      window.fixtureRaster = controller;
      window.nextFrame = () => new Promise((resolve,reject) => controller.show(map,'flood','flood','fixture',coordinates,error => error ? reject(error) : resolve(),false,false,{time:'Day 1 · 15:00'}));
      await window.nextFrame();
      const index = new window.roadAPI.RoadIndex([
        { id:'named', n:'Test Street', c:'residential', p:[[124.2,8.2015],[124.202,8.2015]] },
        { id:'unnamed', n:null, c:'service', p:[[124.2,8.2005],[124.202,8.2005]] },
        { id:'outside', n:'Outside Road', c:'residential', p:[[124.2,8.2024],[124.202,8.2024]] },
      ]);
      window.detachFocus = window.attachFocus(map,controller,'flood',async () => index);
    }, base);
    await page.waitForFunction(() => window.fixtureMap.getLayer('flood-road-focus-depth') && window.fixtureMap.queryRenderedFeatures({layers:['flood-road-focus-depth']}).length > 0);
    const hover = async (position, expectedName, expectedValue) => {
      const p = await page.evaluate(position => window.fixtureMap.project(position), position);
      await page.mouse.move(p.x + .5, p.y);
      await page.waitForFunction(({expectedName,expectedValue}) => [...document.querySelectorAll('[role="tooltip"]')]
        .some(tip => tip.style.display !== 'none' && tip.textContent.includes(expectedName) && tip.textContent.includes(expectedValue)), {expectedName,expectedValue});
    };
    await hover([124.2005,8.2015], 'Test Street', '~8 cm');
    await hover([124.2015,8.2015], 'Test Street', '~80 cm');
    await hover([124.2015,8.2005], 'Unnamed road', '~200 cm');
    await hover([124.2005,8.2024], 'Outside Road', 'Depth unavailable');
    assert.equal(await page.evaluate(() => window.fixtureMap.getPaintProperty('flood','raster-opacity')), 0);
    assert.equal(await page.evaluate(() => window.fixtureMap.getStyle().layers.filter(layer => layer.type === 'background').length), 1);
    assert.equal(await page.evaluate(() => window.fixtureMap.getPaintProperty('basemap','background-color')), '#9bd4ea');
    await page.evaluate(async () => { window.fixtureValues=[.6,1.1,.1,.4]; await window.nextFrame(); });
    await page.waitForFunction(() => window.fixtureMap.queryRenderedFeatures(window.fixtureMap.project([124.2005,8.2015]), {layers:['flood-road-focus-depth']}).some(feature => feature.properties.band === 3));
    await hover([124.2005,8.2015], 'Test Street', '~60 cm');
    await page.screenshot({path: path.join(require('node:os').tmpdir(), 'gakit-road-focus.png')});
    await page.evaluate(() => window.detachFocus());
    assert.equal(await page.evaluate(() => window.fixtureMap.getPaintProperty('flood','raster-opacity')), .85);
    assert.equal(await page.locator('[role="tooltip"]').count(), 0);
    assert.equal(await page.evaluate(() => Boolean(window.fixtureMap.getSource('flood-road-focus'))), false);
    await page.evaluate(() => { window.fixtureRaster.dispose(); window.fixtureMap.remove(); });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({roads:'different depths along one named road',shallow:'~8 cm',unnamed:'~200 cm',outside:'unavailable',frameChange:'~60 cm',basemap:'unchanged',cleanup:'original flood display restored'}));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
