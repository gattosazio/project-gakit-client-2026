import { readFileSync, writeFileSync } from 'node:fs';
import union from '@turf/union';
import simplify from '@turf/simplify';
import buffer from '@turf/buffer';
import truncate from '@turf/truncate';

const source = readFileSync('public/data/iligan-barangays.geojson', 'utf8');
const fc = JSON.parse(source);

// Align shared edges to 6 decimals so adjacent rings snap before dissolving.
const snapped = truncate(fc, { precision: 6 });

// Close the tiny sliver gaps between adjacent barangay polygons: expand every
// polygon by ~110 m so gaps overlap, dissolve, then shrink back to the true
// land bounds (~110 m outward stays well inside the coast cuts; the unbuffer
// restores the coastline).
const grown = buffer(snapped, 0.001);
const fused = union(grown);
const clean = buffer(fused, -0.001);

const outline = simplify(clean, { tolerance: 0.0001, highQuality: true });

// Remaining interior rings are sub-square-kilometer slivers between adjacent
// barangay polygons (official shared borders never tile perfectly). Treat them
// as part of the city: a geofence should accept points in those coverage gaps.
const outerOnly =
  outline.geometry.type === 'MultiPolygon'
    ? { type: outline.geometry.type, coordinates: outline.geometry.coordinates }
    : { type: 'Polygon', coordinates: [outline.geometry.coordinates[0]] };

const result = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Iligan City', source: 'iligan-barangays.geojson (dissolved)' },
      geometry: outerOnly,
    },
  ],
};

writeFileSync('public/data/iligan-city-outline.geojson', JSON.stringify(result));

const coords = outline.geometry.coordinates;
console.log(
  JSON.stringify({
    geometryType: outerOnly.type,
    rings: coords.length,
    outerPoints: coords[0].length,
    bytes: Buffer.byteLength(JSON.stringify(result)),
  })
);