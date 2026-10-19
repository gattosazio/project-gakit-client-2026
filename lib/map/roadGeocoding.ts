export interface RoadRecord {
  id: string;
  n: string | null;
  c: string;
  p: [number, number][];
}

export interface RoadSnapshot {
  version: 1;
  source: string;
  roads: RoadRecord[];
}

const CELL_SIZE = 0.005;
const MATCH_RADIUS_M = 60;

/** Distance to a road line, rather than to its representative/centre point. */
export function distanceToRoad(lat: number, lng: number, points: RoadRecord['p']): number {
  const scaleX = 111320 * Math.cos(lat * Math.PI / 180);
  let minimum = Infinity;
  for (let i = 1; i < points.length; i++) {
    const ax = (points[i - 1][0] - lng) * scaleX;
    const ay = (points[i - 1][1] - lat) * 111320;
    const bx = (points[i][0] - lng) * scaleX;
    const by = (points[i][1] - lat) * 111320;
    const dx = bx - ax, dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    minimum = Math.min(minimum, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return minimum;
}

/** Small spatial grid keeps repeated GPS/map lookups local to nearby roads. */
export class RoadIndex {
  private cells = new Map<string, RoadRecord[]>();

  constructor(readonly roads: RoadRecord[]) {
    for (const road of roads) {
      let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
      for (const [lng, lat] of road.p) {
        west = Math.min(west, lng); east = Math.max(east, lng);
        south = Math.min(south, lat); north = Math.max(north, lat);
      }
      for (let x = Math.floor(west / CELL_SIZE); x <= Math.floor(east / CELL_SIZE); x++) {
        for (let y = Math.floor(south / CELL_SIZE); y <= Math.floor(north / CELL_SIZE); y++) {
          const key = `${x},${y}`;
          const cell = this.cells.get(key);
          if (cell) cell.push(road); else this.cells.set(key, [road]);
        }
      }
    }
  }

  inBounds(west: number, south: number, east: number, north: number): RoadRecord[] {
    // Clip wide/invalid views to the local dataset; a world view must not iterate millions of cells.
    const candidates = new Set<RoadRecord>();
    for (const [key, roads] of this.cells) {
      const [x, y] = key.split(',').map(Number);
      if ((x + 1) * CELL_SIZE < west || x * CELL_SIZE > east || (y + 1) * CELL_SIZE < south || y * CELL_SIZE > north) continue;
      for (const road of roads) candidates.add(road);
    }
    return [...candidates];
  }

  nearby(lat: number, lng: number): { name: string; distanceM: number } | null {
    const candidates = new Set<RoadRecord>();
    const x = Math.floor(lng / CELL_SIZE), y = Math.floor(lat / CELL_SIZE);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const road of this.cells.get(`${x + dx},${y + dy}`) ?? []) candidates.add(road);
    }
    const names = new Map<string, number>();
    let unnamedDistance = Infinity;
    for (const road of candidates) {
      const distance = distanceToRoad(lat, lng, road.p);
      if (distance > MATCH_RADIUS_M) continue;
      if (road.n) names.set(road.n, Math.min(names.get(road.n) ?? Infinity, distance));
      else unnamedDistance = Math.min(unnamedDistance, distance);
    }
    const ordered = [...names].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    const nearest = ordered[0];
    if (!nearest) return null;
    // Avoid naming a different road across the block or choosing arbitrarily
    // between equally distant parallel streets. Coordinates remain untouched.
    if (nearest[1] > 30 && unnamedDistance + 20 < nearest[1]) return null;
    if (nearest[1] > 25 && ordered[1] && ordered[1][1] - nearest[1] < 8) return null;
    return { name: nearest[0], distanceM: nearest[1] };
  }
}

let cachedIndex: RoadIndex | null = null;
let loading: Promise<RoadIndex | null> | null = null;

/** Snapshot is fetched once per page; failed downloads can be retried later. */
export function getLocalRoads(): Promise<RoadIndex | null> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (loading) return loading;
  loading = fetch('/data/iligan-roads.json')
    .then(async response => {
      if (!response.ok) throw new Error('Road snapshot unavailable');
      const snapshot = await response.json() as RoadSnapshot;
      if (snapshot.version !== 1 || !Array.isArray(snapshot.roads) || !snapshot.roads.length) throw new Error('Invalid road snapshot');
      cachedIndex = new RoadIndex(snapshot.roads);
      return cachedIndex;
    })
    .catch(error => { console.warn('Local road lookup unavailable:', error); return null; })
    .finally(() => { loading = null; });
  return loading;
}
