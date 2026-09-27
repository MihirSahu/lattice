# Deployment

1. Install Docker Engine and Compose on a 64-bit Linux host.
2. Clone the repository into `/opt/lattice` or a similar stable location.
3. Create `/srv/lattice/{vault,chat,status,logs}`.
4. Copy `.env.example` to `.env`; set `LATTICE_DATA_ROOT=/srv/lattice`, S3 read-only credentials, `OPENROUTER_API_KEY`, and web identity configuration.
5. Start the stack:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build -d --remove-orphans
```

GPT-6 Luna through OpenRouter is the only supported model. Subscription authentication and its Compose overlay have been removed; use only the main Compose file. Existing OAuth files on the host are left untouched.

## Boot persistence

Install `infra/systemd/lattice-compose.service`. Remove any old subscription overlay from customized start/stop commands.

```bash
sudo cp infra/systemd/lattice-compose.service /etc/systemd/system/lattice-compose.service
sudo systemctl daemon-reload
sudo systemctl enable --now lattice-compose.service
```

## Cloudflare

Enable the `cloudflare` Compose profile with `CLOUDFLARE_TUNNEL_TOKEN` set. Set `WEB_AUTH_MODE=cloudflare` and protect the hostname with Cloudflare Access. Only publish the web service.

## Upgrades

Back up chat SQLite and runtime data before upgrading. Pull the reviewed revision, then rebuild with the start command above. Frozen pnpm installation fixes dependency versions; OpenCode CLI and SDK are pinned together.

The QMD removal migration preserves historical messages and converts old thread settings to OpenCode/OpenRouter. `--remove-orphans` removes the retired container. Old `qmd/` and `qmd-cache/` bind-mount directories remain on disk and are not used by the new stack; remove them separately only after verifying the upgrade and your backups.

The Luna migration updates every thread's future model settings while preserving historical answers, traces, and timestamps.

Validate a real question after deployment, including file citations, streamed progress, and cancellation. Local tests and image builds do not prove provider authentication or model availability.
