# Architecture

`sync-worker` copies the configured S3 prefix into a local vault mirror using the AWS CLI. `scheduler` triggers that operation periodically. The worker persists sync status and logs; no indexing or embedding step runs.

`opencode-query` exposes internal `/query`, `/models`, `/sources`, and `/health` endpoints. It lists visible vault folders and runs an isolated OpenCode worker for each question. The worker restricts file access to the selected vault scope and streams progress plus a grounded answer. Timeout and shutdown handling terminate the worker and its native OpenCode process group.

`web` provides the Next.js UI, identity checks, stream proxy, and SQLite chat persistence. It uses the shared `@lattice/model-catalog` package with the query service. The only active query engine is OpenCode. New OpenAI questions default to OpenRouter; explicit subscription selections are retained.

`cloudflared` optionally publishes the web service through Cloudflare Tunnel. Configure Cloudflare Access before exposing the UI. Query and sync services remain on the internal Docker network.

Persistent directories are `vault/`, `chat/`, `status/`, and `logs/`. The chat database is migrated transactionally on first use. Historical answer payloads are retained, including answers produced by retired engines.
