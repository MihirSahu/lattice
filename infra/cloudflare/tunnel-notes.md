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

## Security Notes

- Do not publish `qmd` or `sync-worker` ports on the host.
- Access should happen at the Cloudflare edge before traffic reaches the origin.
- If you do expose the web port directly for local troubleshooting, keep that scoped to LAN-only access.

