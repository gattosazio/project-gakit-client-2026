# Local street and location lookup

Reverse geocoding uses **OpenStreetMap road lines**, the existing Iligan barangay
boundary polygons, and conservative Overture landmark fallbacks. Browser GPS
still supplies the coordinates; this dataset supplies a readable location label.

## Source selection

The October 17, 2026 comparison downloaded both OSM ways through Overpass and
Overture transportation segments for the same bounding region:
`124.164,8.127,124.569,8.334`. This includes all barangays, including the uplands.

After excluding parking aisles, driveways, water routes, and unsupported road
classes, the snapshots contained:

| Source | Road lines | Distinct named roads |
| --- | ---: | ---: |
| OpenStreetMap | 3,417 | 220 |
| Overture transportation | 5,648 | 216 |

Line counts are not a quality ranking: Overture splits roads into more segments.
OSM was selected for its fresher snapshot (base timestamp
`2026-10-16T16:14:04Z`), slightly broader name coverage in this extract, and
direct road classifications. Both sources gave similar road distances at the
sampled Robinsons, Gaisano, Palao, Hinaplanon, and upland coordinates. This does
not establish complete coverage or positional accuracy throughout the city.

The previous places file stores representative points, including ferry routes
classified as streets. Those street records no longer supply reverse lookup or
street search results. The file remains in use for explicit place searches,
barangay searches, and filtered landmark context.

## Runtime rules

- `public/data/iligan-roads.json` is fetched once per page, with concurrent fetch
  deduplication. A failed download can be retried and does not poison the cache.
- A spatial grid selects nearby lines. Distance is measured to the closest
  point on each segment, including endpoints, in local metres.
- Named roads must be within 60 m. A label more than 25 m away says **Near**.
- A much closer unnamed road blocks a misleading named-road match across a
  block. Similarly distant named streets beyond 25 m fall back to landmarks or
  barangay instead of choosing arbitrarily.
- Barangays come from the containing boundary, never the nearest centroid.
- Street searches return a point on the road inside Iligan, not an arbitrary
  place centroid. Old ferry and street place points are excluded.
- No house numbers are inferred. Report coordinates are never moved or snapped.
- If road data is unavailable, major-landmark and barangay fallbacks still work.
  Existing stored report addresses are not rewritten.

The snapshot is approximately 1.06 MB of JSON (281 KB when gzip-compressed).
Geometry is simplified with a 1 m tolerance and rounded to six decimal places.
No extra browser or server package is required.

## Refresh

From the client repository, using Python 3.10+ (standard library only):

```powershell
python scripts/build-iligan-roads.py
```

This derives the full bounding region from the checked-in barangay boundaries,
downloads roads through Overpass, validates a nonempty named-road result, and
atomically replaces the local snapshot. Review the result before committing it.
This is a maintenance command, not a request made by each user or deployment.

To rebuild from a saved Overpass JSON response:

```powershell
python scripts/build-iligan-roads.py --input path/to/overpass-roads.json
```

To repeat the alternative-source comparison, install the official `overturemaps`
Python CLI in a tooling environment, download road segments, and generate a
separate snapshot:

```powershell
overturemaps download --bbox=124.164,8.127,124.569,8.334 -f geojson --type=segment -o overture-roads.geojson
python scripts/build-iligan-roads.py --source overture --input overture-roads.geojson --output overture-comparison.json
```

## Attribution

Road data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
licensed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
The downloadable derived snapshot retains attribution, source timestamp,
licence, bounding region, and OSM way IDs. Attribution and a dataset download
link are exposed in Data & Privacy; street search also credits OSM.

- [Overpass query language](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL)
- [Overture transportation guide](https://docs.overturemaps.org/guides/transportation/)
- [Overture attribution](https://docs.overturemaps.org/attribution/)
