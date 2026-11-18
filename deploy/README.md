# Deploying the server to a VPS

One machine runs three Docker containers:
- **api**: the Express server, built from `server/Dockerfile`. It also serves the admin panel.
- **db**: Postgres 17. Its data lives in the `pgdata` volume.
- **caddy**: HTTPS on ports 80/443, with automatic Let's Encrypt certificates.

Uploaded photos live in the `uploads` volume, so a single VPS doesn't need S3.

## First setup
1. **The VPS.** Any Linux box with 1 vCPU, 1–2 GB RAM and 20 GB disk is enough to start. Install Docker by following https://docs.docker.com/engine/install/. The compose plugin is included.
2. **DNS.** Create an `A` record (and `AAAA` if you have IPv6) for your API domain, e.g. `api.eyespeeled.app`, pointing to the VPS IP.
3. **Firewall.** Allow only SSH and web traffic:
   ```sh
   ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
   ```
4. **Code.**
   ```sh
   git clone <repo> /opt/eyespeeled
   cd /opt/eyespeeled/deploy
   ```
5. **Secrets.** Run `cp .env.example .env`. Fill in every `change-me` with `openssl rand -hex 32`, and use your real `ANTHROPIC_API_KEY`. The server refuses to start while a placeholder is left.
6. **Start.**
   ```sh
   docker compose up -d --build
   ```
   Migrations and the word seed run automatically when the api container starts.
7. **Check.** `curl https://<API_DOMAIN>/health` should return `{"ok":true}`. The admin panel is at `https://<API_DOMAIN>/admin-panel/`.
8. **Point the apps and services at it:**
   - Set `EXPO_PUBLIC_API_URL=https://<API_DOMAIN>` for EAS production builds.
   - Set the RevenueCat webhook to `https://<API_DOMAIN>/webhooks/revenuecat`, with the Authorization header equal to `REVENUECAT_WEBHOOK_AUTH`.

## Updating
```sh
cd /opt/eyespeeled && git pull && cd deploy && docker compose up -d --build
```
The api container restarts. On SIGTERM it finishes in-flight photo checks first; anything still pending is re-checked on the next start.

## Logs
```sh
docker compose logs -f api      # JSON lines; every response has an x-request-id header you can search for
docker compose logs -f caddy
```

## Backups
`backup.sh` saves a Postgres dump and a tar of the photos to `/var/backups/eyespeeled`, keeping 14 days:
```sh
chmod +x backup.sh
crontab -e   # add: 15 3 * * * /opt/eyespeeled/deploy/backup.sh >> /var/log/eyespeeled-backup.log 2>&1
```
Also copy `/var/backups/eyespeeled` off the machine, e.g. with rclone to cloud storage or your provider's snapshots. A backup kept on the same disk doesn't protect against losing the disk.

**Restore** (test this once before launch):
```sh
docker compose stop api
docker compose exec -T db pg_restore -U eyespeeled -d eyespeeled --clean --if-exists < /var/backups/eyespeeled/db-<stamp>.dump
docker compose run --rm -T --entrypoint tar api -C /data -xzf - < /var/backups/eyespeeled/uploads-<stamp>.tar.gz
docker compose start api
```

## Limits
Run **one** api container. The photo-check queue, the rate limits and the uploads folder are all local to the process (see TODO P2 "Scale").
