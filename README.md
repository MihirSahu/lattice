# Lattice

Lattice is a self-hosted personal knowledge system for mirroring an Obsidian vault from S3 onto a Raspberry Pi, indexing it with QMD, and exposing a secure web UI for grounded retrieval.

The repository is the single source of truth for application code, container orchestration, sync scripts, deployment notes, and operational runbooks.

## What It Does

- Pulls a read-only mirror of an Obsidian vault from S3 into a dedicated local directory on the Pi
- Runs `qmd update` after sync and optionally `qmd embed` based on change strategy
- Persists vault, QMD index, and status data across restarts
- Exposes a simple web UI for questions, sources, health, and manual sync
- Supports both QMD retrieval and an OpenCode-backed grounded query path over the mirrored vault
- Publishes only the web app through Cloudflare Tunnel and protects it with Cloudflare Access
- Keeps QMD, OpenCode query, and the sync worker on the internal Docker network only

## Architecture Overview

```text
Obsidian / Remotely Save
  -> AWS S3 bucket + prefix
  -> sync-worker container
  -> local vault mirror volume
  -> QMD index volume
  -> qmd service container
  -> opencode-query service container
  -> Next.js web app
  -> Cloudflare Tunnel + Access
  -> phone / laptop browser
```

Recurring sync is handled inside the container stack. A lightweight scheduler container calls the sync worker at a fixed interval. Host-level systemd is used only to keep Docker Compose up across Raspberry Pi reboots.

## Repository Layout

```text
lattice/
  apps/web/                 Next.js App Router UI and route handlers
  services/qmd/             Internal QMD-backed retrieval service
  services/opencode-query/  Internal OpenCode-backed grounded query service
  services/sync-worker/     Sync + index orchestration API
  services/scheduler/       Interval trigger container
  infra/docker/             Docker Compose stack
  infra/aws/                Read-only IAM policy
  infra/cloudflare/         Tunnel and Access notes
  infra/systemd/            Bootstrapping unit for Docker Compose
  scripts/                  Shell scripts for sync, update, embed, health
  docs/                     Product, architecture, and deployment docs
  data/                     Local development bind mount root placeholder
```

## Prerequisites

- Raspberry Pi with a recent 64-bit Linux distribution
- Docker Engine with Compose plugin
- AWS account with an S3 bucket already fed by Remotely Save
- Cloudflare account with Zero Trust enabled
- A domain managed in Cloudflare
- Enough local disk for:
  - full vault mirror
  - QMD index database and model artifacts
  - sync logs and status metadata

## Local Development Setup

1. Copy `.env.example` to `.env`.
2. Set S3 bucket, prefix, region, and read-only credentials.
3. Set `LATTICE_DATA_ROOT` to an absolute path or leave the local default `../../data/runtime`.
   The value is consumed by Compose from `infra/docker/docker-compose.yml`, so relative paths are resolved from `infra/docker/`.
4. Start the stack:

```bash
make up
```

5. Open `http://localhost:${WEB_PORT}` if you are running locally without Cloudflare.

For app-only iteration:

```bash
cd apps/web
npm install
npm run dev
```

Node-based backend services now compile TypeScript source from `src/` into `dist/` before runtime. For local backend iteration, build the service first and then run its compiled entrypoint via the service-local `start` script.

## Production Deployment

1. Install Docker and Compose on the Raspberry Pi.
2. Clone this repository to a stable path such as `/opt/lattice`.
3. Create `.env` from `.env.example`.
4. Create the runtime directories:

```bash
mkdir -p /srv/lattice/{vault,qmd,status,logs,chat}
```

