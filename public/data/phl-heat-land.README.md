# Philippine heat-overlay land mask

`phl-heat-land.geojson` derives from OCHA Philippines / NAMRIA, distributed by
[geoBoundaries](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM0/),
boundary ID `PHL-ADM0-24100683` (2020), under
[CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/).
The original attribution and license apply to this derived dataset.

GAKIT clipped the geometry to the forecast bounds, simplified it with a
0.0005-degree tolerance while preserving topology, and rounded coordinates to
six decimal places. The source URL, SHA-256 and modifications are embedded in
the GeoJSON properties. Run `python scripts/build-heat-land-mask.py` from the
client repository to reproduce it; this requires Shapely and downloads the
pinned source revision `9469f09`.

The mask is for a regional weather display, not legal boundary determination.
The browser supplements it with the existing OpenFreeMap/OpenStreetMap water
polygons to exclude lakes and refine coastal edges. On satellite basemaps, it
loads those vector water tiles from the same provider used by the light map.
Provider attribution remains in the map attribution control.

Hazard assessment also reuses this coastline mask for map clicks. A separate
invisible water layer stays active across basemap changes to exclude lakes and
rivers independently of whether the heat overlay is enabled.
