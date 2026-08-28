// Keeps public/vendor/maplibre-gl/*.mjs in sync with the installed maplibre-gl
// package. The map worker is served from /public and pointed at via
// maplibregl.setWorkerUrl() (see components/PublicMap.tsx); these files MUST
// match the bundled library version, so run this after every install.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'node_modules', 'maplibre-gl', 'dist');
const dest = join(root, 'public', 'vendor', 'maplibre-gl');

mkdirSync(dest, { recursive: true });

for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(dist, file), join(dest, file));
  console.log(`[sync-maplibre-worker] ${file} -> public/vendor/maplibre-gl/`);
}