5. Point `LATTICE_DATA_ROOT=/srv/lattice`.
6. Start the stack:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build -d
```

7. Install the systemd unit in [`infra/systemd/lattice-compose.service`](infra/systemd/lattice-compose.service) so the stack comes back after reboot.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `LATTICE_PUBLIC_URL` | External URL used by the UI and Cloudflare |
| `LATTICE_DATA_ROOT` | Host directory for persistent bind mounts |
| `CHAT_DB_PATH` | Local SQLite path used for persisted chat history |
| `WEB_AUTH_MODE` | Web auth mode: `dev` is the default local setup, `cloudflare` requires the Cloudflare Access email header, and `auto` is an optional hybrid mode that prefers the Cloudflare header and otherwise uses `WEB_DEV_USER_EMAIL` when configured |
| `WEB_DEV_USER_EMAIL` | Development identity used when `WEB_AUTH_MODE=dev`, and as the fallback identity in `WEB_AUTH_MODE=auto` when Cloudflare headers are absent |
| `OPENROUTER_API_KEY` | OpenRouter API key used by the OpenCode query service for non-OpenAI models |
| `OPENCODE_OPENAI_AUTH_FILE` | Optional path to an OpenCode `auth.json` file, or a file containing just the `.openai` OAuth auth object, used for `openai/*` models |
| `OPENCODE_OPENAI_AUTH_JSON` | Optional OpenAI OAuth auth object JSON used for `openai/*` models when no auth file is available |
| `SYNC_S3_BUCKET` | S3 bucket containing the mirrored vault |
| `SYNC_S3_PREFIX` | Bucket prefix used for the Obsidian vault |
| `SYNC_AWS_REGION` | AWS region for the S3 bucket |
| `SYNC_DELETE` | Whether local mirror deletes files removed from S3 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Read-only AWS credentials for the Pi |
| `QMD_COLLECTION` | Single collection name used in v1 |
| `OPENCODE_MODEL` | Default OpenCode model identifier. Supported values: `anthropic/claude-sonnet-4.6`, `anthropic/claude-opus-4.6`, `openai/gpt-5.5`, or `google/gemini-2.5-pro`. Falls back to GPT-5.5 if unset or invalid. |
| `OPENCODE_QUERY_TIMEOUT_MS` | OpenCode inactivity timeout in milliseconds. Resets whenever the worker emits progress. Set to `0` to disable. Defaults to `120000`. |
| `OPENCODE_PROMPT_HEARTBEAT_MS` | Heartbeat interval in milliseconds while an OpenCode prompt is still running. Defaults to `15000`. |
| `QMD_EMBED_STRATEGY` | `on-change`, `always`, `never`, or `manual` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token for the optional `cloudflared` service |

## AWS Credentials and IAM

Use a dedicated IAM principal with read-only permissions scoped to the exact bucket and prefix. The starter policy lives at [`infra/aws/readonly-iam-policy.json`](infra/aws/readonly-iam-policy.json).

Recommended permissions:

- `s3:ListBucket` on the bucket with a prefix condition
- `s3:GetObject` on the relevant object ARN prefix

Do not grant write or delete permissions from the Raspberry Pi side.

## Cloudflare Tunnel and Access

Only the web service should be exposed. QMD and the sync worker remain internal-only.

1. Create a Cloudflare Tunnel for the app hostname.
2. Point the public hostname at `http://web:${WEB_INTERNAL_PORT}` inside the stack.
3. Add a Cloudflare Access policy requiring your identity provider before the web app is reachable.
4. Put the generated tunnel token into `CLOUDFLARE_TUNNEL_TOKEN`.

For local development without Cloudflare, use `WEB_AUTH_MODE=dev` and set `WEB_DEV_USER_EMAIL=you@example.com`. For production behind Cloudflare Access, set `WEB_AUTH_MODE=cloudflare` so requests must include the Cloudflare Access email header. Use `WEB_AUTH_MODE=auto` only if you intentionally want one config that accepts Cloudflare-authenticated traffic and also falls back to `WEB_DEV_USER_EMAIL` in non-Cloudflare environments.

More detail is in [`infra/cloudflare/tunnel-notes.md`](infra/cloudflare/tunnel-notes.md).

## Container Startup and Runtime Data

Persistent directories expected under `LATTICE_DATA_ROOT`:

- `vault/` for the local mirror
- `qmd/` for the QMD SQLite store and model cache
- `chat/` for the web app SQLite chat history
- `status/` for `status.json`
- `logs/` for per-run sync and indexing logs

These directories must not be committed. They are bind-mounted into the containers.

## Sync and Indexing Workflow

1. `scheduler` posts to `sync-worker` every 5 minutes by default.
2. `sync-worker` runs [`scripts/sync-vault.sh`](scripts/sync-vault.sh).
3. On successful sync, it runs [`scripts/run-qmd-update.sh`](scripts/run-qmd-update.sh).
4. It optionally runs [`scripts/run-qmd-embed.sh`](scripts/run-qmd-embed.sh) based on `QMD_EMBED_STRATEGY`.
5. It writes human-readable and machine-readable status for the UI.
6. The web UI can also trigger the same `/run` pipeline manually.

## Logs, Health Checks, and Status

- `docker compose logs -f` for service logs
- [`scripts/healthcheck.sh`](scripts/healthcheck.sh) for lightweight HTTP health probes
- `status.json` under the status volume for last sync and indexing state

The web UI surfaces:

- last sync time
- last successful sync time
- last index update time
- current run state
- embeddings state
- QMD, OpenCode, and sync worker health

## Troubleshooting

Common failure modes:

- AWS auth errors: verify credentials, region, bucket, and prefix
- Empty results after sync: confirm the vault actually landed in the mirror path
- QMD failures: check whether the collection exists and whether the database path is writable
- Cloudflare 502/Access errors: verify the tunnel token and origin service hostname
- Manual sync stuck in running state: inspect sync-worker logs for a failed child process or lock cleanup issue

Useful commands:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
docker compose --env-file .env -f infra/docker/docker-compose.yml logs -f sync-worker
curl -fsS http://localhost:4000/status | jq
```

## Maintenance and Upgrade Notes

- Rebuild after code changes with `make up`
- Back up the `vault/`, `qmd/`, `chat/`, and `status/` directories before major upgrades
- If QMD schema changes, stop the stack, snapshot the `qmd/` directory, then rebuild
- Rotate the AWS key and Cloudflare tunnel token periodically

## Current v1 Decisions

- AWS CLI is the default sync implementation
- One QMD collection for the vault
- Retrieval-first answering, with synthesized-answer support left as a future layer
- Containerized scheduling outside the Next.js process
- Systemd only for machine bootstrapping, not recurring jobs
