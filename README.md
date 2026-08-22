# Project GAKIT Client

Public-facing flood hazard reporting client for Project GAKIT. Built with Next.js, React, Tailwind CSS, and MapLibre GL.

## Requirements

- Node.js 18 or newer
- npm

## Setup

Install dependencies:

```powershell
npm install
```

## Run Locally

Start the development server:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build

Create a production build:

```powershell
npm run build
```

Start the production server after building:

```powershell
npm run start
```

## Useful Scripts

```powershell
npm run dev
npm run build
npm run start
npm run lint
npm test
```

## Regenerating flood-zones.pmtiles

The flood hazard overlay (`public/data/flood-zones.pmtiles`) is a PMTiles
archive built from the Project NOAH shapefiles. The source shapefiles are
distributed via this Google Drive folder (Provided by NOAH):

https://drive.google.com/drive/folders/1K2z1FYNCGPzhcGIgT1Y2nKKLUojxxIa3?usp=drive_link

To rebuild the archive after the source data changes, convert each shapefile to
GeoJSON, merge into a single FeatureCollection with a `risk_level` property per
feature (`high` / `medium` / `low` matching the 100/25/5-year layers), then run
tippecanoe:

```powershell
tippecanoe -o public/data/flood-zones.pmtiles `
  --layer=flood-zones `
  --minimum-zoom=4 --maximum-zoom=10 `
  --drop-densest-as-needed `
  flood-zones.geojson
```

The map's vector source uses layer name `flood-zones` and expects a
`risk_level` property on every feature (see `lib/map/overlayLayers.ts`).

## Project Structure

```text
app/                     Next.js App Router pages and server actions
  api/                   Route handlers (elevation proxy, Himawari image proxy)
  public-view/           Public hazard-map page (components in public-view/components/)
  monitoring/            Staff portal (features/reports, features/alerts, …)
  admin/                 Admin portal
  login/                 Sign-in page
components/              Shared cross-portal UI (headers, modals, map, ui/)
constants/               Shared constants and camera/basemap configuration
hooks/                   Reusable React hooks (map layers, polling, sorting)
lib/                     Domain logic, grouped by domain
  backend/               Backend access helpers (cache, errors, warm-up status)
  map/                   Map domain (color scales, markers, overlay layers)
  notifications/         Notification mappers and read receipts
  reports/               Report formatting helpers
  weather/  auth/  supabase/
types/                   Shared TypeScript types
scripts/                 Maintenance scripts (MapLibre worker sync)
tests/                   Vitest unit tests
public/                  Static assets served from site root
  data/                  flood-zones.pmtiles archive
  vendor/maplibre-gl/    MapLibre worker bundle (synced via postinstall)
```

Tests run with:

```powershell
npm test
```

## Static Assets

Files in `public/` are served from the site root.

Example:

```text
public/images/flooded-image1.jpg
```

is available in the app as:

```text
/images/flooded-image1.jpg
```

## Troubleshooting

If Next.js serves `/_next/static/...` chunks with `500` errors, stop the dev server, delete the generated `.next` folder, then restart:

```powershell
Remove-Item -LiteralPath .next -Recurse -Force
npm run dev
```

If browser geolocation does not work, check that location permission is allowed in the browser. Some browsers require HTTPS for geolocation outside localhost.
