# demopa — Dr.PaWaWi-Demo-Instanz einrichten

Ziel: `demopa.praxios.dynv6.net` als öffentliche Demo mit Praxis-Musterdaten,
täglichem Reset und wählbarer Oberfläche (seriöse Landingpage `/demo/` oder
Retro-Demo-PC `/xp-desktop/`).

## 1) Ordner anlegen + Paket bereitstellen

Auf dem Server (einmalig):

```bash
mkdir -p ~/demopa && cd ~/demopa
# Paket hochladen (SupportHub → Bereitstellen → demopa-Karte) ODER manuell:
scp DrPaWaWi-v1.6.0.tar.gz server:~/demopa/
tar xzf DrPaWaWi-v1.6.0.tar.gz --strip-components=1
```

## 2) Demo-Compose aktivieren + .env

```bash
cd ~/demopa
cp demo/docker-compose.yml docker-compose.yml     # demopa-Stack (Port 3202)
cp .env.example .env
nano .env
```

`.env` (DB-Name beachten — **demopa**, nicht praxiswerk):

```
MYSQL_ROOT_PASSWORD=<eigenes-demo-passwort>
DATABASE_URL=mysql://root:<eigenes-demo-passwort>@db:3306/demopa
APP_SECRET=<openssl rand -hex 32>
```

Start: `docker compose up -d --build`

## 3) Musterdaten seeden

```bash
docker compose exec app npx tsx db/demoSeed.ts
```

Login auf der Landingpage (`https://demopa.praxios.dynv6.net/demo/`):
**demo / pawawi-demo** (Therapeuten-Logins: `lena`, `jonas`, gleiches Passwort).

## 4) Domain + Caddy

- dynv6: dritte Zone `demopa.praxios.dynv6.net` (A-Record wie die anderen; kein AAAA).
- Caddyfile ergänzen:

```
demopa.praxios.dynv6.net {
    reverse_proxy 127.0.0.1:3202
}
```

`docker compose restart caddy` (bzw. Reload) — fertig.

## 5) SupportHub-Registrierung (Updates aus dem Hub)

a) Volume-Mount in der **Hub**-Compose (app-Service):

```yaml
      - /home/hazehunter/demopa:/projekte/demopa
```

b) Kontext in `server-kontexte.json`:

```json
{
  "id": "demopa",
  "name": "Demo Dr.PaWaWi (öffentlich)",
  "typ": "compose",
  "pfad": "/projekte/demopa",
  "composeProjekt": "demopa",
  "healthUrl": "http://192.168.178.62:3202/demo/",
  "produktVon": "praxiswerk",
  "behalten": ["docker-compose.yml", ".env"]
}
```

Danach `docker compose up -d` im Hub-Ordner. Updates laufen dann über
Bereitstellen → demopa-Karte → Quelle „GitHub-Release" (Normalfall) oder Paket-Upload.
**Achtung:** Das Update ersetzt auch `demo/` und `scripts/` — die Reset-Cronzeile
und die `.env` bleiben erhalten (`.env` steht in `behalten`).

## 6) Täglicher Reset (Demo-Hygiene)

```bash
chmod +x scripts/demo-reset.sh
crontab -e
#   30 3 * * * /home/hazehunter/demopa/scripts/demo-reset.sh >> ~/demopa-reset.log 2>&1
```

Der Reset leert die Datenbank, lässt die Migration frisch laufen und seedet
die Musterdaten neu; Uploads im Dokumente-Volume werden entfernt.

## Hinweise

- **Kein eigener LibreTranslate-Container** in der Demo (RAM) — mehrsprachige
  Bögen zeigen nur Deutsch. Bei Bedarf in der Compose einkommentieren.
- Keine echten Zugänge in der Demo (SMTP/Bank leer lassen); das DB-Passwort der
  Demo ist eigenständig und hat mit der Produktiv-Instanz nichts zu tun.
- Die XP-Illusion liegt unter `/xp-desktop/` (statisch, gleiche Origin — der
  App-Iframe darin funktioniert sofort). Landingpage: `/demo/`.
