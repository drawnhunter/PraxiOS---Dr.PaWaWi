#!/usr/bin/env bash
# demopa-Reset: Datenbank leeren, Migration frisch laufen lassen, Musterdaten
# neu seeden. Gedacht für den täglichen Cron auf der Demo-Instanz:
#   30 3 * * * /home/hazehunter/demopa/scripts/demo-reset.sh >> ~/backups/demopa-reset.log 2>&1
set -euo pipefail

PROJEKT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJEKT_DIR"

DB_PASS="${DB_PASS:-}"
if [[ -z "$DB_PASS" && -f .env ]]; then
  DB_PASS="$(sed -n 's/^MYSQL_ROOT_PASSWORD=//p' .env | head -1)"
fi
[[ -n "$DB_PASS" ]] || { echo "FEHLER: MYSQL_ROOT_PASSWORD nicht gefunden (.env)."; exit 1; }

echo "[$(date -Is)] demopa-Reset startet"

# 1) Datenbank komplett zurückwerfen
docker compose exec -T db mysql -uroot -p"$DB_PASS" \
  -e "DROP DATABASE IF EXISTS demopa; CREATE DATABASE demopa;"

# 1b) Basis-Schema wieder einspielen — das Init (schema.sql) läuft bei MySQL
# nur beim ALLERERSTEN Volume-Start; nach einem Drop bleibt die DB sonst leer
# und die Migration kann nur inkrementelle Ergänzungen (keine Basistabellen!).
docker compose exec -T db sh -c "mysql -uroot -p\"$DB_PASS\" demopa" < "$PROJEKT_DIR/schema.sql"

# 2) App neu starten — Migration (Lücken + Leistungskatalog) läuft frisch
docker compose restart app
echo "Warte auf Migration …"
for i in $(seq 1 24); do
  if docker compose logs app --tail=200 2>/dev/null | grep -q "\[seed\] Leistungskatalog\|\[seed\] Gruppen\|Server running"; then
    break
  fi
  sleep 5
done
sleep 5

# 3) Musterdaten seeden (tsx ist über vitest im Image vorhanden)
docker compose exec -T app npx tsx db/demoSeed.ts

# 4) Dokumente-Volume leeren (Uploads der Demo-Nutzer)
docker volume rm demopa_dokumente >/dev/null 2>&1 || true
docker compose up -d >/dev/null

echo "[$(date -Is)] demopa-Reset fertig"
