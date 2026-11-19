#!/bin/sh
# Har kuni zaxira nusxa: crontab -e  →  15 3 * * * /opt/littlestar/deploy/backup.sh
mkdir -p /opt/littlestar/backups
sqlite3 /opt/littlestar/data/littlestar.db ".backup '/opt/littlestar/backups/littlestar-$(date +%F).db'"
find /opt/littlestar/backups -name 'littlestar-*.db' -mtime +30 -delete
