import { VectorTile, classifyRings, type VectorTileFeature } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { topology } from 'topojson-server';
import { fromVectorTileJs, type VectorTileLike } from '@maplibre/vt-pbf';
import type { FeatureCollection, MultiPolygon } from 'geojson';

type Point = number[];

/** Round shared arcs once. Junctions and a tile-edge guard band remain fixed. */
export function roundHazardArc(arc: Point[], extent: number): Point[] {
  if (arc.length < 3) return arc;
  const result: Point[] = [arc[0]];
  const guard = extent / 64;
  // MVT tiles render at 512 CSS pixels. The previous extent / 512 cap
  // moved a right-angle boundary by less than half a pixel, effectively
  // disappearing after integer encoding and map rendering.
  const limit = extent / 64;
  for (let i = 1; i < arc.length - 1; i++) {
    const previous = arc[i - 1], point = arc[i], next = arc[i + 1];
    if (point[0] < guard || point[1] < guard || point[0] > extent - guard || point[1] > extent - guard) {
      result.push(point);
      continue;
    }
    const incoming = Math.hypot(previous[0] - point[0], previous[1] - point[1]);
    const outgoing = Math.hypot(next[0] - point[0], next[1] - point[1]);
    if (!incoming || !outgoing) { result.push(point); continue; }
    const distance = Math.min(limit, incoming * 0.4, outgoing * 0.4);
    const before = [point[0] + (previous[0] - point[0]) * distance / incoming, point[1] + (previous[1] - point[1]) * distance / incoming];
    const after = [point[0] + (next[0] - point[0]) * distance / outgoing, point[1] + (next[1] - point[1]) * distance / outgoing];
    result.push(before, [(before[0] + 2 * point[0] + after[0]) / 4, (before[1] + 2 * point[1] + after[1]) / 4], after);
  }
  result.push(arc[arc.length - 1]);
  return result;
}

/** Display-only MVT transformation; feature IDs, categories, and ring winding survive. */
export function smoothHazardTile(data: Uint8Array): Uint8Array {
  if (!data.length) return data;
  const tile = new VectorTile(new PbfReader(data));
  const layers: VectorTileLike['layers'] = {};
  for (const [name, layer] of Object.entries(tile.layers)) {
    const records = Array.from({ length: layer.length }, (_, index) => layer.feature(index));
    const features: FeatureCollection<MultiPolygon> = { type: 'FeatureCollection', features: [] };
    records.forEach((record, index) => {
      if (record.type !== 3) return;
      features.features.push({ type: 'Feature', id: index, properties: record.properties,
        geometry: { type: 'MultiPolygon', coordinates: classifyRings(record.loadGeometry()).map(polygon => polygon.map(ring => ring.map(p => [p.x, p.y]))) } });
    });
    if (!features.features.length) { layers[name] = layer; continue; }
    const shared = topology({ hazards: features });
    const arcs = shared.arcs.map(arc => roundHazardArc(arc, layer.extent));
    const replacements = new Map<number, ReturnType<VectorTileFeature['loadGeometry']>>();
    const join = (indexes: number[]) => {
      const points: Point[] = [];
      for (const index of indexes) {
        const arc = index < 0 ? [...arcs[~index]].reverse() : arcs[index];
        for (let i = points.length ? 1 : 0; i < arc.length; i++) points.push(arc[i]);
      }
      const rounded = points.map(p => ({ x: Math.round(p[0]), y: Math.round(p[1]) }));
      return rounded.filter((p, index) => !index || p.x !== rounded[index - 1].x || p.y !== rounded[index - 1].y);
    };
    const collection = shared.objects.hazards;
    if (collection.type !== 'GeometryCollection') continue;
    for (const geometry of collection.geometries) {
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue;
      const polygons = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs;
      replacements.set(Number(geometry.id), polygons.flatMap(polygon => polygon.map(join)) as ReturnType<VectorTileFeature['loadGeometry']>);
    }
    layers[name] = { name, version: layer.version, extent: layer.extent, length: records.length,
      feature(index) {
        const record = records[index];
        return { id: record.id, type: record.type, properties: record.properties, extent: record.extent,
          loadGeometry: () => replacements.get(index) ?? record.loadGeometry() };
      } };
  }
  return fromVectorTileJs({ layers });
}
