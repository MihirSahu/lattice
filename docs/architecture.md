# Architecture

## Services

### `web`

Next.js App Router application.

- serves the browser UI
- proxies question, status, and sync actions through route handlers
- stays the only public origin behind Cloudflare Tunnel

### `qmd`

Internal HTTP service backed by `@tobilu/qmd`.

- opens the QMD SQLite store from the persistent volume
- answers retrieval queries from the local mirror collection
- stays on the internal Docker network only

### `sync-worker`

Internal orchestration API.

- runs `aws s3 sync`
- runs `qmd update`
- conditionally runs `qmd embed`
- persists status and per-run logs
- exposes `/run`, `/status`, and `/health`

### `scheduler`

Single-purpose container that sleeps for a configured interval and triggers the sync worker.

- keeps recurring behavior inside the container stack
- avoids host-level cron or timer dependence in production

### `cloudflared`

Optional sidecar for Cloudflare Tunnel.

- publishes the web service only
- relies on Cloudflare Access for user authentication

## Data Flow

```text
S3 -> sync-worker -> vault mirror -> qmd update/embed -> qmd service -> web app -> browser
```

## Persistence

- `vault/`: mirror of S3-backed Obsidian content
- `qmd/`: QMD SQLite database and related state
- `status/`: `status.json`
- `logs/`: sync and indexing run logs

## Security Model

- AWS credentials are read-only and prefix-scoped
- QMD is not exposed outside Docker
- sync-worker is not exposed outside Docker
- only the web app is published through Cloudflare Tunnel
- Cloudflare Access is mandatory before the UI is reachable

