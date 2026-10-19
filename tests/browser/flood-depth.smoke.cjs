// Real browser decoding of the actual bundled raster and the demo's canvas composite.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '../..');
const bundle = JSON.parse(fs.readFileSync(path.join(root, 'public/data/scenarios/pagasa_orange.json'), 'utf8'));
const frame = bundle.frames.reduce((best, current) => current.inundated_km2 > best.inundated_km2 ? current : best);
const compile = relative => ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

(async () => {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="map" style="position:relative;width:600px;height:500px"><canvas width="600" height="500"></canvas></div>');
    await page.addScriptTag({ type: 'module', content: compile('lib/map/floodDepthHover.ts') + '\nwindow.depthAPI={decodePngDepth,readRasterDepthBands,withNumericDepthPatches,registerRasterDepth};' });
    await page.addScriptTag({ type: 'module', content: compile('lib/demo/analysis.ts') + '\nwindow.composeAPI={compositeDemoRasters};' });
    const controller = compile('lib/map/liveRasterController.ts').replace(/import \{([^}]+)\} from ['"].*floodDepthHover['"];?/, 'const {$1}=window.depthAPI;');
    await page.addScriptTag({ type: 'module', content: controller + '\nwindow.RasterController=LiveRasterController;' });
    await page.waitForFunction(() => Boolean(window.RasterController && window.composeAPI));
    const result = await page.evaluate(async ({ frame, bounds }) => {
      const { decodePngDepth } = window.depthAPI;
      const original = await decodePngDepth(await (await fetch(frame.raster_uri)).arrayBuffer());
      if (!original) throw new Error('Bundled raster still lacks numeric depths');
      const wet = [];
      for (let i = 0; i < original.width * original.height; i++) {
        if (original.values.getFloat32(i * 4, true) >= .2) wet.push(i);
      }
      const positions = [wet[Math.floor(wet.length / 3)], wet[Math.floor(wet.length * 2 / 3)]];
      const dx = (bounds[1][0] - bounds[0][0]) / original.width;
      const dy = (bounds[0][1] - bounds[2][1]) / original.height;
      const point = i => ({ longitude: bounds[0][0] + (i % original.width + .5) * dx,
        latitude: bounds[0][1] - (Math.floor(i / original.width) + .5) * dy });
      const inside = point(positions[0]), outside = point(positions[1]);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      context.fillStyle = 'rgba(234,179,8,0.804)'; context.fillRect(0,0,1,1);
      const pixels = new Uint8Array(4); new DataView(pixels.buffer).setFloat32(0,.225,true);
      const grid = { width: 1, height: 1, encoding: 'float32-le', values: btoa(String.fromCharCode(...pixels)) };
      const patch = { bounds: { left: inside.longitude-dx, right: inside.longitude+dx, top: inside.latitude+dy, bottom: inside.latitude-dy },
        baselineRaster: canvas.toDataURL(), correctedRaster: canvas.toDataURL(), baselineDepth: grid, correctedDepth: grid };
      const composite = await window.composeAPI.compositeDemoRasters(frame,bounds,[patch]);
      if (await decodePngDepth(await (await fetch(composite.corrected)).arrayBuffer())) throw new Error('Fixture must exercise metadata lost by canvas composition');
      const source = { updateImage() {} };
      const map = { getSource: () => source, getLayer: () => ({}), setLayoutProperty() {} };
      const raster = new window.RasterController();
      await new Promise((resolve,reject) => raster.show(map,'source','layer',composite.corrected,bounds,error => error ? reject(error) : resolve(),false,false,
        { depthUrl: frame.raster_uri, patches: [{ bounds: patch.bounds, grid, label: 'Report-analysis simulated depth' }] }));
      const corrected = raster.sampleDepth(inside.longitude,inside.latitude);
      const baseline = raster.sampleDepth(outside.longitude,outside.latitude);
      raster.dispose();
      return { corrected, baseline, expectedBaseline: `~${Math.round(original.values.getFloat32(positions[1]*4,true)*100+.0001)} cm` };
    }, { frame, bounds: bundle.bounds });
    assert.equal(result.corrected.value, '~23 cm');
    assert.equal(result.corrected.detail, 'Report-analysis simulated depth');
    assert.equal(result.baseline.value, result.expectedBaseline);
    assert.equal(result.baseline.detail, 'Simulated water depth');
    console.log(JSON.stringify({ bundledRaster: 'numeric depths present', composedDemo: 'numeric depth inside and outside correction patch passed', ...result }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
