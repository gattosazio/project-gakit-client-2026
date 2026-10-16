"""Build the local road geometry snapshot. Python 3.10+, standard library only."""

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ROAD_CLASSES = {
    "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
    "secondary", "secondary_link", "tertiary", "tertiary_link", "residential",
    "living_street", "unclassified", "service", "road", "pedestrian",
}


def simplify(points, tolerance=1):
    """Douglas-Peucker in local metres; bound display/address geometry error to 1 m."""
    scale_x = 111320 * math.cos(math.radians(points[0][1]))
    metric = [(x * scale_x, y * 111320) for x, y in points]
    keep = {0, len(points) - 1}
    pending = [(0, len(points) - 1)]
    while pending:
        start, end = pending.pop()
        ax, ay = metric[start]
        dx, dy = metric[end][0] - ax, metric[end][1] - ay
        length = dx * dx + dy * dy
        maximum, furthest = tolerance * tolerance, None
        for i in range(start + 1, end):
            px, py = metric[i][0] - ax, metric[i][1] - ay
            t = max(0, min(1, (px * dx + py * dy) / length)) if length else 0
            distance = (px - t * dx) ** 2 + (py - t * dy) ** 2
            if distance > maximum:
                maximum, furthest = distance, i
        if furthest is not None:
            keep.add(furthest)
            pending.extend(((start, furthest), (furthest, end)))
    return [points[i] for i in sorted(keep)]


def coordinates(value):
    if isinstance(value[0], (int, float)):
        yield value
    else:
        for child in value:
            yield from coordinates(child)


def build(raw, source, bounds):
    roads = []
    if raw.get("remark"):
        raise ValueError(f"Incomplete Overpass response: {raw['remark']}")
    for feature in raw.get("elements", []) if source == "osm" else raw.get("features", []):
        if source == "osm":
            props = feature.get("tags", {})
            kind = props.get("highway")
            name = props.get("name") or props.get("name:en")
            points = [[p["lon"], p["lat"]] for p in feature.get("geometry", [])]
            identifier = f"way/{feature['id']}"
            parking = props.get("service") in ("parking_aisle", "driveway")
            if props.get("area") == "yes" or props.get("route") == "ferry":
                continue
        else:
            props = feature.get("properties", {})
            if props.get("subtype") != "road" or feature["geometry"]["type"] != "LineString":
                continue
            kind = props.get("class")
            name = (props.get("names") or {}).get("primary")
            points = feature["geometry"]["coordinates"]
            identifier = str(feature["id"])
            parking = props.get("subclass") in ("parking_aisle", "driveway")
        if kind not in ROAD_CLASSES or parking or len(points) < 2:
            continue
        # Retain unnamed roads so we do not assign a distant named street across a block.
        rounded = [[round(p[0], 6), round(p[1], 6)] for p in points]
        deduplicated = [p for i, p in enumerate(rounded) if i == 0 or p != rounded[i - 1]]
        if len(deduplicated) < 2:
            continue
        roads.append({"id": identifier, "n": name.strip() if name and name.strip() else None,
                      "c": kind, "p": simplify(deduplicated)})
    if not roads or not any(r["n"] for r in roads):
        raise ValueError("No usable named roads returned; refusing to replace the snapshot")
    roads.sort(key=lambda r: r["id"])
    return {
        "version": 1,
        "source": "OpenStreetMap" if source == "osm" else "Overture Maps transportation",
        "sourceUrl": "https://www.openstreetmap.org" if source == "osm" else "https://docs.overturemaps.org/guides/transportation/",
        "license": "ODbL-1.0", "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
        "attribution": "© OpenStreetMap contributors" if source == "osm" else "Overture Maps Foundation; © OpenStreetMap contributors",
        "downloadedAt": datetime.now(timezone.utc).isoformat(),
        "dataAsOf": raw.get("osm3s", {}).get("timestamp_osm_base"),
        "bounds": bounds, "simplificationToleranceM": 1, "roads": roads,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=("osm", "overture"), default="osm")
    parser.add_argument("--input", type=Path, help="Previously downloaded Overpass JSON or Overture GeoJSON")
    parser.add_argument("--output", type=Path, default=ROOT / "public/data/iligan-roads.json")
    parser.add_argument("--endpoint", default="https://overpass-api.de/api/interpreter")
    args = parser.parse_args()
    boundaries = json.loads((ROOT / "public/data/iligan-barangays.geojson").read_text(encoding="utf-8"))
    points = [p for f in boundaries["features"] for p in coordinates(f["geometry"]["coordinates"])]
    # Entire city, including upland barangays, with a small boundary margin.
    bounds = [round(math.floor(min(p[0] for p in points) * 1000) / 1000 - .001, 3),
              round(math.floor(min(p[1] for p in points) * 1000) / 1000 - .001, 3),
              round(math.ceil(max(p[0] for p in points) * 1000) / 1000 + .001, 3),
              round(math.ceil(max(p[1] for p in points) * 1000) / 1000 + .001, 3)]
    if args.input:
        raw = json.loads(args.input.read_text(encoding="utf-8"))
    elif args.source == "osm":
        west, south, east, north = bounds
        classes = "|".join(sorted(ROAD_CLASSES))
        query = f'[out:json][timeout:90];way["highway"~"^({classes})$"]({south},{west},{north},{east});out tags geom;'
        request = Request(args.endpoint, data=urlencode({"data": query}).encode(),
                          headers={"User-Agent": "GAKIT-road-snapshot/1.0"})
        with urlopen(request, timeout=120) as response:
            raw = json.load(response)
    else:
        parser.error("Overture requires --input from the official overturemaps download command")
    snapshot = build(raw, args.source, bounds)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Write only after the download and validation complete.
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(args.output)
    names = {r["n"] for r in snapshot["roads"] if r["n"]}
    print(f"{snapshot['source']}: {len(snapshot['roads'])} road lines, {len(names)} distinct names, {args.output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
