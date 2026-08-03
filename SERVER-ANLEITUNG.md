# Dr.ReWaWi auf deinem Ubuntu-Server installieren
### Die Idioten-Anleitung 🙂 — Befehl für Befehl, ohne Vorwissen

**Ausgangslage:** Du sitzt an deinem Windows-Laptop, der heruntergeladene
Ordner liegt vor, und du kommst per `ssh` auf deinen Server.
**Dauer:** ca. 30–45 Minuten. **Platzbedarf auf dem Server:** ~3 GB frei.

> **Platzhalter:** Überall wo `BENUTZER`, `SERVER-ADRESSE` oder
> `wawi.deinname.dynv6.de` steht, setzt du deine eigenen Werte ein
> (denselben Benutzer/dieselbe Adresse wie bei deinem bisherigen ssh-Befehl).

---

## Teil 1: Ordner am Laptop vorbereiten (3 Minuten)

1. Den heruntergeladenen Ordner **entpacken** (Rechtsklick → „Alle extrahieren").
2. Im entpackten Ordner **drei Dinge löschen** (falls vorhanden):
   - den Ordner **`node_modules`** (riesig, wird auf dem Server neu gebaut)
   - den Ordner **`dist`** (wird ebenfalls neu gebaut)
   - die Datei **`.env`** (enthält Kimi-Zugangsdaten — gehört nicht auf den Server)

> **Optional — deine bisherigen Daten mitnehmen:** Die Datei `imtz-daten.sql`
> enthält deine Firmendaten, Kunden und Produkte. Willst du damit starten
> statt mit einer leeren Datenbank, dann: **Kopie** der Datei anlegen, diese
> in **`dump.sql`** umbenennen und später in Teil 4 die markierte Zeile in
> der `docker-compose.yml` einkommentieren. Beim ersten Start werden dann
> deine Daten importiert.

---

## Teil 2: Ordner auf den Server kopieren (5 Minuten)

Windows-Eingabeaufforderung (cmd) öffnen und eingeben — Pfad und Ziel anpassen:

```
scp -r "C:\Users\DEINNAME\Downloads\app" BENUTZER@SERVER-ADRESSE:rewaki
```

- Das Passwort ist dein normales SSH-Passwort (bei der Eingabe sieht man
  nichts — das ist normal).
- Dauert je nach Leitung ein paar Minuten. Am Ende kehrt der Cursor zurück.

---

## Teil 3: Docker auf dem Server prüfen/installieren (5–10 Minuten)

Auf den Server wechseln:

```
ssh BENUTZER@SERVER-ADRESSE
```

Prüfen, ob Docker schon da ist:

```
docker --version
docker compose version
```

**Beide Befehle zeigen eine Versionsnummer?** → weiter mit Teil 4.

**„command not found"?** → installieren:

```
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
exit
```

Danach **einmal neu per ssh anmelden** (damit die Gruppenrechte greifen) und
nochmal `docker compose version` prüfen.

> Älteres Ubuntu, Paket `docker-compose-v2` nicht gefunden? Dann
> `sudo apt install -y docker-compose` und in dieser Anleitung überall
> `docker-compose` (mit Bindestrich) statt `docker compose` schreiben.

---

## Teil 4: Passwörter setzen (3 Minuten)

```
cd ~/rewaki
openssl rand -hex 32
```

Die lange Zufallszeichenfolge **markieren & kopieren** (in cmd/Putty:
Markieren kopiert meist schon). Dann:

```
cp .env.example .env
nano .env
```

In der `.env` **drei Werte** setzen (die `docker-compose.yml` enthält seit
1.3.0 bewusst keine Secret-Werte mehr — Compose liest die `.env`
automatisch ein):

1. `MYSQL_ROOT_PASSWORD=` → eigenes Datenbank-Passwort eintragen
2. `DATABASE_URL=mysql://root:<MYSQL_ROOT_PASSWORD>@db:3306/rewaki` → dasselbe Passwort in der URL einsetzen
3. `APP_SECRET=` → die kopierte Zufallszeichenfolge einfügen (Einfügen in nano: Rechtsklick)

**Optional (siehe Teil 1):** Für den Import deiner Daten die Zeile
`# - ./dump.sql:/docker-entrypoint-initdb.d/schema.sql:ro` einkommentieren
(Raute entfernen) und die schema.sql-Zeile darüber mit `#` auskommentieren.

Speichern: **Strg+O**, **Enter**, **Strg+X**.

---

## Teil 5: Starten (10 Minuten, davon 8 warten)

```
docker compose up -d --build
```

Beim ersten Mal werden Images geladen und das Programm gebaut — Kaffee holen.
Dann prüfen:

```
docker compose logs -f app
```

Warten bis **`Server running on http://localhost:3000/`** erscheint.
Mit **Strg+C** zurück zur Eingabe (das stoppt nur die Anzeige, nicht das Programm).

Kurztest auf dem Server:

```
curl -I http://localhost:3000
```

→ Antwort `HTTP/1.1 200 OK` = läuft. ✅

---

## Teil 6: Von überall erreichbar machen — dynv6 + Caddy (10 Minuten)

Das Prinzip kennst du schon von Matrix — wir machen exakt dasselbe noch einmal.

**Schritt 1 — Hostname bei dynv6 anlegen** (im Browser, dynv6-Login):
- Neuen Hostnamen anlegen, z. B. `wawi.deinname.dynv6.de`
- Am einfachsten: als **CNAME auf deinen Matrix-Hostnamen** zeigen lassen —
  dann hat er automatisch immer dieselbe IP und du musst dich um
  IP-Updates **nicht** kümmern.
- (Alternativ: dieselben A/AAAA-Einträge wie beim Matrix-Hostnamen.)

**Schritt 2 — Caddyfile erweitern** (auf dem Server):

```
sudo nano /etc/caddy/Caddyfile
```

Ans **Ende** der Datei diesen Block anfügen (Hostname anpassen!):

```
wawi.deinname.dynv6.de {
    reverse_proxy 127.0.0.1:3000
}
```

Speichern: **Strg+O**, **Enter**, **Strg+X**. Dann:

```
sudo systemctl reload caddy
```

**Schritt 3 — Fertig.** Caddy holt sich automatisch das HTTPS-Zertifikat
(die Portweiterleitung 80/443 auf deinen Server existiert ja schon wegen
Matrix). Nach 1–2 Minuten im Browser öffnen:

**https://wawi.deinname.dynv6.de**

---

## Teil 7: Ersteinrichtung (5 Minuten)

1. Die Seite zeigt die **Ersteinrichtung**: Admin-Konto anlegen
   (Benutzername + Passwort, gut merken!).
2. **Schritt 2:** Firmendaten eintragen, optional Bankverbindung.
   (Hast du deine Daten per `dump.sql` importiert, einfach „Überspringen".)
3. Danach: **Einstellungen → Benutzer** (weitere Konten),
   **Listen → CSV importieren** (Kunden/Produkte, falls nicht importiert).

---

## Teil 8: Automatisches Backup einrichten (3 Minuten)

```
mkdir -p ~/backups
crontab -e
```

(Beim ersten Mal Editor-Frage → `1` für nano.) Diese Zeile ans Ende —
sie liest das Datenbank-Passwort selbst aus der `.env`:

```
17 3 * * * DB_PASS=$(sed -n 's/^MYSQL_ROOT_PASSWORD=//p' $HOME/rewaki/.env) && docker compose -f $HOME/rewaki/docker-compose.yml exec -T db mysqldump -u root -p"$DB_PASS" rewaki > $HOME/backups/rewaki-$(date +\%Y-\%m-\%d).sql 2>/dev/null
```

→ Jede Nacht um 3:17 Uhr eine Sicherung in `~/backups/`. Kopier dir die
Dateien ab und zu auf den Laptop (umgekehrtes scp):

```
scp -r BENUTZER@SERVER-ADRESSE:backups "C:\Users\DEINNAME\Downloads"
```

---

## Teil 9: Später mal aktualisieren

### Weg A (empfohlen, sobald das Projekt auf GitHub ist): `update.sh`

Einmalig auf dem Server (statt des scp-Ordners):

```
cd ~
mv rewaki rewaki-alt
git clone https://github.com/DEIN-NAME/rewaki.git rewaki
cp rewaki-alt/docker-compose.override.yml rewaki/  # falls vorhanden
cd rewaki && sudo docker compose up -d --build
```

Danach genügt für jedes Update ein einziger Befehl:

```
cd ~/rewaki && sudo ./update.sh
```

Das Skript holt den neuesten Stand von GitHub, baut neu und startet um.
Datenbank und Passwörter (Override-Datei) bleiben unangetastet; das
Datenbankschema migriert die App beim Start selbst. **Keine
Handkorrekturen mehr nötig.**

### Weg B (ohne GitHub): Ordner per scp

1. Neuen Ordner herunterladen, am Laptop wieder `node_modules`, `dist`,
   `.env` löschen.
2. Hochladen — **Achtung, scp-Falle:** Erst *in* den Ordner wechseln und
   den **Inhalt** hochladen, nicht den Ordner selbst, sonst landet alles
   verschachtelt in `~/rewaki/Dr.ReWaWi/`:

   ```
   cd "C:\Users\DEINNAME\Downloads\app"
   scp -r * hazehunter@SERVER-ADRESSE:rewaki/
   ```

3. Auf dem Server: `cd ~/rewaki && sudo docker compose up -d --build`
4. **Datenbank und Einstellungen bleiben erhalten** (Docker-Volume).
   Fehlende Datenbank-Spalten neuer Versionen zieht die App beim Start
   **automatisch** nach (Selbst-Migration).
5. Browser **hart neu laden** (Strg+F5), sonst zeigt er die alte App.

> **Eigene Passwörter dauerhaft schützen:** Deine Geheimnisse stehen in der
> `.env` — die wird beim Update **nie** überschrieben (der SupportHub und
> diese Anleitung lassen `.env` immer in Ruhe). Die `docker-compose.yml`
> darf deshalb bedenkenlos ersetzt werden: Sie enthält seit 1.3.0 keine
> Werte mehr, sondern verweist nur auf die Variablennamen.

---

## Wenn was klemmt

| Problem | Lösung |
|---|---|
| `docker: command not found` | Teil 3 nochmal, danach neu per ssh anmelden |
| Build bricht ab: `vite: not found` | Ursache: Das npm aus node:20 stürzt bei knappem RAM ab (`npm error Exit handler never called!`). Das aktuelle Dockerfile nutzt node:22 (npm 11) + Wiederholungsversuch. Hilft das nicht: RAM prüfen mit `free -h` und ggf. Swap anlegen (unten) |
| Build bricht ab: `Killed` / npm stürzt ab | Arbeitsspeicher knapp. Swap-Datei anlegen: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`, danach Build wiederholen |
| „port is already allocated" (3000) | In `docker-compose.yml` ports auf `"3100:3000"` ändern **und** im Caddyfile `reverse_proxy 127.0.0.1:3100` |
| Browser zeigt Zertifikatsfehler / Seite nicht erreichbar | 2–3 Minuten warten (Zertifikat wird geholt); prüfen: `sudo ss -tlnp \| grep caddy`; Hostname muss auf die Server-IP zeigen |
| Login-Seite lädt, aber Anmelden geht nicht | `docker compose logs -f app` — Fehlermeldung lesen |
| Alles soll von vorn losgehen | `docker compose down -v` (**löscht die Datenbank!**), dann Teil 5 |

**Logs anschauen:** `docker compose logs -f app` (Programm) bzw.
`docker compose logs -f db` (Datenbank). Strg+C zum Verlassen.

## Sicherheit — drei Regeln

1. `LOCAL_AUTH_BYPASS` **niemals** auf dem Server setzen.
2. Regelmäßig: `sudo apt update && sudo apt upgrade -y`
3. Das Datenbank-Passwort aus Teil 4 gehört in keine E-Mail und keinen Chat.

---

## PraxiOS 1.0: Restore-Test (jährlich, Protokoll führen!)

Ziel: Nachweis, dass das Backup wirklich funktioniert. Dauer ~15 Minuten.
Führe das Protokoll in `Verfahrensdokumentation.md` (Abschnitt 10) fort.

```bash
# 1) Backup erzeugen
~/praxiswerk/scripts/backup.sh

# 2) Neuestes Paket wählen + in Arbeitsverzeichnis entpacken
ls -t ~/backups/praxios/*.gpg | head -1
gpg --batch --yes --passphrase-file ~/.praxios-backup.secret \
  -d $(ls -t ~/backups/praxios/*.gpg | head -1) | tar xz -C /tmp && cd /tmp

# 3) Auf TEST-Datenbank einspielen (NICHT die Produktiv-DB!)
DB_PASS=$(sed -n 's/^MYSQL_ROOT_PASSWORD=//p' ~/praxiswerk/.env)
docker exec -i praxiswerk-db-1 mysql -uroot -p"$DB_PASS" \
  -e "DROP DATABASE IF EXISTS praxiswerk_restoretest; CREATE DATABASE praxiswerk_restoretest;"
cat /tmp/datenbank.sql | docker exec -i praxiswerk-db-1 mysql -uroot -p"$DB_PASS" praxiswerk_restoretest

# 4) App kurz auf die Test-DB zeigen lassen (zweite Instanz, Port 3101)
cd ~/praxiswerk
sudo docker run --rm -d --name praxios-restoretest \
  --network praxiswerk_default \
  -e DATABASE_URL=mysql://root:$DB_PASS@db:3306/praxiswerk_restoretest \
  -e APP_SECRET=$(sed -n 's/^APP_SECRET=//p' .env) \
  -e NODE_ENV=production -e PORT=3000 -p 3101:3000 praxiswerk-app

# 5) Dokumente-Volume in ein Test-Volume kopieren
docker volume create praxios-restoretest-docs
docker run --rm -v praxios-restoretest-docs:/ziel -v /tmp:/quelle alpine \
  sh -c 'tar xzf /quelle/dokumente.tar.gz -C /ziel'

# 6) Prüfen im Browser: http://192.168.178.62:3101
#    - Login mit den bekannten Zugangsdaten
#    - eine Patientenakte öffnen (Stammdaten + Chronik sichtbar?)
#    - ein Dokument (PDF) öffnen (Vorschau rendert?)
#    - eine Rechnung öffnen + PDF-Vorschau

# 7) Aufräumen + Protokoll eintragen
sudo docker stop praxios-restoretest
docker volume rm praxios-restoretest-docs
docker exec -i praxiswerk-db-1 mysql -uroot -p"$DB_PASS" \
  -e "DROP DATABASE praxiswerk_restoretest;"
#    -> Ergebnis + Datum in Verfahrensdokumentation.md (Abschnitt 10) eintragen
```
