// Keeps public/maplibre-gl-*.mjs in sync with the installed maplibre-gl
// version. These files are served as the MapLibre worker (see PublicMap.tsx
// setWorkerUrl) and MUST match the bundled library, so run this after every
// `npm install` — wired up as the package.json postinstall hook.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'node_modules', 'maplibre-gl', 'dist');
const dest = join(root, 'public', 'vendor', 'maplibre-gl');

mkdirSync(dest, { recursive: true });

for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(dist, file), join(dest, file));
  console.log(`[sync-maplibre-worker] ${file} copied to public/vendor/maplibre-gl/`);
}
