# Deployment

## Raspberry Pi Host Preparation

1. Install Docker Engine and Compose plugin.
2. Clone the repository to `/opt/lattice` or a similar stable path.
3. Create `/srv/lattice/{vault,qmd,status,logs}`.
4. Create `.env` from `.env.example`.

## Start the Stack

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build -d
```

## Boot Persistence

Install the systemd unit from `infra/systemd/lattice-compose.service` and enable it:

```bash
sudo cp infra/systemd/lattice-compose.service /etc/systemd/system/lattice-compose.service
sudo systemctl daemon-reload
sudo systemctl enable --now lattice-compose.service
```

## Cloudflare

Run the optional `cloudflared` service with `CLOUDFLARE_TUNNEL_TOKEN` set. Restrict access with Cloudflare Access before any request reaches `web`.

## Upgrades

```bash
git pull
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build -d
```

Back up `/srv/lattice/qmd` before changing QMD versions.

