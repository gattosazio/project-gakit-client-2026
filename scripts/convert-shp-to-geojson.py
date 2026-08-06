"""
Convert a flood shapefile to GeoJSON files for MapLibre:
    1. flood-zones-part-###.json   — chunked polygon features for fill layer
    2. flood-zones-manifest.json   — chunk list for the app loader
    3. flood-heatmap-points.json   — centroid points weighted by area for heatmap layer

Usage:
    python scripts/convert-shp-to-geojson.py [path/to/shapefile.shp]

Defaults to data/LanaoDelNorte_Flood_100year.shp
Output goes to public/data/
"""

import json
import math
import sys
from pathlib import Path

import shapefile

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEFAULT_SHP = Path(__file__).resolve().parent.parent / "data" / "LanaoDelNorte_Flood_100year.shp"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "data"
MAX_ZONE_CHUNK_BYTES = 95 * 1024 * 1024
ZONE_CHUNK_PREFIX = "flood-zones-part-"
ZONE_MANIFEST_NAME = "flood-zones-manifest.json"
LEGACY_ZONE_PATH = OUTPUT_DIR / "flood-zones.json"

# Mapping of the Var field to human-readable risk labels
RISK_LABELS = {
    1: "high",
    2: "medium",
    3: "low",
}

RISK_WEIGHTS = {
    "high": 2.5,
    "medium": 1.5,
    "low": 1.0,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def to_geojson_coords(flat_points, part_indices):
    """Convert pyshp flat points + part indices to GeoJSON coordinate rings."""
    rings = []
    bounds = list(part_indices) + [len(flat_points)]
    for i in range(len(bounds) - 1):
        ring = [list(pt[:2]) for pt in flat_points[bounds[i]:bounds[i + 1]]]
        if ring:
            rings.append(ring)
    return rings


def ring_area(coords):
    """Shoelace formula for polygon area (approx, in degree²)."""
    n = len(coords)
    a = 0.0
    for i in range(n):
        j = (i + 1) % n
        a += coords[i][0] * coords[j][1]
        a -= coords[j][0] * coords[i][1]
    return abs(a) / 2.0


def centroid(coords):
    """Simple centroid for a ring."""
    n = len(coords)
    cx = sum(c[0] for c in coords) / n
    cy = sum(c[1] for c in coords) / n
    return [cx, cy]


def polygon_centroid(multi_polygon):
    """Area-weighted centroid for a (possibly multi-ring) polygon."""
    total_area = 0.0
    weighted_x = 0.0
    weighted_y = 0.0

    for ring in multi_polygon:
        a = ring_area(ring)
        cx, cy = centroid(ring)
        total_area += a
        weighted_x += a * cx
        weighted_y += a * cy

    if total_area == 0:
        return centroid(multi_polygon[0])

    return [weighted_x / total_area, weighted_y / total_area]


def feature_json_size(feature):
    """Serialized UTF-8 byte size for a single GeoJSON feature."""
    return len(json.dumps(feature, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def write_json(path, payload):
    """Write compact JSON so chunk sizes stay predictable."""
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    shp_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SHP
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    sf = shapefile.Reader(str(shp_path))
    print(f"Read {shp_path.name}: {len(sf)} features, type={sf.shapeTypeName}")

    if sf.shapeTypeName not in ("POLYGON", "POLYLINE"):
        print(f"Warning: shape type is {sf.shapeTypeName}, expected POLYGON")

    field_names = [f[0] for f in sf.fields[1:]]  # skip DeletionFlag

    # ---- 1. Polygon GeoJSON (for fill layer) ----
    zone_features = []
    heatmap_features = []

    for sr in sf.iterShapeRecords():
        rec = sr.record
        shp = sr.shape

        props = {}
        for fn in field_names:
            val = rec[fn]
            # Convert non-serializable types
            if isinstance(val, float) and math.isnan(val):
                val = None
            props[fn] = val

        # Derived properties
        raw_var = rec["Var"] if "Var" in field_names else None
        risk = RISK_LABELS.get(raw_var, "unknown") if raw_var is not None else "unknown"
        props["risk_level"] = risk
        props["risk_weight"] = RISK_WEIGHTS.get(risk, 1.0)
        props["label"] = f"{risk.capitalize()} Risk Flood Zone"

        # GeoJSON uses [lng, lat]; pyshp stores [x, y] = [lng, lat] for geographic CRS
        # Check .prj to confirm — but for Philippines data this is standard EPSG:4326
        multi_ring = to_geojson_coords(shp.points, shp.parts.tolist())

        if not multi_ring:
            continue

        # Polygon feature
        if len(multi_ring) == 1:
            geometry = {"type": "Polygon", "coordinates": [multi_ring[0]]}
        else:
            geometry = {"type": "MultiPolygon", "coordinates": [[r] for r in multi_ring]}

        zone_features.append({
            "type": "Feature",
            "properties": props,
            "geometry": geometry,
        })

        # Centroid feature (for heatmap)
        cx, cy = polygon_centroid(multi_ring)
        area = sum(ring_area(r) for r in multi_ring)
        heatmap_features.append({
            "type": "Feature",
            "properties": {
                **props,
                "intensity": RISK_WEIGHTS.get(risk, 1.0),
                "area_deg2": round(area, 6),
            },
            "geometry": {"type": "Point", "coordinates": [cx, cy]},
        })

    # ---- Write chunked polygon outputs ----
    LEGACY_ZONE_PATH.unlink(missing_ok=True)

    zone_chunk_paths = []
    zone_chunk_sizes = []
    zone_chunk_counts = []
    current_chunk = []
    current_chunk_bytes = len('{"type":"FeatureCollection","features":[]}')

    def flush_zone_chunk():
        if not current_chunk:
            return

        chunk_index = len(zone_chunk_paths) + 1
        chunk_name = f"{ZONE_CHUNK_PREFIX}{chunk_index:03d}.json"
        chunk_path = OUTPUT_DIR / chunk_name
        chunk_payload = {"type": "FeatureCollection", "features": list(current_chunk)}
        chunk_size = write_json(chunk_path, chunk_payload)

        zone_chunk_paths.append(chunk_name)
        zone_chunk_sizes.append(chunk_size)
        zone_chunk_counts.append(len(current_chunk))
        current_chunk.clear()

    for feature in zone_features:
        feature_size = feature_json_size(feature)
        extra_bytes = feature_size + (1 if current_chunk else 0)

        if current_chunk and current_chunk_bytes + extra_bytes > MAX_ZONE_CHUNK_BYTES:
            flush_zone_chunk()
            current_chunk_bytes = len('{"type":"FeatureCollection","features":[]}')
            extra_bytes = feature_size

        current_chunk.append(feature)
        current_chunk_bytes += extra_bytes

    flush_zone_chunk()

    manifest_path = OUTPUT_DIR / ZONE_MANIFEST_NAME
    manifest_payload = {
        "type": "FeatureCollectionManifest",
        "source": "flood-zones",
        "chunkSizeLimitBytes": MAX_ZONE_CHUNK_BYTES,
        "featureCount": len(zone_features),
        "chunkCount": len(zone_chunk_paths),
        "chunks": [
            {
                "file": name,
                "features": count,
                "bytes": size,
            }
            for name, count, size in zip(zone_chunk_paths, zone_chunk_counts, zone_chunk_sizes)
        ],
    }

    write_json(manifest_path, manifest_payload)
    print(f"  Wrote {manifest_path} ({len(zone_chunk_paths)} chunks)")

    heatmap_path = OUTPUT_DIR / "flood-heatmap-points.json"

    write_json(heatmap_path, {"type": "FeatureCollection", "features": heatmap_features})
    print(f"  Wrote {heatmap_path} ({len(heatmap_features)} points)")

    print("Done.")


if __name__ == "__main__":
    main()
