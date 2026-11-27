#!/bin/sh
# Har kuni zaxira nusxa: crontab -e  →  15 3 * * * /opt/littlestar/deploy/backup.sh
mkdir -p /opt/littlestar/backups
sqlite3 /opt/littlestar/data/littlestar.db ".backup '/opt/littlestar/backups/littlestar-$(date +%F).db'"
find /opt/littlestar/backups -name 'littlestar-*.db' -mtime +30 -delete
# O‘qituvchi va o‘quvchilar yuklagan fayllar (videolar, vazifa rasmlari) — faqat yangilari nusxalanadi
mkdir -p /opt/littlestar/backups/uploads && cp -rn /opt/littlestar/data/uploads/. /opt/littlestar/backups/uploads/ 2>/dev/null || true
