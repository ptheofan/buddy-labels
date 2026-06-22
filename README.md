# Buddy Labels

React app for generating UV-printable Bambuddy spool labels for a 75 mm x 53.5 mm plastic insert.

SVG is the primary export format for EufyMake transfer. The exported SVG uses physical `mm` dimensions and a vector QR code, with no embedded raster image.

Static GitHub Pages documentation lives in `docs/`. The Pages workflow publishes the docs at the site root, the runnable SPA under `/app/`, and bundles `buddy-labels.3mf` as a downloadable model file.

Current application version: `1.0.0`.

When Bambuddy returns `created_at` for a spool, the label can include a `Registered` line formatted as `dd/mm/YYYY (dd MMM YYYY)`. Spools without that timestamp omit the row.

The `Color` line uses Bambuddy's first normalized RGB value as `#RRGGBB`.

Inventory search currently matches spool ID, material, subtype, brand, color name, RGB values, slicer filament code/name, storage, category, notes, data origin, tag type, tag UID, tray UID/UUID, and common serial-like fields (`serial`, `serial_number`, `sku`, `barcode`) when Bambuddy provides them. ID searches work with or without `#`; UID searches are tolerant of spaces, dots, underscores, colons, and hyphens.

## Setup

This project uses `pnpm`.

1. Copy `.env.example` to `.env`.
2. Set `BAMBUDDY_URL` to your Bambuddy base URL.
3. Set `BAMBUDDY_API_KEY` to a Bambuddy API key with inventory read access. Settings read access is recommended so QR links can use Bambuddy's configured external URL.
4. Run:

```sh
pnpm install
pnpm run dev
```

The app runs at `http://localhost:5173` and the proxy runs at `http://localhost:8787`.

Restart `pnpm run dev` after changing `.env`; the proxy loads `.env` when it starts.

## Browser-hosted mode

The GitHub Pages app can connect directly to Bambuddy from the browser. Click the Bambuddy connection button, enter the Bambuddy URL and API key, and optionally enable `Save in browser`.

Direct browser mode requires Bambuddy to allow CORS requests from the hosted app origin. Saving credentials stores the API key in localStorage; leave it unchecked to keep the token in memory only until refresh.

## Docker

Build the production image:

```sh
docker build -t buddy-labels .
```

Run it with your Bambuddy settings:

```sh
docker run --rm -p 8787:8787 --env-file .env buddy-labels
```

Open `http://localhost:8787`.

If Bambuddy is running on the host machine and this container needs to reach it, use `host.docker.internal` in `BAMBUDDY_URL`. If Bambuddy is another Docker container on the same network, use that container's service name.

A Docker Compose example and API key permission guide are published in `docs/setup.html`.

Published release images are pushed to GitHub Container Registry:

```sh
docker pull ghcr.io/ptheofan/buddy-labels:latest
docker pull ghcr.io/ptheofan/buddy-labels:1.0.0
```

## Releases

Release tags must match `package.json`.

1. Update `package.json` to the next version.
2. Commit the version change.
3. Create and push a matching tag, for example `v1.0.0`.
4. Publish the GitHub release.

The `Publish Container` workflow checks that the release tag matches `package.json`, then publishes GHCR tags for the full version, major/minor, major, and `latest`.

The browser checks GitHub Releases for newer versions when `APP_GITHUB_REPOSITORY` or `VITE_GITHUB_REPOSITORY` is set to `owner/repo`. The default repository is `ptheofan/buddy-labels`.

## QR links

QR codes resolve to:

```text
{external_url || BAMBUDDY_URL}/inventory?spool={spoolId}
```

Bambuddy handles that route by opening the spool edit modal.

## License

This project uses `AGPL-3.0-only`. Choose `AGPL-3.0-or-later` instead only if you want recipients to be able to use future FSF-published AGPL versions automatically.
