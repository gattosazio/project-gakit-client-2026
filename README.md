# Project GAKIT Client

Public-facing flood hazard reporting client for Project GAKIT. Built with Next.js, React, Tailwind CSS, Leaflet, and React Leaflet.

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
```

## Project Structure

```text
app/                  Next.js app routes and public view UI
components/           Shared UI components, including map and header
lib/                  Shared helpers
public/               Static assets served from site root
public/images/        Public images, including home background assets
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
