# GibleTracker

Map and list of nearby Pokémon, with level and area filters, powered by public data from [pokevagos.com](https://stats.pokevagos.com).

## Requirements

- Node.js 22+

## Running it

```bash
npm install
npm start
```

The server is available at [http://localhost:3000](http://localhost:3000).

## How it works

- **`src/index.ts`** — Node server that serves the static files, proxies requests to `stats.pokevagos.com` (to work around CORS) at `/api/proxy`, and caches Pokémon icons locally (`src/assets/pokemon/`) the first time they're requested.
- **`src/script.ts`** — browser logic (map with [Leaflet](https://leafletjs.com/), filters, results list). It's transpiled in memory by the server on every request to `/script.js`, with no build step.
- **`src/index.html`** / **`src/nocturne-styles.css`** — UI.

There is no build step: both the server and the browser script run directly from TypeScript (`tsx` and `esbuild`, respectively).

## Scripts

| Command               | Description                                      |
|------------------------|---------------------------------------------------|
| `npm start`             | Starts the server at `http://localhost:3000`      |
| `npm run typecheck`     | Type-checks the codebase (`tsc --noEmit`)          |
