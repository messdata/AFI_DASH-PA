# Deploying

The Age Friendly Ireland Dashboard is a Next.js 15 application that reads CSV and GeoJSON assets from `public/data`, renders
maps with MapLibre/Mapbox tiles, and serves API routes from the App Router. The project can run on any platform that supports
Node.js 18 or later, but Vercel is the recommended host because it provides first-class support for the Next.js features the
dashboard relies on (streaming routes, edge caching, and automatic static optimization).

| Deployment Option                | Feature Support   |
| -------------------------------- | ----------------- |
| [Node.js server](#nodejs-server) | All               |
| [Docker container](#docker)      | All               |
| [Static export](#static-export)  | Limited           |
| [Adapters](#adapters)            | Platform-specific |

## Vercel (recommended workflow)

### 1. Prerequisites

- A Vercel account with access to the `messdata/AFI_DASH-PA` GitHub repository.
- A Mapbox access token with Static Tiles scopes so `components/MapboxLA.tsx` can load basemaps. Store it as
  `NEXT_PUBLIC_MAPBOX_TOKEN`.
- Optional: a custom domain (e.g., `dashboard.agefriendlyireland.ie`) and DNS access if you plan to map it to Vercel.

### 2. Connect the GitHub project

1. Push your changes to the branch you want to deploy (`main` is recommended for production; the existing `work` branch can be
   used for previews until `main` is created).
2. In Vercel, click **Add New… → Project**, choose **Import Git Repository**, and select `messdata/AFI_DASH-PA`.
3. Set **Framework Preset** to **Next.js** (auto-detected) and leave the **Root Directory** empty so Vercel uses the project
   root.
4. Confirm the default install command (`npm install`) and build command (`npm run build`). No custom output directory is
   required because the Next.js adapter handles `.vercel/output` automatically.

### 3. Environment variables

Create the following variables in the **Environment Variables** section before your first deployment:

| Name                     | Environment      | Description                                                                 |
| ------------------------ | ---------------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Production & Preview | Required for MapLibre/Mapbox tiles. Use the same value locally in `.env.local`. |

Pull the variables to your workstation with `vercel env pull` to keep local development in sync. The repository includes
`.env.example` as a template.

### 4. Build and runtime settings

- **Node.js version**: 18.x or 20.x (set under Project Settings → General if your team defaults differ).
- **Ignored Build Step**: Optional safeguard to skip builds when only documentation changes are pushed; for example,
  `git diff --quiet HEAD^ HEAD -- . ':!docs/**'`.
- **Serverless/Edge functions**: No manual configuration required. App Router API routes are generated automatically.
- **Static assets**: `public/data/**` is uploaded as-is. The existing `vercel.json` adds 24-hour immutable caching headers for
  `/data/*` responses and standard security headers for all other routes.

### 5. Branches, previews, and production

- Set **Production Branch** to the branch that should trigger production deployments (`main` once it exists).
- Every pull request gets a preview URL. Supply a preview Mapbox token if you do not want to reuse the production one.
- Use Vercel’s **Deploy Hooks** if you need to trigger builds from external automation (for example, after a data refresh in
  the `public/data` directory).

### 6. Post-deployment verification

After each deployment:

1. Visit the production URL and ensure the map renders (confirms the Mapbox token works).
2. Check that CSV-driven dashboards load (verifies `public/data` assets were uploaded and cached correctly).
3. Validate the `/api/mcda/allocate` route via the dashboard’s MCDA tab to ensure serverless functions are live.
4. Review the **Analytics** → **Logs** panel for runtime errors caused by malformed or missing data files.

### 7. Deploying from the CLI (optional)

Install the Vercel CLI (`npm i -g vercel`), authenticate with `vercel login`, and run `vercel --prod` from the repository root.
The CLI respects `.vercelignore`, which mirrors `.gitignore` to avoid uploading Firebase `functions/` packages and other local
artifacts.

---

## Node.js server

Next.js can be deployed to any provider that supports Node.js. Ensure your `package.json` has the `"build"` and `"start"`
scripts:

```json filename="package.json"
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

Then, run `npm run build` to build your application and `npm run start` to start the Node.js server. This server supports all
Next.js features. If needed, you can also eject to a [custom server](/docs/app/guides/custom-server.md).

Node.js deployments support all Next.js features. Learn how to [configure them](/docs/app/guides/self-hosting.md) for your
infrastructure.

### Templates

* [Flightcontrol](https://github.com/nextjs/deploy-flightcontrol)
* [Railway](https://github.com/nextjs/deploy-railway)
* [Replit](https://github.com/nextjs/deploy-replit)

## Docker

Next.js can be deployed to any provider that supports [Docker](https://www.docker.com/) containers. This includes container
orchestrators like Kubernetes or a cloud provider that runs Docker.

Docker deployments support all Next.js features. Learn how to
[configure them](/docs/app/guides/self-hosting.md) for your infrastructure.

> **Note for development:** While Docker is excellent for production deployments, consider using local development (`npm run
dev`) instead of Docker during development on Mac and Windows for better performance.
[Learn more about optimizing local development](/docs/app/guides/local-development.md).

### Templates

* [Docker](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
* [Docker Multi-Environment](https://github.com/vercel/next.js/tree/canary/examples/with-docker-multi-env)
* [DigitalOcean](https://github.com/nextjs/deploy-digitalocean)
* [Fly.io](https://github.com/nextjs/deploy-fly)
* [Google Cloud Run](https://github.com/nextjs/deploy-google-cloud-run)
* [Render](https://github.com/nextjs/deploy-render)
* [SST](https://github.com/nextjs/deploy-sst)

## Static export

Next.js enables starting as a static site or [Single-Page Application (SPA)](/docs/app/guides/single-page-applications.md), then
later optionally upgrading to use features that require a server.

Since Next.js supports [static exports](/docs/app/guides/static-exports.md), it can be deployed and hosted on any web server that
can serve HTML/CSS/JS static assets. This includes tools like AWS S3, Nginx, or Apache.

Running as a [static export](/docs/app/guides/static-exports.md) **does not** support Next.js features that require a server.
[Learn more](/docs/app/guides/static-exports.md#unsupported-features).

### Templates

* [GitHub Pages](https://github.com/nextjs/deploy-github-pages)

## Adapters

Next.js can be adapted to run on different platforms to support their infrastructure capabilities.

Refer to each provider's documentation for information on supported Next.js features:

* [AWS Amplify Hosting](https://docs.amplify.aws/nextjs/start/quickstart/nextjs-app-router-client-components)
* [Cloudflare](https://developers.cloudflare.com/workers/frameworks/framework-guides/nextjs)
* [Deno Deploy](https://docs.deno.com/examples/next_tutorial)
* [Netlify](https://docs.netlify.com/frameworks/next-js/overview/#next-js-support-on-netlify)
* [Vercel](https://vercel.com/docs/frameworks/nextjs)

> **Note:** We are working on a [Deployment Adapters API](https://github.com/vercel/next.js/discussions/77740) for all platforms
to adopt. After completion, we will add documentation on how to write your own adapters.
