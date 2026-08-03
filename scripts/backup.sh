#!/usr/bin/env bash
# PraxiOS — verschlüsseltes Backup (mysqldump + dokumente-Volume, gpg AES256)
#
# Einrichtung (einmalig):
#   1) Passphrase-Datei anlegen (NICHT ins Repo!):
#        install -m 600 /dev/null ~/.praxios-backup.secret
#        openssl rand -base64 32 > ~/.praxios-backup.secret
#   2) Backup-Ziel anlegen:  mkdir -p ~/backups/praxios
#   3) Cron (täglich 03:30):  crontab -e
#        30 3 * * * /home/hazehunter/praxiswerk/scripts/backup.sh >> ~/backups/praxios/backup.log 2>&1
#
# Restore siehe SERVER-ANLEITUNG.md (Abschnitt „Restore").
set -euo pipefail

PROJEKT="${PROJEKT:-praxiswerk}"                 # Docker-Compose-Projektname
DB_CONTAINER="${DB_CONTAINER:-${PROJEKT}-db-1}"
DB_NAME="${DB_NAME:-praxiswerk}"
DB_PASS="${DB_PASS:-}"

# DB-Passwort aus der .env des Projekts lesen (dort steht es seit 1.3.0 —
# die docker-compose.yml enthält bewusst keine Secret-Werte mehr).
SKRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJEKT_DIR="$(dirname "$SKRIPT_DIR")"
if [[ -z "$DB_PASS" && -f "$PROJEKT_DIR/.env" ]]; then
  DB_PASS="$(sed -n 's/^MYSQL_ROOT_PASSWORD=//p' "$PROJEKT_DIR/.env" | head -1)"
fi
[[ -n "$DB_PASS" ]] || {
  echo "FEHLER: DB-Passwort nicht gefunden (MYSQL_ROOT_PASSWORD in $PROJEKT_DIR/.env setzen oder DB_PASS übergeben)."
  exit 1
}
ZIEL="${BACKUP_ZIEL:-$HOME/backups/praxios}"
SECRET_FILE="${SECRET_FILE:-$HOME/.praxios-backup.secret}"
BEHALT_TAGE="${BEHALT_TAGE:-30}"

[[ -f "$SECRET_FILE" ]] || { echo "FEHLER: $SECRET_FILE fehlt (siehe Kopf des Skripts)"; exit 1; }
mkdir -p "$ZIEL"

STAMP="$(date +%F_%H-%M)"
ARBEIT="$(mktemp -d)"
trap 'rm -rf "$ARBEIT"' EXIT

echo "[$(date -Is)] Backup startet → $ARBEIT"

# 1) Datenbank-Dump
docker exec "$DB_CONTAINER" mysqldump -uroot "-p$DB_PASS" "$DB_NAME" \
  --single-transaction --routines --events > "$ARBEIT/datenbank.sql"

# 2) Dokumente-Volume (Uploads)
docker run --rm -v "${PROJEKT}_dokumente:/daten:ro" -v "$ARBEIT:/ziel" \
  alpine tar czf /ziel/dokumente.tar.gz -C /daten .

# 3) Verschlüsseln + ablegen
PAKET="$ZIEL/praxios-backup-$STAMP.tar.gz.gpg"
tar czf - -C "$ARBEIT" . \
  | gpg --batch --yes --symmetric --cipher-algo AES256 \
      --passphrase-file "$SECRET_FILE" \
      -o "$PAKET"

# 4) Rotation
find "$ZIEL" -name 'praxios-backup-*.tar.gz.gpg' -mtime "+$BEHALT_TAGE" -delete

echo "[$(date -Is)] Fertig: $PAKET ($(du -h "$PAKET" | cut -f1))"
