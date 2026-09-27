# Lattice

Lattice is a self-hosted personal knowledge system. It mirrors an Obsidian vault from S3 and uses OpenCode to answer questions grounded in the mirrored files. Chat history is stored in SQLite.

## Architecture

```text
Obsidian / Remotely Save -> AWS S3 -> sync-worker -> vault mirror
                                                      |
                                                opencode-query
                                                      |
                                                 Next.js web
                                                      |
                                           Cloudflare Tunnel + Access
```

The scheduler triggers S3 sync at a fixed interval. OpenCode reads the mirror directly; no embedding model or search index is required. Only the web application publishes a host port. OpenCode query and sync-worker are internal services.

## Repository layout

- `apps/web/`: Next.js UI, authenticated API routes, SQLite chat persistence
- `services/opencode-query/`: grounded answers, folder listing
- `services/sync-worker/`: read-only S3 sync, run status and logs
- `services/scheduler/`: periodic sync trigger
- `packages/model-catalog/`: fixed model and provider constants
- `showcase-website/`: separate marketing website
- `infra/`: Docker Compose, AWS IAM, Cloudflare and systemd configuration

## Local setup

Use Node 24 and pnpm 12.6.0 (pinned by `.nvmrc` and `packageManager`). Local pnpm commands use the `sfw` wrapper. All projects share the root `pnpm-lock.yaml`.

```bash
sfw pnpm install --frozen-lockfile
sfw pnpm check
sfw pnpm build
```

For the full stack:

1. Copy `.env.example` to `.env`.
2. Configure the S3 bucket, prefix, region, and read-only AWS credentials.
3. Set `OPENROUTER_API_KEY` for API-backed answers.
4. Set `WEB_AUTH_MODE=dev` and `WEB_DEV_USER_EMAIL=you@example.com` for local use.
5. Run `make up` and open `http://localhost:3000` (or your configured `WEB_PORT`).

`LATTICE_DATA_ROOT` is resolved relative to `infra/docker/docker-compose.yml`. Its default `../../data/runtime` points to repository-local runtime storage.

For web-only iteration, keep backend containers running and override their URLs with reachable local endpoints if needed:

```bash
sfw pnpm --filter lattice-web dev
```

Backend containers expose ports only on the Docker network. Running only the web process on the host does not make those services reachable automatically.

## Model and authentication

All questions use **GPT-6 Luna (`openai/gpt-6-luna`) through OpenRouter**. Set `OPENROUTER_API_KEY`; there are no model or billing-route pickers. ChatGPT subscription authentication and `OPENCODE_MODEL` overrides are no longer supported.

Existing threads migrate to Luna/OpenRouter for future questions. Historical answers retain their original model and route metadata. Old OAuth files are no longer mounted or used by Lattice; existing files on disk are left untouched.

Luna uses Chat Completions with reasoning disabled so it can call OpenCode's file tools. Both the main and helper model are pinned to Luna in the worker configuration.

## Environment

| Variable | Purpose |
| --- | --- |
| `LATTICE_PUBLIC_URL` | External UI hostname |
| `LATTICE_DATA_ROOT` | Host root for persistent runtime directories |
| `CHAT_DB_PATH` | Chat SQLite database path inside the web container |
| `WEB_AUTH_MODE` | `dev`, `cloudflare`, or `auto` |
| `WEB_DEV_USER_EMAIL` | Development identity; optional fallback with `auto` |
| `OPENROUTER_API_KEY` | Required API key for GPT-6 Luna through OpenRouter |
| `OPENCODE_QUERY_TIMEOUT_MS` | Inactivity timeout; default 120000, `0` disables it |
| `OPENCODE_PROMPT_HEARTBEAT_MS` | Worker heartbeat interval; default 15000 |
| `OPENCODE_WORKER_SHUTDOWN_GRACE_MS` | Grace period before process-group force-kill; default 5000 |
| `SYNC_S3_BUCKET` / `SYNC_S3_PREFIX` | S3 vault source |
| `SYNC_AWS_REGION` | AWS region |
| `SYNC_DELETE` | Whether files removed from S3 are deleted from the local mirror |
| `SYNC_INTERVAL_SECONDS` | Scheduled sync interval; default 300 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Read-only, bucket/prefix-scoped credentials |
| `CLOUDFLARE_TUNNEL_TOKEN` | Optional Cloudflare Tunnel token |

Use `WEB_AUTH_MODE=cloudflare` behind Cloudflare Access. `auto` intentionally allows the configured development fallback when Access headers are absent. Keep backend services internal and restrict direct web-port access appropriately.

## Runtime data and sync

Persistent directories under `LATTICE_DATA_ROOT`:

- `vault/`: read-only S3 mirror source for answers
- `chat/`: SQLite chat history
- `status/`: sync status JSON
- `logs/`: per-run sync logs

The scheduler posts to sync-worker, which runs `scripts/sync-vault.sh`, records changed-file counts and completion status, and reports OpenCode health. Manual sync uses the same pipeline.

AWS permissions should permit only `s3:ListBucket` for the configured prefix and `s3:GetObject` for its objects. See `infra/aws/readonly-iam-policy.json`.

## Deployment and upgrades

See [deployment](docs/deployment.md) and [Cloudflare setup](infra/cloudflare/tunnel-notes.md). Docker builds use Node 24, frozen pnpm installs, and an exactly matched OpenCode CLI/SDK pair. Updating either OpenCode package requires updating the other and testing native server startup/shutdown.

Before upgrading, back up `chat/`, `status/`, and any irreplaceable vault content. Existing chats from the retired QMD engine keep their messages and migrate to OpenCode/OpenRouter for future questions. Old QMD index/cache directories are no longer mounted; their contents are not deleted automatically.

After upgrading from a version containing QMD, remove the orphaned service container using the deployment command:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build -d --remove-orphans
```

This does not delete old bind-mounted index/cache directories. Start with only the main Compose file to remove the old subscription authentication mount.

## Checks and troubleshooting

```bash
sfw pnpm check
sfw pnpm build
sfw pnpm audit
make lint-shell
docker compose --env-file .env.example -f infra/docker/docker-compose.yml config --quiet
```

CI runs type checks, unit/integration tests, production builds, and container builds. SQLite tests use disposable databases; OpenCode integration tests use isolated configuration and make no paid model calls. Actual provider answers still require a configured API key and a manual query checking streaming, citations, file tools, and cancellation.

Use `make logs`, `make ps`, and `scripts/healthcheck.sh` for diagnostics. For provider failures, verify `OPENROUTER_API_KEY`, OpenRouter credits, and GPT-6 Luna availability. For sync failures, inspect AWS permissions and sync-worker logs.
