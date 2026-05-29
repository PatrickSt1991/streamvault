# StreamVault

IPTV streaming app for Samsung Tizen smart TVs and mobile PWA. Built with React, TypeScript, and Vite, with a Node.js backend server.

## Features

- **Live TV, Movies, Series** - Browse and play via Xtream Codes API or M3U playlists
- **Movie detail pages** - View poster, plot, rating, cast before playing
- **Series detail** - Season/episode browser with per-episode watch progress
- **Mobile PWA** - Installable progressive web app with touch-optimized UI
- **Mobile player** - Swipe-to-scrub, double-tap skip, auto Picture-in-Picture when leaving app
- **Live TV list view** - Clean, text-only list for live channels (no images, full titles visible)
- **Favorites** - Favorite any content; create custom named lists to organize items
- **Watch progress** - Continue Watching and Resume support across all content types
- **D-pad/remote navigation** - Full Tizen TV remote control support
- **EPG** - On-demand Electronic Program Guide per stream
- **Search** - Server-side search across all content types
- **Recordings** - Schedule, play back, and manage recorded streams
- **Hardened local API** - Optional token auth, masked credentials, SSRF-safe stream proxying, and health checks

## Tech Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 8, Zustand 5
- **Backend**: Node.js, Express, better-sqlite3
- **Testing**: Vitest
- **Deployment**: Docker, Tizen TV CLI

## Architecture

```
src/
  components/   # Player, ChannelList, ChannelCard, MovieDetail, SeriesDetail, Sidebar, etc.
  stores/       # Zustand stores (channelStore, favoritesStore, playerStore, appStore)
  hooks/        # useFocusNavigation, useRemoteKeys, usePlayer, useNetworkStatus
  services/     # EPG service, channel service, AVPlay wrapper
  pages/        # Home, Settings
  types.ts      # Core type definitions
server/
  src/          # Express API, SQLite DB, Xtream client, sync engine
scripts/        # Tizen signing, packaging, and deployment
```

## Development

```bash
npm install
npm run dev       # Start frontend dev server
npm run build     # TypeScript check + Vite build
npm run lint      # ESLint
npm run typecheck # TypeScript only
npm run test      # Run tests

cd server
npm run dev       # Start backend dev server (tsx watch)
npm run typecheck # TypeScript check for backend
npm run audit:prod # Production dependency audit
```

## Optional API hardening

Set `STREAMVAULT_AUTH_TOKEN` to protect config, sync/crawl, recordings, and recording-rule APIs. Browser clients include the token by storing it in localStorage:

```js
localStorage.setItem('streamvault_auth_token', 'your-token')
```

The stream proxy validates URLs and blocks localhost/private/link-local targets. `/api/proxy` is limited to the configured Xtream server host plus optional `STREAMVAULT_PROXY_ALLOWED_HOSTS` entries.

Useful server environment variables:

- `STREAMVAULT_AUTH_TOKEN` - optional bearer/header token for protected APIs
- `STREAMVAULT_PROXY_ALLOWED_HOSTS` - comma-separated extra proxy host allowlist
- `STREAMVAULT_ALLOWED_ORIGINS` - comma-separated explicit CORS origins

## Tizen signing

`npm run sign` signs `dist/` with OpenSSL rather than bundling vulnerable JS certificate parsers. Provide certificate paths via `CERT_AUTHOR_P12` and `CERT_DIST_P12`, or place them at `certs/author.p12` and `certs/distributor.p12`. `CERT_AUTHOR_PASSWORD` and `CERT_DIST_PASSWORD` are required.

## Deployment

```bash
# Docker (serves both API + PWA on port 3002)
docker compose up -d --build

# Tizen TV
./scripts/deploy-tv.sh
```
