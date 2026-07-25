# Changelog — PraxiOS

Alle nennenswerten Änderungen. Schema: [Version] — Datum — Kurztitel.

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
