# Age Friendly Ireland Dashboard

The Age Friendly Ireland Dashboard visualises 65+/85+ population projections, old-age dependency ratios, housing supply/demand
gaps, and other indicators across the Irish NUTS-3 regions. It is built with Next.js 15 (App Router), React 19, and TypeScript,
combining charting components (ApexCharts, Chart.js, Recharts) with MapLibre-powered geospatial visualisations. CSV and GeoJSON
files sourced from the CSO, Census 2022, and allied datasets live in `public/data` and are loaded client-side, so keeping those
files up to date is critical for accurate outputs.

## Project structure

```
app/                # Next.js app router pages (e.g., /mcda)
components/         # Reusable charts, filters, and mapping widgets
public/data/        # CSV/GeoJSON assets used in charts and choropleths
lib/                # Data wrangling helpers (e.g., CSV loaders)
api/                # API routes (App Router) for PXStat integrations
functions/          # Firebase Cloud Functions (not used in the Vercel build)
```

## Getting started locally

1. Install Node.js 18+ (Next.js 15 also supports Node 20 if you prefer).
2. Duplicate `.env.example` to `.env.local` and paste a Mapbox token into `NEXT_PUBLIC_MAPBOX_TOKEN`.
3. Install dependencies with `npm install`.
4. Launch the development server with `npm run dev` and open [http://localhost:3000](http://localhost:3000).

### Available scripts

- `npm run dev` – Run the development server (Turbopack).
- `npm run build` – Compile an optimized production build (used by Vercel).
- `npm run start` – Serve the production build locally.
- `npm run lint` – Run ESLint using the shared Next.js configuration.

## Data management

- CSV/GeoJSON sources are read at runtime from `public/data`. Update files in-place and commit them so deployments stay in sync.
- Guard against malformed rows (missing numeric values, string numbers) – components such as `DemandTrends.tsx` and
  `MapLibreLA.tsx` contain type-safe parsing to handle typical issues.
- If new datasets require transformations, add helpers in `lib/` so the main components remain focused on presentation logic.

## Deployment

Vercel is the recommended host for this project. Deployment steps in brief:

1. Import the GitHub repository (`messdata/AFI_DASH-PA`) into Vercel and accept the Next.js defaults for install/build commands.
2. Add the `NEXT_PUBLIC_MAPBOX_TOKEN` environment variable in both **Production** and **Preview** environments before deploying.
3. Keep `public/data/**` under version control – the `vercel.json` file applies immutable caching headers to those assets once
   deployed.
4. Promote the branch you want to treat as production (e.g., `main`) under **Project Settings → Git** and use Preview URLs for QA.

For an extended checklist (including CLI usage, custom domains, and fall-back deployment options), read
[`docs/DEPLOYING.md`](docs/DEPLOYING.md).

## Troubleshooting

- **Maps fail to render** – Confirm `NEXT_PUBLIC_MAPBOX_TOKEN` is set locally and in Vercel. Without it MapLibre falls back to a
  blank basemap.
- **CSV updates not visible** – Ensure the file is saved under `public/data`, committed, and that your browser cache is cleared;
  production responses are cached for 24 hours.
- **Deployment skipped** – Vercel honours `.vercelignore`, which mirrors `.gitignore` to keep Firebase `functions/` packages out
  of the upload bundle. Remove directories from `.vercelignore` only if they are needed by the Next.js build.

## Contributing workflow

Maintain concise commit messages describing errors fixed or features shipped so we can trace progress quickly. When tackling
bugs, trace from the relevant page orchestrator (e.g., `app/mcda/page.tsx`) into the responsible component, respect existing
types, and keep fixes minimal yet type-safe. Guard against messy data (string numbers, missing years) and preserve the dark-mode
styling when touching UI components.
