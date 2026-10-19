// Generates the static basemap preview thumbnails shown in the map display
// popover, so the popover costs nothing at runtime (no extra map instances,
// styles, or tile requests on page load — the committed images are only
// fetched when the popover opens).
//
// Every preview renders the exact basemap the app uses (the OpenFreeMap
// Positron/Bright/Fiord style URLs and the Esri World Imagery tiles) through
// MapLibre in a throwaway page, cropped around Iligan center at the app's
// default zoom.
//
// Usage (MapLibre, sharp, and Playwright must be resolvable from this repo):
//   node scripts/generate-basemap-previews.cjs
//
// Optional env:
//   GAKIT_PLAYWRIGHT_MODULE  module name/path for Playwright's chromium
//                            (default playwright-core)

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright-core');
const sharp = require('sharp');

const maplibreDist = path.join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist');
const outDir = path.join(__dirname, '..', 'public', 'images', 'basemap-previews');

const WIDTH = 640;
const HEIGHT = 400;
const THUMB = { width: 256, height: 160 };
const CENTER = [124.253, 8.229]; // just east of ILIGAN_CENTER to balance the coastal strip
const ZOOM = 13; // PublicMap's initial zoom

const esriTiles =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const openfreemapStyles = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  dark: 'https://tiles.openfreemap.org/styles/fiord',
};

const pageHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="/maplibre/maplibre-gl.css" />
<style>html,body{margin:0;background:#fff}#map{width:${WIDTH}px;height:${HEIGHT}px}</style>
</head>
<body>
<div id="map"></div>
<script type="module">
import * as maplibregl from '/maplibre/maplibre-gl.mjs';

const satelliteStyle = {
  version: 8,
  sources: {
    'esri-imagery': { type: 'raster', tiles: ['${esriTiles}'], tileSize: 256 },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri-imagery' }],
};

const basemap = new URLSearchParams(location.search).get('basemap') || 'light';
const openfreemapStyles = ${JSON.stringify(openfreemapStyles)};
const map = new maplibregl.Map({
  container: 'map',
  style: basemap === 'satellite' ? satelliteStyle : openfreemapStyles[basemap] || openfreemapStyles.light,
  center: ${JSON.stringify(CENTER)},
  zoom: ${ZOOM},
  pitch: 0,
  bearing: 0,
  attributionControl: false,
  renderWorldCopies: false,
});
window.MAP_SETTLED = false;
map.on('idle', () => { window.MAP_SETTLED = true; });
</script>
</body>
</html>`;

const contentTypes = {
  '.mjs': 'text/javascript',
  '.css': 'text/css',
};

const serve = (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(pageHtml);
    return;
  }
  if (url.pathname.startsWith('/maplibre/')) {
    // Serve the package dist verbatim so MapLibre resolves its own worker
    // (./maplibre-gl-worker.mjs) and shared chunk relative to the entry.
    const file = path.join(maplibreDist, path.basename(url.pathname));
    if (fs.existsSync(file)) {
      res
        .writeHead(200, { 'content-type': contentTypes[path.extname(file)] || 'text/javascript' })
        .end(fs.readFileSync(file));
      return;
    }
  }
  res.writeHead(404).end('not found');
};

const capture = async (page, base, basemap) => {
  await page.goto(`${base}/?basemap=${basemap}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.MAP_SETTLED === true, undefined, { timeout: 60000 });
  await page.waitForTimeout(750); // final paint after the last tile lands
  const shot = await page.locator('#map').screenshot({ type: 'png' });
  return sharp(shot).resize(THUMB.width, THUMB.height).webp({ quality: 82 }).toBuffer();
};

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = http.createServer(serve);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    headless: true,
  });
  try {
    // 2x device scale then downscale: supersampled labels stay crisp at the
    // card's rendered size.
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
    });
    const captured = [];
    for (const basemap of Object.keys(openfreemapStyles).concat(['satellite'])) {
      const shot = await capture(page, base, basemap);
      await fs.promises.writeFile(path.join(outDir, `${basemap}.webp`), shot);
      captured.push(basemap);
    }
    console.log(`Wrote ${captured.map((name) => `${name}.webp`).join(', ')} to ${outDir}`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
