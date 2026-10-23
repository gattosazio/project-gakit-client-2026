"""Build the bundled coastline mask. Requires Shapely (backend dependency)."""

import hashlib
import json
import urllib.request
from pathlib import Path

from shapely.geometry import box, mapping, shape

SOURCE = "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/PHL/ADM0/geoBoundaries-PHL-ADM0.geojson"
root = Path(__file__).resolve().parents[1]
raw = urllib.request.urlopen(SOURCE, timeout=60).read()
country = shape(json.loads(raw)["features"][0]["geometry"])
# Approx. 55 m simplification; topology keeps small offshore islands intact.
land = country.simplify(0.0005, preserve_topology=True).intersection(box(116.5, 4.5, 127, 21.5))


def rounded(value):
    if isinstance(value, (list, tuple)):
        return [rounded(item) for item in value]
    return round(value, 6) if isinstance(value, float) else value


feature = {
    "type": "Feature",
    "properties": {
        "name": "Philippine coastal mask",
        "source": "OCHA Philippines / NAMRIA via geoBoundaries",
        "source_url": SOURCE,
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "license": "CC BY 3.0 IGO",
        "changes": "Clipped to forecast coverage, simplified 0.0005 degrees, rounded to 6 decimals",
    },
    "geometry": mapping(land),
}
feature["geometry"]["coordinates"] = rounded(feature["geometry"]["coordinates"])
target = root / "public/data/phl-heat-land.geojson"
target.write_text(json.dumps(feature, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
