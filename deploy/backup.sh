#!/usr/bin/env bash
# Nightly backup: Postgres dump + uploaded photos. Keeps 14 days.
# Cron (as root):  15 3 * * * /opt/eyespeeled/deploy/backup.sh >> /var/log/eyespeeled-backup.log 2>&1
set -euo pipefail

DEST=${BACKUP_DIR:-/var/backups/eyespeeled}
KEEP_DAYS=${KEEP_DAYS:-14}
cd "$(dirname "$0")"
mkdir -p "$DEST"
stamp=$(date -u +%Y%m%dT%H%M%SZ)

docker compose exec -T db pg_dump -U eyespeeled -d eyespeeled --format=custom > "$DEST/db-$stamp.dump"
docker compose exec -T api tar -C /data -czf - uploads > "$DEST/uploads-$stamp.tar.gz"

find "$DEST" -type f -mtime +"$KEEP_DAYS" -delete
echo "$(date -u) backup ok: $DEST/*-$stamp.*"
