# Changelog — PraxiOS

## [1.12.0] — 2026-09-15 — Praxisbedarf-Bestellung („zur Anwendung in der Praxis")

### Neu
- **Praxisbedarf-Bestellung als eigener Dokumententyp** — ohne Patientenbezug:
  Auf der Seite „Rezepte & Atteste" gibt es den neuen Bereich
  „Praxisbedarf-Bestellung" (Artikel, Stärke, Menge/Packung, **PZN**,
  Hinweis). Das PDF trägt den Empfänger „Zur Anwendung in der Praxis" +
  Praxisadresse und den Fußhinweis „Bestellung für den Praxisbedarf — nicht
  zur Abgabe an Patientinnen und Patienten". Damit entfällt der bisherige
  Workaround mit Schein-Patient (und dessen Geburtsdatum im Dokument).
- **PZN-Feld** gibt es jetzt auch im normalen Privatrezept-Dialog (optional).
- Bestellungen werden abgelegt unter `dokumente/_praxis/` (kein Aktenbezug),
  tauchen in „Zuletzt erstellt" auf und sind in der eigenen Liste
  nachvollziehbar (PDF erneut laden, Löschen mit Protokoll).

### Datenmodell / Migration (läuft automatisch beim Start)
- `rezepte.typ` um `praxisbedarf` erweitert; `rezepte.patient_id` und
  `documents.patient_id` sind jetzt nullable (praxisweite Dokumente).
- Patienten-Portal unverändert: patientenlose Einträge erscheinen dort
  grundsätzlich nicht.

---

## [1.11.0] — 2026-09-14 — Portal-Upgrade: Dokumente-Fix + neues Layout

### Fix (gemeldet aus dem Realbetrieb)
- **Portal zeigte keine Dokumente**: Der Portal-Filter ließ nur die Kategorien
  Befund/Arztbrief/Rezept/Einverständnis zu — in der Praxis landet aber fast
  jeder Upload als „Sonstiges" (Standard im Upload-Dialog), wodurch der
  Bereich trotz gefüllter Akte leer blieb. Jetzt sieht der Patient alle
  eigenen Dokumente (es sind ohnehin ausschließlich eigene Daten, Art. 15);
  die Praxis steuert die Sichtbarkeit weiter über Einstellungen →
  Patienten-Portal.

