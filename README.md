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
- `services/opencode-query/`: grounded answers, model catalog API, folder listing
- `services/sync-worker/`: read-only S3 sync, run status and logs
- `services/scheduler/`: periodic sync trigger
- `packages/model-catalog/`: shared model definitions and route defaults
- `showcase-website/`: separate marketing website
- `infra/`: Docker Compose, AWS IAM, Cloudflare and systemd configuration

## Local setup

Use Node 24 and pnpm 11.1.2 (pinned by `.nvmrc` and `packageManager`). Local pnpm commands use the `sfw` wrapper. All projects share the root `pnpm-lock.yaml`.

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

## Models and authentication

New chats default to GPT-5.5 through **OpenRouter API billing**. The existing catalog also includes Claude Sonnet 4.6, Claude Opus 4.6, and Gemini 2.5 Pro. `OPENCODE_MODEL` controls the backend default model; model definitions live in `packages/model-catalog/catalog.json`.

The OpenAI route toggle supports OpenRouter and ChatGPT subscription OAuth. There is no direct OpenAI API-key integration. Existing explicit subscription choices and legacy OpenAI chat choices remain preserved.

### Optional subscription access

API-only setup does not require an OAuth file. To also use subscription authentication:

1. Copy the OpenCode `auth.json` from a machine where you are already logged in to repository-root `opencode-auth.json`.
2. Set `OPENCODE_OPENAI_AUTH_HOST_FILE=../../opencode-auth.json` in `.env`.
3. Start the optional mount overlay:

```bash
make up SUBSCRIPTION=1
# Equivalent:
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.subscription.yml up --build -d
```

Use `SUBSCRIPTION=1` for subsequent `make up` calls while retaining subscription access. The overlay bind-mounts the file at `/app/opencode-data/opencode/auth.json` and disables automatic host-path creation. OpenCode token refreshes persist to that file. Never commit or log it; Git and Docker build contexts exclude it.

## Environment

| Variable | Purpose |
| --- | --- |
| `LATTICE_PUBLIC_URL` | External UI hostname |
| `LATTICE_DATA_ROOT` | Host root for persistent runtime directories |
| `CHAT_DB_PATH` | Chat SQLite database path inside the web container |
| `WEB_AUTH_MODE` | `dev`, `cloudflare`, or `auto` |
| `WEB_DEV_USER_EMAIL` | Development identity; optional fallback with `auto` |
| `OPENROUTER_API_KEY` | API key for all OpenRouter-backed models |
| `OPENCODE_MODEL` | Default model ID; invalid/unset values fall back to GPT-5.5 |
| `OPENCODE_OPENAI_AUTH_HOST_FILE` | OAuth file used only by the subscription Compose overlay |
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

Include the subscription overlay when needed. This does not delete old bind-mounted index/cache directories.

## Checks and troubleshooting

```bash
sfw pnpm check
sfw pnpm build
sfw pnpm audit
make lint-shell
docker compose --env-file .env.example -f infra/docker/docker-compose.yml config --quiet
```

CI runs type checks, unit/integration tests, production builds, and container builds. SQLite tests use disposable databases; OpenCode integration tests use isolated configuration and make no paid model calls. Actual provider answers still require a configured API key and a manual query checking streaming, citations, file tools, and cancellation.

Use `make logs`, `make ps`, and `scripts/healthcheck.sh` for diagnostics. For provider failures, verify `OPENROUTER_API_KEY`, selected model availability, or the optional subscription mount. For sync failures, inspect AWS permissions and sync-worker logs.
