# Cloudflare Tunnel and Access

## Goal

Expose only the Lattice web app to the public internet. Keep QMD and the sync worker private.

## Recommended Setup

1. Create a tunnel in Cloudflare Zero Trust.
2. Map the hostname for Lattice to `http://web:3000`.
3. Add a Cloudflare Access application for the same hostname.
4. Require login with your preferred identity provider.
5. Store the tunnel token in `CLOUDFLARE_TUNNEL_TOKEN`.

## Compose Integration

The Docker Compose file includes an optional `cloudflared` service:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml --profile cloudflare up -d
```

For the web app auth behavior itself:

- Set `WEB_AUTH_MODE=dev` and `WEB_DEV_USER_EMAIL=you@example.com` for local development without Cloudflare.
- Set `WEB_AUTH_MODE=cloudflare` for strict production-style auth that requires the Cloudflare Access email header.
- Set `WEB_AUTH_MODE=auto` only when you intentionally want Cloudflare-authenticated traffic to fall back to `WEB_DEV_USER_EMAIL` in non-Cloudflare environments.

## Security Notes

- Do not publish `qmd` or `sync-worker` ports on the host.
- Access should happen at the Cloudflare edge before traffic reaches the origin.
- `WEB_AUTH_MODE=dev` is intended for local development only.
- If you do expose the web port directly for local troubleshooting, keep that scoped to LAN-only access.