### Patienten-Portal: neues Layout
- **Sidebar-Konzept**: links Patientenkarte (Name, „angemeldet bis …") +
  Menü + Abmelden + DSGVO-Hinweis, rechts die Detailansicht; auf kleinen
  Bildschirmen wird die Sidebar zur Leiste oben
- **Therapieplan komplett neu**: statt endloser Einzelzeilen jetzt
  **Tageskarten** — Wochentag + Datum, Anwendungen als kompakte Chips mit
  Status (erledigt/geplant/ausgefallen), Tages-Zusammenfassung
  („abgeschlossen" / „2/7 erledigt" / „geplant") und Plan-Summe
  („X Anwendungen · Y erledigt")
- **Termine** ebenfalls nach Tagen gruppiert (Karte je Tag, Zeit prominent)
- **Dokumente & Atteste**: Kategorie-Badge + Ladezustand beim PDF-Download

---

## [1.10.0] — 2026-09-14 — Patienten-Portal + ReWaWi-Sync v1.10–v1.12

### Patienten-Portal (Flaggschiff — rechtssauber per Konstruktion)
- **Geschützter Zugang pro Patient**: Link aus der Patientenakte (30 Tage) +
  **Geburtsdatum als zweiter Faktor** → Session (24 h). Kein Passwort nötig —
  nutzt die bewährte Token-Infrastruktur der Anamnesebögen
- **Nur eigene Daten, jeder Zugriff auditiert** (DSGVO Art. 9): Termine,
  eigener Therapieverlauf (Art. 15), Dokumente (Befund/Arztbrief/Rezept/
  Einverständnis), Atteste & Rezepte als PDF, eigene Kontaktdaten
- **Datenänderungs-Anträge**: Patient schlägt vor, Praxis bestätigt (erst dann
  werden Stammdaten übernommen) oder lehnt ab — kein ungeprüftes Überschreiben
- **Terminanfragen**: Wunschdatum + Zeitraum, Praxis bestätigt/lehnt mit Kommentar
- **Rate-Limiting + Sperre**: 5 Fehlversuche beim Geburtsdatum → 60 min Sperre
- **Praxis steuert alles**: Portal an/aus + Sichtbarkeit je Bereich
  (Einstellungen → Patienten-Portal), Links einzeln widerrufbar,
  Zugriffs-Protokoll in der Akte einsehbar

### ReWaWi-Sync v1.10.2–v1.12.0
- **Agent-API (Kimi Claw)**: REST `/api/agent/*` mit Bearer-Token (sha256),
  Autonomie-Stufen `vorschlag` (Standard) ↔ `vollautomatik` (Versand-Gate),
  jede Schreib-Aktion im `agent_log` auditiert, Settings-Sektion mit
  Token-Verwaltung — Lesen (offene Rechnungen, Entwürfe, Kunden ohne Rechnung
  seit X, Mahnungen, Import-Status) + Schreiben (Aufgaben, Kunden, Entwurf,
  Bank-Zuordnung mit Reversal)
- **Modul-System (Feature-Flags)**: tRPC-Gate (deaktivierte Router → 403),
  Sidebar-Filter, Einstellungen → Module mit Toggles; PaWaWi-Module ergänzt:
  Anamnese, Austausch, Rezepte, Protokolle — Daten bleiben beim Deaktivieren
  erhalten (signiertes Release bleibt die eine Wahrheit)
- **Banking-Dedupe formatübergreifend**: `quell_id` (Anbieter-TxID) als
  Dedup-Anker + schlanker SumUp-Transaktionsbericht-Parser +
  Duplikat-Prüfung im Banking (GoBD-sicher)
- **Update-Button** (Einstellungen → Update): aktuelle Version vs. neuestes
  GitHub-Tag + „Update anfordern" an den Hub (Auftrag Bus #27, App-Seite)

---

## [1.9.5] — 2026-09-10 — Fix: Login über direkte IP / WireGuard (Cookie-Falle)

### Fix
- **Login-Loop ohne Fehlermeldung** bei direktem Zugriff per LAN-IP (z. B.
  WireGuard-Diagnose, `http://192.168.x.x:3100`): Das Session-Cookie bekam
  immer `Secure` + `SameSite=None` — der Browser verwirft solche Cookies über
  HTTP, also lud die Seite nach dem (erfolgreichen!) Login einfach neu.
  Jetzt wird `Secure` ans tatsächliche Protokoll gekoppelt (über
  `x-forwarded-proto` hinter Caddy) — über HTTPS wie gehabt, über direkte
  IP/localhost funktioniert der Login jetzt. Produktions-Verhalten unverändert.

---

## [1.9.4] — 2026-09-10 — Fix: Heartbeat-Felder weglassen statt null (Hub 400)

### Fix (Fernverwaltung)
- Der Hub lehnte unseren Heartbeat mit 400 ab, weil wir `letztesBackup: null`
  und `backupGroesseMb: null` schickten, wenn noch kein Backup bestätigt war —
  optional heißt bei zod aber „Feld weglassen", nicht „null". Beide Felder
  werden jetzt nur gesendet, wenn sie einen Wert haben. Damit validiert der
  Hub den Herzschlag — die Kette ist geschlossen.

---

## [1.9.3] — 2026-09-10 — Hub-Client: Hub-Antworten mitloggen

### Diagnose-Nachschärfung
- Nicht-ok Hub-Antworten (Ablehnung, Paket-Gate, HTML statt JSON, HTTP-Status)
  werden jetzt mit den ersten 300 Zeichen der Antwort geloggt — der
  „keine ok-Antwort vom Hub"-Fall ist damit nicht mehr blind

---

## [1.9.2] — 2026-09-10 — Hub-Client: Sichtbarkeit in den Loop

### Diagnose-Fähigkeit (nach dem „kein Herzschlag kommt an"-Fall)
- **Log pro Takt**: `[hub] heartbeat ok` / `keine ok-Antwort vom Hub` /
  `kein Schlüssel verbunden — Takt übersprungen` / `Takt-Fehler: …` — das Log
  sagt jetzt bei jedem 10-Minuten-Takt, was passiert ist
- **Manueller Takt** (Admin): `support.jetztTakten` löst einen Takt sofort aus
  und gibt das Ergebnis zurück; `support.hubLetzterTakt` zeigt Zeitpunkt +
  Ergebnis des letzten Takts — kein Warten auf den Intervall mehr nötig

---

## [1.9.1] — 2026-09-09 — Hub-Client exakt auf API-Spezifikation (Bus #18)

### Fernverwaltung (Hub v0.6.0 ist live)
- **Hub-Client an die fertige API-Spezifikation angeglichen** (Kommentar zu
  Bus #18): Befehle lesen jetzt das `payload`-Feld, Ergebnisse gehen als
  `{schluessel, befehlId, erfolg, details, groesseMb?}` zurück — der Hub setzt
  damit die Backup-Frische automatisch nach erfolgreichem `backup`
- **Heartbeat ergänzt um `backupGroesseMb`** (Größe der neuesten Dump-Datei im
  Backups-Ordner)
- **`ping`-Befehl** (Premium-Stufe) wird sofort mit `pong` + Metadaten
  quittiert — damit fliegt der eingereihte Ping des Hubs direkt
- Paket-Gates bleiben Server-Sache (Hub v0.6.0: keins/basis/standard/premium)

---

## [1.9.0] — 2026-09-04 — ReWaWi-v1.8/v1.9-Sync + SupportHub-Anbindung (Pull-Modell)

### SupportHub-Anbindung (Bus-Auftrag #18)
- **Support-Button im Dashboard** (Blocker zuerst): Frage/Problem/Idee/Fehler
  direkt aus der App melden — mit Support-Schlüssel als Ticket im SupportHub
  (Paket-Status sichtbar), ohne Schlüssel klassisch per SMTP; jede Meldung wird
  lokal protokolliert (support_meldungen)
- **FehlerMelder**: fatale App-Fehler ersetzen die Ansicht durch eine ruhige
  Karte mit „Melden"-Weg (technischer Kontext wird angehängt) statt weißer Seite
- **Hub-Client (Pull/RMM)**: Heartbeat alle 10 min (Version, Status, Disk-%,
  Uptime, letztes Backup, Fehler 24 h) — nur wenn ein Support-Schlüssel
  verbunden ist, bei Hub-Ausfall still weiter. Befehle werden abgeholt und
  ausgeführt: `backup` (eigener DB-Dump gzipped ins Backups-Verzeichnis),
  `diagnose` (Metadaten-Paket zurück an den Hub), `update-hinweis` (lokale
  Registrierung). Keine Patienten-/Buchhaltungsdaten verlassen je den Server.

### ReWaWi-Sync v1.8.0–v1.9.2 (im Praxis-Kontext)
- **Rabatte**: Positions-Rabatt (% oder Festwert je Zeile) + Haupt-Rabatt auf
  den Gesamtbeleg (optional additiv zur Zwischensumme) — Largest-Remainder-
  Verteilung, EN16931-konform in der XRechnung (AllowanceCharges), auf dem PDF
  und im Entwurfs-Editor sichtbar
- **Fuzzy-Produktsuche überall**: Bezeichnungsfelder schlagen jetzt den
  Katalog beim Tippen vor (inkl. Artikelnummer/Barcode), mit Preis-Übernahme
- **NEM-/Produktlisten-Import**: Word-Preislisten (.docx) werden im Magic
  Import erkannt → Patient per Fuzzy-Match → Lieferschein-Entwurf direkt
- **Rechnung aus Lieferschein**: finalisierter Lieferschein → „Rechnung
  erstellen" (Positionen bekommen Preise aus dem Stamm, Konditionen zuerst)
- **Liquiditätsplanung** in der Statistik: Jahresmatrix, Monatsbudget mit
  Ampel, CSV/SVG-Export; **Währung** in den Einstellungen; Statistik mit
  Erklär-Bubbles, netto/brutto und klickbaren Balken
- **Mahnwesen-Dashboard-Karte**: fällige Mahnungen mit Stufen-Zähler und
  „Erinnern/Anmahnen"-Sprung; Mahn-Dialog nutzt Dialog-Adresse +
  Standard-Speichern
- **Angebots-Workflow**: Status offen/bestätigt/abgelehnt (+ verstrichen) —
  3-stufige Enum-Migration (war bereits drin)
- **Finalize-Kollisionsschutz** (v1.2.2-Muster): belegte Nummern werden
  übersprungen statt mit ER_DUP_ENTRY zu scheitern
- **Rechnungsliste mit Suche** (Nummer/Patient) neben dem Status-Filter
- Proformas werden aus allen Statistik-Zahlen ausgeschlossen (sind keine
  Einnahmen)

### Technik
- Keine neuen Dependencies nötig (NEM-Import nutzt node:zlib — die
  fflate-Falle aus Bus #13 ist damit entschärft)

---

## [1.8.1] — 2026-09-04 — Rezept/Attest: Stempel größer, A4 wählbar

### Anpassungen
- **Unterschrifts-Stempel deutlich größer** auf Rezept/Attest (war zu klein)
- **Format beim PDF-Download wählbar**: A5 (Rezeptpapier, Standard) oder
  A4 (klassisches Blatt) — Dropdown am PDF-Button in „Rezepte & Atteste"
- **Einstellungen**: ehrlicher Hinweis beim Signatur-Upload — eingescannte
  handschriftliche Unterschrift (auf dem Ausdruck ausreichend), bewusst keine
  qualifizierte elektronische Signatur, daher auch kein Verwirr-Hinweis auf
  dem Dokument

---

## [1.8.0] — 2026-09-04 — Attest v2: ICD-10-Suche, Feststellung, Ort

### Atteste & Krankschreibungen (große Ausbaustufe)
- **ICD-10-GM-Katalog 2026 lokal im System** (amtlicher BfArM-Katalog,
  kostenfreie Lizenz): ~10.000 Diagnose-Einträge, Suche per Code-Präfix
  (z. B. „J06") oder Krankheitsname — inkl. umgangssprachlicher Synonyme
  („Durchfall" findet Diarrhoe/Gastroenteritis, „Borreliose" findet
  Lyme-Krankheit, „Hexenschuss" → Lumbago …). Kein Online-Zugriff nötig
- **Diagnose optional pro Attest ausweisbar** (Schalter „Diagnose mit
  ICD-10-Code ausweisen" + Chips je gewähltem Code): Standard bleibt ohne
  Diagnose — sauber für Arbeitgeber-Exemplare; für Kasse/Patientin aktivierbar
- **Feststellung komplett**: Feststellungsdatum (Standard: heute),
  Erst-/Folgebescheinigung-Umschalter (nur AU), **Ort der Feststellung**
  (Praxis / Hausbesuch / Videosprechstunde / anderer Ort als Freitext) —
  abgebildet als Pflichtzeile „Festgestellt am … · Erstbescheinigung · Ort: …"
  auf dem PDF (Anforderungen § 5 EFZG)
- **A5-Layout verfeinert**: das Wasserzeichen (Arzt-/Praxisname groß in Weiß
  auf der grauen Box) wird jetzt automatisch verkleinert, bis der Name in
  eine Zeile passt — kein unschöner Umbruch mehr

---

## [1.7.3] — 2026-08-23 — Sicherheit: Keine rohen DB-Fehler mehr am Client

### Security (Handover-Baustelle „Login zeigt rohe SQL-Fehler")
- **DB-Treiberfehler werden jetzt maskiert**: Bei Datenbank-Ausfällen landeten
  bisher komplette SQL-Queries **inkl. Parameterwerte** (z. B. Benutzernamen)
  im Browser — Tabellen-/Spaltennamen und Daten sichtbar. Ab jetzt zeigt der
  Client eine generische Meldung; die vollen Details stehen nur noch im
  Server-Log (`[db-treiberfehler]`).
- **Fachliche Fehlermeldungen bleiben unverändert** (Validierungen,
  „nicht gefunden"-Hinweise etc. gehen weiterhin verständlich an den Client —
  die Maskierung greift nur bei echten Treiberfehlern: DrizzleQueryError,
  MySQL-`ER_*`-Codes, Connection-Fehler)

---

## [1.7.2] — 2026-08-22 — Fix: Migrations-Reihenfolge (AFTER-Verweis)

### Fix
- **`backup_zuletzt_am` wurde auf Bestands-DBs nicht angelegt**: Die Spalte
  stand in der Migrationsliste VOR `patienten_nr_prefix`, referenzierte sie
  aber per `AFTER` — das ALTER schlug fehl (isoliert geloggt), danach
  scheiterte `settings.get` mit „Unknown column". Reihenfolge korrigiert.
- **Neue Ordnungs-Wache** (`api/migrate.test.ts`): prüft statisch, dass jeder
  AFTER-Verweis in der Migration auflösbar ist (Basis-Schema oder früherer
  Eintrag) und keine Spalte doppelt angelegt wird — diese Fehlerklasse kann
  nicht mehr unbemerkt durchrutschen

---

## [1.7.1] — 2026-08-22 — KRITISCHER Fix: Nummernkreis-Reset bei jedem Start

### Fix (produktionskritisch)
- **Rechnungsnummern-Kreis wurde bei jedem App-Start auf 0 zurückgesetzt** —
  der Seed nutzte `onDuplicateKeyUpdate({ letzteNummer: 0 })` und lief bei
  jedem Boot. Nach jeder Aktivierung kollidierte die nächste Finalisierung mit
  bereits vergebenen Nummern (`ER_DUP_ENTRY` beim „Finalisieren & Nummer
  vergeben"). Jetzt: bestehende Zählerstände bleiben unangetastet (GoBD).
- **Selbstheilung beim Start**: der Rechnungskreis des laufenden Jahres wird
  automatisch auf mindestens die höchste real vergebene Nummer angehoben —
  Installationen, die der alte Bug schon zurückgesetzt hatte, reparieren sich
  beim nächsten Start selbst (kein SQL-Eingriff nötig)

---

## [1.7.0] — 2026-08-22 — Patientennummern-Kreis, Plan-Duplikat, Rezept-A5, Reihenfolge, Backup-Erinnerung

### Patientennummern fortlaufend geregelt (dringend gewünscht)
- **Automatischer Nummernkreis** beim Anlegen: Patientennummer-Feld leer lassen
  → die nächste freie Nummer wird kollisionssicher vergeben (Transaktion, keine
  Duplikate). Wer selbst eine Nummer einträgt, überschreibt die Automatik gezielt
- **Einstellungen → Patientennummern**: Startzahl frei wählbar; optional
  „mit Präfix" — Präfix ist frei einstellbar (z. B. P, IMTZ, Praxis2, Klinik …),
  Format dann `PRÄFIX-NUMMER` (z. B. `IMTZ-1001`). Live-Vorschau der nächsten
  Nummer (wird nicht verbraucht)

### Therapieplan duplizieren
- In der Plan-Liste neuer Knopf **„Duplizieren"**: Dialog mit Patienten-Wahl
  (beliebiger Zielpatient) und Zeitfenster (von/bis frei wählbar) — Einträge
  werden um das Datums-Delta verschoben, außerhalb des Fensters liegende
  entfallen (mit Zähler), Status startet bei „geplant". Danach landet man
  direkt im Editor der Kopie

### Rezept & Attest im Rezeptpapier-Look (A5 hochkant)
- **Neues A5-Format** für Privatrezepte und Atteste: klassische
  Rezeptblock-Anmutung — Medikamenten-Feld als leicht graue Box mit dem
  Arzt-/Praxisnamen **groß und dezent weiß im Hintergrund** (Wasserzeichen),
  Unterschrifts-Stempel aus den Einstellungen, „Privat verordnet"-Hinweis

### Reihenfolge im Tag (Therapieplan)
- Einträge lassen sich jetzt **manuell innerhalb eines Tages ordnen**: im
  Eintrag-Dialog die Buttons „▲ nach oben" / „▼ nach unten" (Tausch mit dem
  Nachbarn). Neue Einträge landen unten; die bisherige Anzeige-Reihenfolge
  wird bei der Migration exakt übernommen (nichts verändert sich ungewollt)

### Backup-Erinnerung
- **Dashboard-Banner**, wenn die letzte bestätigte Sicherung länger als 14 Tage
  her ist (oder nie bestätigt wurde) — mit dem konkreten Backup-Kommando für
  den Server und „Habe ich erledigt"-Bestätigung (danach ruht das Banner
  wieder 14 Tage)

### Technik
- 82 Tests grün (neu: Reihenfolge-Sortierung, Versions-Sync-Wache)

---

## [1.6.3] — 2026-08-22 — Land-Feld editierbar + Aktions-Buttons nach oben

### Fixes & UX
- **Land ist jetzt überall editierbar**: im Patientenformular (Stammdaten) und
  im Rechnungskopf „Empfänger & Belegdaten" — bisher stand fest „Deutschland"
  drin, was Auslandspatienten (z. B. Slowakei) unbelegbar machte
- **Aktions-Buttons des Entwurfs nach oben**: „Entwurf speichern" und
  „Finalisieren & Nummer vergeben" stehen jetzt prominent in der Kopfzeile der
  Rechnungsansicht (nicht mehr am Seitenende) — deutlich übersichtlicher,
  besonders für neue Anwender

---

## [1.6.2] — 2026-08-11 — Fix: Plan→Rechnung-Fallen (Teilwoche + Endstation)

### Fixes aus dem Praxis-Alltag
- **Teilwochen-Warnung**: Wenn beim „Rechnung erstellen" aus einem dokumentierten
  Plan noch Einträge ohne Status „stattgefunden" existieren, warnt das System
  jetzt mit Anzahl und Tagen — bewusst bestätigen (nur stattgefundenen Teil
  verrechnen) oder erst die Tage markieren. Vorher wurde still eine unvollständige
  Rechnung erzeugt
- **Kopf-Datum = Plan-Zeitraum**: Die Rechnung aus einem Plan zeigt jetzt oben
  den vollen Plan-Zeitraum (von–bis), nicht nur die Spanne der abgerechneten Tage
- **Entwurf löschen setzt den Plan zurück**: Wird ein aus einem Therapieplan
  erzeugter Rechnungsentwurf gelöscht, geht der Plan automatisch zurück auf
  „dokumentiert" (inkl. Chronik-Eintrag) und kann erneut abgerechnet/editiert
  werden — bisher blieb er unwiderruflich auf „abgerechnet" hängen
  (Feld `invoices.therapieplan_id` als Rückbezug)

---

## [1.6.1] — 2026-08-11 — Fix: Demo-Reset ohne Basis-Schema, schema.sql-Sync

### Fixes
- **demo-reset.sh**: Nach dem `DROP DATABASE` wird jetzt auch die
  `schema.sql` wieder eingespielt — das MySQL-Init läuft nur beim allerersten
  Volume-Start, ohne Reimport blieb die Demo-DB nach einem Reset leer
  (Login-Fehler `Table 'demopa.users' doesn't exist`, FK-Fehler in der
  Migration). Zusätzlich wartet der Reset jetzt vor dem Seed auf die Migration.
- **schema.sql ↔ migrate.ts synchronisiert**: Frische Installationen bekamen
  `invoices.typ/abschlag_betrag/proforma_von_id` und `suppliers.kategorie_id`
  bisher nur nachträglich per Migration — stehen jetzt direkt im Basis-Schema
  (Verifikation: automatischer Abgleich aller Migrations-Einträge = 0 Abweichungen)

---

## [1.6.0] — 2026-08-11 — Demo-Kit (demopa): Landingpage, XP-Desktop, Musterdaten-Seed

### Demo-Instanz vorbereitet
- **Seriöse Landingpage** unter `/demo/` (statisch): Login-Daten, Feature-
  Überblick, Reset-Hinweis, Links zur App, zum Retro-Modus und zu GitHub
- **Retro-Demo-PC** unter `/xp-desktop/` (aus ReWaWi portiert, komplett auf
  Dr.PaWaWi umgebrandet): Windows-XP-Illusion mit App-Iframe (gleiche Origin),
  Demo-Dateien-Ordner (XRechnung, SumUp-CSV, Scan-PDF, Kunden-CSV),
  dynamische Version aus `ping`
- **Demo-Seed** (`db/demoSeed.ts`, idempotent): Praxis-Stammdaten + age-Keys,
  Demo-Login (`demo` / `pawawi-demo`) + zwei Therapeuten mit Kalenderfarben,
  6 Muster-Patienten, dokumentierter Therapieplan (laufende Woche, gemischte
  Status), Protokoll-Vorlage + ausgefülltes Infusionsprotokoll mit
  Diagramm-Daten, Dr.-X-Musterbogen, finalisierte Rechnung, bezahlte Vorkasse
  + Schlussrechnung mit Depot-Abzug, Post-Manager-Beleg (OCR-Übungsstück),
  Kollege für den Austausch, Chronik-Einträge
- **Demo-Betrieb**: `demo/docker-compose.yml` (eigener Stack `demopa`, Port
  3202, eigene Volumes, bewusst ohne zweiten LibreTranslate-Container wegen
  RAM), `scripts/demo-reset.sh` (DB-Drop + Migration + Re-Seed + Uploads leeren,
  für täglichen Cron), `demo/README.md` mit kompletter Einrichtung inkl.
  dynv6-Zone, Caddy-Block und SupportHub-Registrierung (`produktVon: praxiswerk`,
  `behalten`-Liste)

---

## [1.5.0] — 2026-08-10 — ReWaWi-v1.7.0-Sync (Post Manager, Eingangsbelege, Company Control, Banking)

> Cherry-Pick-Sync aus ReWaWi v1.2.1–v1.7.0 nach Handover-Empfehlung.
> **Bewusst NICHT übernommen:** Zeiterfassung (kollidiert mit der
> Behandlungs-Abrechnungs-DNA) und XP-Desktop (eigene Demo folgt separat).

### SOP-Konformität & Pflicht-Fixes
- **`api/lib/version.ts`** (kanonische Version für den SupportHub), `ping`
  liefert sie mit; Sync version.ts ↔ package.json ↔ CHANGELOG wird per Test erzwungen
- **Migration gehärtet**: jeder Schritt isoliert (try/catch — ein Fehler
  blockiert nie die Kette), FK-Reihenfolge beachtet (bank_importe vor
  bank_transaktionen, company_kennwerte nach post_eingang)
- **Käufer-Parser** in der XRechnung-Einlesung (BuyerTradeParty + Adresse) —
  Grundlage für den Altbestand-Import ausgehender Belege

### Post Manager (ReWaWi v1.4/v1.6)
- **Massen-Upload**: ganze Scan-Stapel (bis 30 Dateien) mit Fortschritt,
  Typ-Vorwahl und Fehler-Banner (`anlegenBatch`)
- **Durchraster-Workflow**: Pfeil-Navigation im Dialog (x/y) +
  „Buchen & nächster" — Scan-Marathon ohne Mauswege
- **Neue Belegtypen** Lieferschein + Gutschrift (Enum-Migration idempotent)
- **Regelwerk**: Standard-Kategorie je Lieferant (Stammdaten) → Kategorie-/
  Konto-/USt-Vorschlag bei OCR und manueller Buchung
- Deeplink `/posteingang?beleg=ID` (für Company-Control-Verknüpfungen)

### Eingangsbelege-Zentrale (ReWaWi v1.5)
- Menüpunkt **„Eingangsbelege"** (statt „E-Rechnung"): Tabs Rechnungen/
  Lieferscheine/Gutschriften/Archiv, Summen-Chips (offen/überfällig/bezahlt),
  Suche, CSV-Export, Post-Manager-Archiv mit PDF-Viewer, Schnellwechsel-Links,
  Fehleranzeige statt leerer Liste bei Query-Fehlern

### Company Control (ReWaWi v1.6)
- Neuer Menüpunkt **„Unternehmen"**: registrierte Kennnummern (EORI,
  Betriebsnummer, BG-Mitgliedsnummer, IHK/HWK, Gläubiger-ID) +
  **freie Kennwerte** mit Beleg-Verknüpfung zum Post Manager
  (z. B. Praxisregistrierungen mit Nachweisdokument)

### Banking komplett (ReWaWi v1.3)
- **Persistente Transaktionen** (`bank_transaktionen` + `bank_importe`,
  Duplikat-Hash je Konto), Ein-/Ausgänge, Saldo-Verlauf, Import-Historie
- **Auto-Match** auf Ausgangs- UND Eingangsrechnungen, manuelle Zuordnung
  **bidirektional** inkl. Lösen mit Rückbuchung, Ignorieren/Löschen mit
  GoBD-Schutz, **Kontoauszug-PDF**
- **Bank-Zuordnung im Rechnungsdetail** (Vorschläge nach Restbetrag)
- **SumUp-Vollexport nativ** (15-Spalten-Format, deutsches Datum)
- Der alte Bank-CSV-Import ist darin aufgegangen (Menü „Bank" = neue Zentrale)

### Altbestand-Migration (ReWaWi v1.2.1/v1.3)
- **Altbestand-Import aus SumUp-Rechnungs-PDFs** (lokal per pdftotext:
  Positionen, Plausi-Warnungen, Storno-Ablehnung) und aus **XRechnungen**
  (ausgehende Belege mit Original-Nummern als finalisierte Belege) —
  Nummernkreis wird bei eigenem Format angehoben (kein ER_DUP_ENTRY danach)
- Magic Import erkennt SumUp-PDFs und Therapieplan-XLSX jetzt auch im
  Datei-Dialog (Accept + Routing ergänzt), Fehler-Banner und pro-Datei-
  Fehlerisolierung statt stillem Abbruch

### Komfort (ReWaWi v1.6)
- **Rechnungen-Seitenpanel**: Klick auf eine Zeile öffnet ein Panel mit
  Aktivitäts-Timeline (Entwurf → Finalisierung → Mail → Zahlung/Bank →
  Gutschriften) und Aktionen (Öffnen, PDF, Vorschau, **Duplizieren**,
  Gutschrift, **Archivieren**)
- **Archivieren** statt Löschen (`invoices.archiviert` + Filter, GoBD-sicher)
- **Sortierung** per Spaltenklick in Patienten-, Leistungen-, Lieferanten-
  und Gutschriften-Listen, Suche in Gutschriften/Eingangsbelegen
- Unternehmen-Seite: Hinweis statt ewigem „Lade …" bei fehlenden Firmendaten

### Technik
- **80 Tests grün** (inkl. Versions-Sync-Wache)

---

---

## [1.4.1] — 2026-08-04 — Fix Vorlagen-Speichern, frei modifizierbarer Vitalparameter-Block

### Fixes & Anpassungen
- **Fix: „Neue Vorlage" speichern schlug fehl** (`expected number, received NaN`):
  Die statische Route hat keinen URL-Parameter — das Frontend rechnete
  `Number(undefined)`. Jetzt werden neue Vorlagen korrekt ohne ID gespeichert
- **Vitalparameter-Block frei modifizierbar**: Überschriften aller Felder sind
  editierbar, Felder lassen sich hinzufügen/entfernen, und die Darstellung ist
  wählbar zwischen **2 oder 3 Spalten** nebeneinander (Überschrift + Kästchen
  darunter). Die bisherigen Standard-Felder (Zeitpunkt, RR, Puls, Temp, SpO₂)
  bleiben die Vorgabe beim Hinzufügen; Protokolle im Altformat werden beim
  Öffnen automatisch überführt
- **Versionsanzeige im Menü-Footer** kommt jetzt automatisch aus der
  package.json — sie kann nicht mehr veralten

---

## [1.4.0] — 2026-08-04 — Behandlungsprotokolle, Tablet-DnD (Versuch 2), Markiertes verschieben

### Behandlungsprotokolle (neuer Menüpunkt + Akten-Tab)
- **Block-Baukasten mit sechs Typen**: Textfeld (Titel + Freitext), **Tabelle**
  (Spaltenzahl und Spaltenköpfe frei, Zeilen beliebig; Konvention: erste Spalte
  = Zeit/Datum), **Skala 1–10**, **Foto/Dokument** (Upload direkt im Protokoll,
  landet als Dokument in der Akte), **Vitalparameter-Schnellzeile**
  (Zeitpunkt, RR sys/dia, Puls, Temperatur, SpO₂), **Ankreuz-Block**
  (Optionen mit Checkboxen). Blöcke frei sortierbar (hoch/runter)
- **Diagramm aus Tabellen**: optional unter der Tabelle — automatisch aus den
  Zahlenwerten erzeugt (X = erste Spalte, Y = alle Zahlen-Spalten je eine Linie,
  deutsches Zahlenformat verstehend, reines SVG ohne Zusatzbibliothek)
- **Volle Vorlagen-Verwaltung** (Tab „Vorlagen"): Vorlagen anlegen, bearbeiten,
  löschen; aus jeder Vorlage ein Protokoll starten; fertige Protokolle per Klick
  **„Als Vorlage speichern"** (Struktur wird übernommen, Inhalte entfernt)
- **48-h-Fenster**: Protokolle sind nach Anlage 48 Stunden editierbar und werden
  danach automatisch **gesperrt** (medizinische Dokumentation). Danach nur noch
  **Nachträge** (append-only, mit Zeit + Name); Löschen nur innerhalb des
  Fensters und mit Löschprotokoll-Eintrag
- Eigene Menü-Seite (Patient suchen → Protokolle + zuletzt bearbeitet) und
  Tab „Protokolle" in der Patientenakte

### Therapieplan: Tablet-Verschieben (Versuch 2)
- **Eigener Drag-Griff** (⠿) an jeder Leistungsblase — nur der Griff startet
  das Verschieben (`touch-action: none`): Text in der Blase bleibt markierbar,
  Wischen scrollt weiterhin die Seite. Touch-Sensor: 200 ms halten aktiviert,
  kurze Wisch-Gesten werden als Scrollen durchgereicht

### Therapieplan: Markierte Einträge verschieben
- Sammel-Leiste um **„Verschieben"** ergänzt: markierte Einträge wechseln per
  Zieldatum auf einen anderen Tag — Uhrzeit, Therapeut und Raum bleiben erhalten
  (bisher war nur Duplizieren möglich)

### Technik
- Neue Tests: Protokoll-Logik (48-h-Fenster, Vorlagen-Struktur, Zahlen-Parsing)
  — **76 Tests grün**

---

## [1.3.0] — 2026-08-03 — Rezepte & Atteste, Proforma/Vorkasse, Bogen-Import, Muster-Dr.-X

### Privat-Rezepte & Atteste (Prio 1/3 der Praxis-Taskliste)
- **Eigene Menü-Seite „Rezepte & Atteste"** (Gruppe Praxis): Patient suchen &
  aussuchen → direkt ins Rezept- oder Attest-Fenster; Liste der zuletzt
  erstellten Belege praxisweit zum Wiederaufnehmen. Derselbe Bereich liegt
  zusätzlich als Tab in der Patientenakte
- **Privatrezept** (mehrere Verordnungszeilen mit Stärke, Menge/Packung,
  Dosierung + Hinweis — **mit Vorschlägen aus der eigenen Produktliste** oder
  frei eingegeben), **Arbeitsunfähigkeitsbescheinigung** (Zeitraum von/bis
  einschließlich) und **freies Attest** — als sauberes A4-PDF mit Praxis-Kopf,
  „Rp."-Block und Unterschriftsbereich
- **Digitale Unterschrift**: In den Einstellungen kann ein Unterschriftsbild
  (PNG/JPG, z. B. mit dem Handy fotografiert) hinterlegt werden — es wird auf
  jedes Rezept/Attest gestempelt; ohne Bild erscheint die klassische
  Unterschriftszeile zum handschriftlichen Signieren
- PDFs landen automatisch als Dokument (Kategorie Rezept/Arztbrief) in der
  Akte + Timeline-Eintrag; Löschung nur mit Eintrag ins Löschprotokoll

### Proforma / Vorkasse + Therapiedepot
- **Proforma-Belege**: Beim Rechnungs-Neu-Dialog wählbar („Rechnung" /
  „Proforma / Vorkasse"). Proforma ist eine Zahlungsaufforderung **ohne
  GoBD-Belegnummer** (Nummernkreis bleibt unberührt), mit eigenem PDF-Titel
  „Proforma / Vorkasse"
- **Therapiedepot**: Zahlungseingänge auf die Vorkasse wie gewohnt verbuchen;
  per Klick auf **„In Rechnung umwandeln"** entsteht die Schlussrechnung als
  Entwurf — die gezahlte Vorkasse wird auf dem PDF automatisch abgezogen
  („Abzüglich Abschlagszahlung (Therapiedepot)") und die Restsumme ausgewiesen.
  Doppel-Verrechnung ist gesperrt; Storno/Lieferschein/X-Rechnung/Mahnwesen
  greifen bei Proforma bewusst nicht
- **Vorkasse im Entwurf anhängen** (Praxis-Workflow: Plan → Rechnung → Depot
  verrechnen): Im Rechnungsentwurf erscheint eine „Vorkasse / Therapiedepot"-
  Zeile mit allen offenen (finalisierten, noch nicht verrechneten) Vorkassen
  des Patienten — Auswahl genügt, der bezahlte Betrag wird sofort in den Summen
  und später auf dem PDF abgezogen; beim Finalisieren wird der Abschlag auf den
  aktuellen Zahlungsstand gezogen und gegen Doppel-Verknüpfung geprüft.
  Verknüpfung im Entwurf jederzeit lösbar; stornierte Rechnungen geben ihre
  Vorkasse wieder frei

### Anamnesebögen: Muster + verbesserter Importer
- **„Muster: Dr.-X-Bogen"**: Unser echter Praxis-Anamnesebogen (inkl. DSGVO-
  Einwilligung und IMTZ-Schweigepflichtsentbindung) liegt 1:1 digitalisiert als
  Muster vor — ein Klick legt ihn als bearbeitbaren Bogen an
- **Bogen-Importer (docx/pdf) gehärtet**: Ankreuz-Zeilen werden nie mehr als
  Bereichs-Titel fehlgedeutet, Fragen mit „?" nicht mehr als Titel, Skala-
  Fragen bleiben vollständig erhalten, Tabellen-Kopfzeilen
  („Organsystem / Bereich") werden verworfen, „Bitte kreuzen Sie…"-Anweisungen
  werden zuverlässig übersprungen, zwei getrennte Zeilen („Operationen" +
  „Ja / Nein") werden als eine Ja/Nein-Frage erkannt, der Kopfbogen-Hinweis
  entfernt alle Stammdaten-Blöcke (nicht nur den ersten)
- Router-Schema nimmt jetzt alle Block-Config-Felder entgegen (pflicht,
  notizFrage, text, checkboxLabel) — vorher gingen sie beim Speichern verloren

### Deployment & Secrets (SupportHub-kompatibel)
- **docker-compose.yml enthält keine Secret-Werte mehr** (Listen-Syntax:
  `- MYSQL_ROOT_PASSWORD` etc.) — alle Geheimnisse stehen ausschließlich in der
  `.env` (Compose liest sie automatisch; `.env.example` als Vorlage).
  Verhindert Fehlalarme von Secret-Scannern (z. B. PraxiOS SupportHub) und
  versehentlich committete Passwörter
- `scripts/backup.sh` liest das DB-Passwort jetzt selbst aus der Projekt-`.env`;
  SERVER-ANLEITUNG.md komplett auf den .env-Fluss umgestellt

### Technik
- Neue Tests: Rezept/Attest-PDF (inkl. Signatur-Stempel und defektes Bild),
  Dr.-X-Seed gegen Router-Schema, Bogen-Importer (7 Fälle) — **68 Tests grün**

---

## [1.2.0] — 2026-08-01 — ReWaWi-1.2-Port: Post Manager, OCR, Magic Import, Kontierung

### Neue Menüleiste (ReWaWi-1.2-Stil)
- **Gruppen-Sidebar** (Praxis / Abrechnung / Stammdaten + oben/unten), Gruppen
  einklappbar (gemerkt), Rechte-Filter blendet leere Gruppen aus; Logo-Stil
  „Dr.**PaWaWi**", Abmelde-Button unten im Rahmen, Icon-Leiste im Plan-Detail
  bleibt erhalten

### Post Manager + lokale OCR
- **Post Manager**: Eingang für gescannte Belege (PDF/JPG/PNG, unveränderbar in
  der DB, GoBD) — Formular (Absender, Rechnungsnummer, Betrag, Fälligkeit,
  Wiedervorlage, Konto/Gegenkonto, Kategorie), per Klick als Eingangsrechnung
  buchen (Duplikat-Prüfung), sonstige Dokumente mit Wiedervorlage ablegen
- **OCR-Vorschlag**: Belege lokal erkennen (**Tesseract + deutschem Sprachpaket
  im Docker-Image** — keine Cloud): Betrag, IBAN, Rechnungsnummer, Daten und
  Fälligkeit als Vorschlag mit Konfidenz, Absender-Match gegen Lieferanten

### Magic Import (eine Upload-Tür für alles)
- Neue Seite „Import" (Drag&Drop, bis 10 Dateien): XRechnung-XML und ZUGFeRD-PDF
  werden direkt gebucht, Scans gehen in den Post Manager, SumUp-CSVs werden
  erkannt und gelotst — **IMTZ-Therapieplan-XLSX wird erkannt und zum
  Therapie-Import gelotst**

### Zahlungsziele & Kontierung
- **Zahlungsziele**: offene Eingangsrechnungen + Post-Fristen + Wiedervorlagen
  (überfällig markiert) als Liste und Monatskalender; **ICS-Abo**
  (`/ics/zahlungsziele.ics?token=…`, Token neu erzeugbar)
- **Kontierung**: Kontenrahmen **SKR03 + SKR04** als Basisdaten (MIT-Dataset,
  beim Start vorbefüllt), **Kategorien** als Schnellauswahl mit Konto-Mapping
  (Verwaltung in Einstellungen → DATEV & Kontierung)
- **DATEV-Export Eingangsseite**: Eingangsrechnungen wandern in den
  Buchungsstapel (Soll Aufwandskonto an Kreditor, Vorsteuer-BU 9/8; Kreditor =
  Startnummer + Lieferanten-ID, sonst Sammelkonto; Felder Kreditor-Startnummer
  und Standard-Aufwandskonto in den Einstellungen)

### Technisch
- Dockerfile bringt `tesseract-ocr` (+ deu) und `poppler-utils` mit
- Neue Tabellen: post_eingang, kategorien, kontenrahmen, email_konten (für die
  kommende IMAP-Runde); Spalten incoming_invoices.konto/gegenkonto, settings
  ics_token/kreditor_startnummer/aufwandskonto_default

## [1.1.1] — 2026-07-28 — Terminerinnerungen + GOÄ lokal

- **Terminerinnerungen per E-Mail**: automatischer Versand an Patienten mit
  E-Mail-Adresse X Tage vor dem Termin (1–7 einstellbar, nur Status „geplant",
  genau einmal je Eintrag, Tabelle `termin_erinnerungen` als Duplikatschutz);
  Scheduler alle 30 min, manueller „Jetzt prüfen"-Test, SMTP aus den
  Einstellungen
- **GOÄ lokal (Praxis-Mapping)**: `goae_ziffer` + `goae_art`
  (direkt/analog „entspr."/§ 2) am Produkt; GOÄ-Bezug wandert automatisch in
  die Rechnungs-Beschreibung („Mo, 06.07.2026 · GOÄ 272"); Badge in der
  Produktliste, Datalist-Helfer im Formular
- **Kuratierte GOÄ-Basisbibliothek** (`db/goaeBibliothek.ts`, ~24 Einträge):
  eigenes Praxiswissen — Ziffern-Referenzen (Fakten aus der gemeinfreien
  Verordnung) mit eigenen Kurztexten und Analog-/Anwendungshinweisen aus der
  Abrechnungspraxis. Explizit KEIN amtlicher Katalogtext (Rechtskante beachtet)

## [1.1.0] — 2026-07-26 — Mehrsprachige Bögen, Papierkorb, Touch-DnD, Sidebar

### Mehrsprachige Anamnesebögen (on-premise)

- **Sprachwahl mit Flaggen** beim Öffnen des Links (de, en, tr, ar, ru, uk, sk);
  Bogen komplett in der Patientensprache (UI-Chrom handgepflegt + Inhalte
  maschinell übersetzt), inkl. RTL für Arabisch
- **LibreTranslate als Sidecar-Container** (nur intern, keine Daten nach
  außen); Übersetzungen persistent gecacht (`translation_cache`)
- **Einreichung doppelt**: Original in Patientensprache + deutsche
  Rückübersetzung (kategoriale Antworten deterministisch zurückgemappt,
  Freitext via MT); zwei PDFs in der Akte (Original + „DE-Übersetzung"),
  `sprache` + `datenDe` in der Einreichung

### Papierkorb für Therapiepläne

- Soft-Delete (`geloescht_am`) für geplant/aktiv/dokumentiert — **abgerechnet
  niemals** (GoBD); Filter „Gelöschte" in der Plan-Liste, **48 h
  Wiederherstellen**, danach endgültige Löschung (lazy purge, Kaskade)

### Interaktion & Komfort

- **Drag & Drop auf dnd-kit** (PointerSensor, 6 px Aktivierungsdistanz) —
  funktioniert jetzt auch auf **Tablet/Handy**, nicht nur Maus
- **Sidebar klappt im Plan-Detail automatisch** auf Icon-Leiste (Toggle
  PanelLeft oben; Mobile unverändert)
- Status-Popover an Eintrags-Karten **schließt nach Statuswahl von selbst**

## [1.0.0] — 2026-07-26 — Erstes öffentliches Release 🎉

**Dr.PaWaWi (PraxiOS) 1.0.0** — vereinigte Patientenakte, Therapiepläne,
Kalender und Abrechnung. Vollständig getestet (49/49 Unit-Tests), produktiv
im Einsatz.

### Großer WAWIPROS-1.0-Port (aus dem Main-System übernommen)

- **E-Mail-Versand (SMTP)**: Rechnungen/Gutschriften als PDF (+ XRechnung-XML)
  direkt aus dem Beleg versenden; Zugangsdaten verschlüsselt (AES-256-GCM,
  Key = APP_SECRET), Verbindungstest in den Einstellungen, Versandprotokoll
  (`mail_log`) je Beleg
- **Serien-Rechnungen**: wiederkehrende Vorlagen (aus bestehender Rechnung
  oder neu), Fälligkeits-Anzeige, Entwurf per Klick (GoBD: Nummer erst bei
  Finalisierung), Verwaltung im Dialog „Serien" in den Rechnungen
- **E-Rechnung-Empfang**: XRechnung-XML und ZUGFeRD-PDF analysieren, buchen,
  archivieren (Original-XML), Duplikatssperre, Zahlungsverfolgung
  (Seite „E-Rechnung")
- **Lager + Handy-Scan**: Bestand aus auditfesten Bewegungen (Zugang/Abgang/
  Korrektur/Inventur), Mindestbestand-Warnung, Barcode/PZN-Suche per
  Handy-Kamera (BarcodeDetector-API), Etiketten-Druck (Code128-PDF,
  50x30/60x40/70x50), Dubletten- & Preisvergleich

### Fixes & Härtung

- **PDF-Overlap gefixt**: lange Leistungsdaten (z. B. „…(KW 28/29)")
  überlappten die nächste Meta-Zeile — Zeilenhöhe wird jetzt gemessen
- `settings.update` jetzt admin-only (Verwaltung); SMTP-Passwort niemals im
  API-Response (nur „gesetzt"-Flag)
- Nav filtert Menüpunkte nach Gruppen-Rechten; Gruppen-Name in der Seitenleiste
- Restore-Test-Anleitung (jährliche Pflicht-Übung) und GoBD-
  Verfahrensdokumentation als ausfüllbare Vorlage im Repo

### Kumulativ seit 0.9.0 (Fusion)

Patientenakte mit Chronik/Dokumenten/Kontakten/Anamnese-Creator, Therapiepläne
mit Wochenraster (Drag&Drop, Serien, Tag-/Block-Duplikat/Verschieben,
Status-Klick, Markieren), Wochenkalender (patienten-gruppiert, ICS-Abo),
Therapie-Import (IMTZ + PraxisAkte-CSV), Plan→Rechnung direkt, GoBD-
Nummernkreis „RK nn JJJJ", Abschnitte GOÄ/§ 10, Konditionen, Duplikatschutz
Patient+KW, Unklarheiten-Report, Arzt-zu-Arzt-Austausch (age), Rollen-System,
DSGVO-Löschkonzept, Backup verschlüsselt.



Alle nennenswerten Änderungen. Schema: [Version] — Datum — Kurztitel.

## [0.9.8] — 2026-07-26 — PDF-Vorschau (handyfest) per pdf.js

- **Beleg-Vorschau** (aus Main-System inspiriert, richtig gelöst): „Vorschau“
  in Rechnungs- und Gutschriften-Detail — PDF wird per tRPC erzeugt und mit
  **pdf.js als Canvas** gerendert (Seiten-Navigation + Zoom), statt per iframe
- **Handy-Bug gefixt**: Mobile Browser zeigen in iframes keine PDFs an (nur
  Icon + „Öffnen“-Button). Die Vorschau in der Dokumentenablage nutzt jetzt
  ebenfalls pdf.js — funktioniert auf Handy und Desktop
- pdf.js-Worker wird lokal gebündelt (offline-fähig, kein CDN nötig)

## [0.9.7] — 2026-07-26 — Plan-Interaktion: Drag & Drop, Status-Klick, Markieren

- **Drag & Drop**: Einträge zwischen Tagen im Wochenraster ziehen (= Datum
  verschieben), Drop-Zonen mit Hervorhebung
- **Status-Punkt klickbar** (größer, obere linke Ecke der Karte): öffnet
  Status-Menü direkt an der Karte (geplant/stattgefunden/abgesagt/ausgefallen)
  — kein Dialog mehr für reine Statuswechsel
- **Löschen-Symbol** an der Karte (untere rechte Ecke, gespiegelt zu
  Duplizieren oben rechts) mit Bestätigung
- **Markieren-Checkbox** (untere linke Ecke, gespiegelt zu Löschen): bei
  Auswahl erscheint eine Aktionsleiste — **Block-Duplizieren** (selber Tag
  oder Zieldatum) und **Block-Löschen** mit Bestätigung (Backend: `plaene.bulk`)

## [0.9.6] — 2026-07-26 — Rollen, Kalender-Gruppierung, Mehrbenutzer, ICS

- **Rollen-System**: „Leitung/Arzt" (= admin, alles + Verwaltung), dazu Gruppen
  mit Bereichs-Rechten (Checkboxen): Akte, Pläne, Dokumente, Kalender, Anamnese,
  Austausch, Abrechnung. Standard-Gruppen „Med. Personal" und „Kaufm. Personal"
  (Auto-Seed), eigene Gruppen im Gruppen-Editor anlegbar; Zuordnung inline in
  der Benutzerverwaltung; serverseitig pro Router abgesichert (rechtQuery)
- Sicherheitsfix: `auth.me` liefert kein passwordHash mehr aus; Rechte werden
  aufgelöst mitgeliefert (für UI-Filter)
- **Kalender**: Tageseinträge jetzt **patienten-gruppiert** (Name + Zeitspanne
  aus frühesten/spätesten Zeiten + Anzahl-Badge), aufklappbar → dezente
  Therapie-Karten darunter
- **ICS-Feed** `/api/ics/<token>.ics` (RFC 5545): Google/Outlook-Abo,
  2 Wochen zurück bis 12 Wochen voraus, Status-Mapping, Token jederzeit
  neu erzeugbar („Abonnieren" im Kalender-Kopf)
- **Mehrbenutzer**: Plan-Detail lädt alle 15 s automatisch nach +
  manueller „Aktualisieren"-Button (zwei Zugänge, ein Plan)
- **Tag-Übertrag**: neben „Kopieren" jetzt auch **„Verschieben"**
  (Tag wird auf Zieldatum umgelegt statt dupliziert)
- Tests: 45/45 grün (Kalender-Gruppierung, ICS-Format/Faltung/Status)

## [0.9.5] — 2026-07-26 — Plan → Rechnung direkt + Duplizieren

- **„Rechnung erstellen" im Therapieplan** (Status dokumentiert): erzeugt den
  Rechnungsentwurf direkt aus den stattgefundenen Einträgen — ohne CSV-Umweg.
  Geteilte Engine (`api/abrechnung.ts`): Katalog-Auflösung (ID direkt oder
  Namens-Matching inkl. Aliase/Mengen-Umstellung), Preis (Kondition > EK § 10 /
  VK GOÄ), Abschnitte, Wochen-Duplikatschutz (Patient+KW), Plan wird auf
  „abgerechnet" gesetzt, Chronik-Eintrag; nicht zuordenbare Einträge werden
  als Liste zurückgemeldet (im Entwurf ergänzbar)
- **Einträge duplizieren** (einzeln, Kopie-Button am Eintrag) und
  **Tag duplizieren** (alle Einträge eines Tages auf Zieldatum — für
  wiederkehrende Mischungen/Abläufe; Kopien starten als „geplant")
- **Sortierung gefixt**: Einträge ohne Uhrzeit sprangen an manchen Tagen nach
  oben — jetzt überall: Uhrzeit zuerst, dann ohne, neue Einträge immer unten
  (Plan-Detail und Wochenkalender)
- CSV-Export: verständliche Fehlermeldung statt leerer Datei, wenn keine
  Einträge mit Status „stattgefunden" markiert sind
- Tests: 38/38 grün (Sortier-Helfer)

## [0.9.4] — 2026-07-26 — Arzt-zu-Arzt-Austausch (age) + Combobox-Fix

- **Akten-Pakete verschlüsselt an Kollegen-Praxen** (`age-encryption`, BSD):
  Inhalt Stammdaten, Kontakte, Therapiepläne + Einträge, Dokumente (mit Dateien),
  Chronik; Format `praxios-akte` v1 (zod-validiert)
- **Einverständnis-Gating (Art. 9 DSGVO)**: Export erst mit unterschriebenem
  Einverständnis in der Akte; **Einverständnis-PDF-Generator** (Praxisdaten +
  Patient + Empfänger + Zweck + Signatur) im Austausch-Tab der Akte
- **Export-Protokoll** (akten_exporte: wann, an wen, Umfang, durch wen)
- **Import** mit Vorschau: entschlüsseln → Zusammenfassung → Patienten-Matching
  (Pat.-Nr. > Name > Name+DOB), Lücken ergänzen ohne Überschreiben, Dedupe bei
  Kontakten/Plänen/Dokumenten, Leistungen/Therapeuten per Katalog-Mapping
- **Kollegen-Verwaltung** (Empfänger-Schlüssel age1…, aktiv/inaktiv) und
  **eigener Schlüssel** (Erzeugen, Kopieren, Neu-Generieren mit Warnung) im
  neuen Menüpunkt „Austausch"; geheimer Schlüssel verlässt den Server nie
  (in settings.get gestrippt)
- Nebenbefund-Fix: Akzentfarbe „petrol" in der Einstellungs-Validierung
- Combobox-Breitenfix (PopoverAnchor statt Trigger-Button)
- Tests: 35/35 grün (Paket-Schema, age-Roundtrip inkl. Fremdschlüssel-Negativ)

## [0.9.3] — 2026-07-26 — UX & Branding Dr.PaWaWi

- **Rebranding auf Dr.PaWaWi** (Menü-Titel, Login, Manifest); Fußzeile im Menü
  zeigt „Dr.PaWaWi v<Version> · PraxiOS" (Version aus `src/const.ts`)
- **Leistungs-Auswahl als Combobox** (Therapieplan-Eintrag): Tippen filtert
  Katalog-Vorschläge (gruppiert GOÄ/§ 10), Chevron klappt die Liste auf,
  „Freitext: …" bei Nicht-Katalog-Leistungen — kein Scrollen mehr nötig
- **Ankreuz-Fragen als Zellen-Editor** (Bogen-Editor): erst Spaltenwahl (1/2),
  dann Titel, dann Fragen als Eingabe-Zellen im passenden Raster; Navigation
  per Pfeiltasten, Enter legt neue Zelle an, Backspace auf leerer Zelle löscht,
  leere Zellen werden beim Speichern entfernt; Umbrüche macht das Layout
  automatisch (angepasst an die Spalten)
- Archive werden vor dem Packen auf Registry-URLs geprüft (Mirror-Fix bleibt)
- Tests: 32/32 grün (inkl. Zellen-Navigation)

## [0.9.2] — 2026-07-26 — Anamnesebögen (Fragebogen-Creator)

- **Bogen-Editor mit Block-Katalog**: fünf Blocktypen (Ankreuz-Fragen 1/2-spaltig,
  Textfeld, Textfeld mit Schreibfeld, Skala 1–10, Häufigkeitsskala
  „gar nicht / wenig / normal / häufig / sehr häufig“); Blöcke optional im
  Katalog wiederverwendbar; Kopfbogen „Persönliche Daten“ fix (Pflichtfelder
  für saubere Akte/Rechnung)
- **Magic-Links** (72 h Token, ohne Login) **+ QR-Code** (Data-URL/PNG)
- **Öffentliche Ausfüll-Seite** `/bogen/:token`: Vorbefüllung bei bekannten
  Patienten, Pflicht-Stammdaten, Datenschutz-Checkbox, getippte Unterschrift
- **Einreichung**: Patienten-Zuordnung (Link > Name+DOB-Match > Neuanlage,
  nur Lücken ergänzen), ausgefüllter Bogen als PDF in der Akte
  (Dokument-Kategorie „Anamnesebogen“, Enum erweitert), Timeline-Eintrag
- **Leerer Bogen als PDF** zum Drucken/Verschicken
- Neue Tabellen: anamnesis_blocks/forms/links/submissions (+migrate/schema.sql)
- 8 neue Tests (Patientenzuordnung, PDF-Render-Smoke) — gesamt 29/29 grün

## [0.9.1] — 2026-07-24 — Formalien & Branding

- Rebranding der Oberfläche auf **PraxiOS** (technische Namen — Docker-Projekt,
  Datenbank, Volumes — bleiben aus Kontinuitätsgründen `praxiswerk`)
- Rechnungs-/Gutschriften-PDF: bei vollständig steuerfreien Positionen (0 % USt)
  automatisch der Hinweis „…nach § 4 Nr. 14 Buchstabe a UStG von der
  Umsatzsteuer befreit" (GoBD-/Formalia-Pflicht für Heilbehandlungen)
- Dockerfile auf `node:24-slim` vereinheitlicht
- `scripts/backup.sh`: verschlüsseltes Backup (mysqldump + dokumente-Volume,
  gpg AES256) inkl. Cron-Beispiel
- Versionierung + dieses Changelog eingeführt

## [0.9.0] — 2026-07-24 — Erste Release-Phase

- **Fusion** von PraxisAkte (Akte, Pläne, Kalender, Dokumente, Timeline,
  Löschkonzept) und Dr.ReWaWi (Therapieplan-Import IMTZ/PraxisAkte-CSV,
  Rechnungen GOÄ/§ 10, RK-Nummernkreis, PDF, Konditionen, Bank/DATEV/XRechnung)
  zu **einer App**: Kunde = Patient, Rechnungen-Tab in der Akte,
  Dashboard Praxis + Abrechnung, Patienten-Nr. UNIQUE,
  GoBD-Guard im Löschkonzept
- Leistungskatalog (79 Einträge, Preisliste EK&VK 2026) als Auto-Seed
- 21/21 Unit-Tests (Parser, PraxisAkte-CSV, ISO-8601-KW)
