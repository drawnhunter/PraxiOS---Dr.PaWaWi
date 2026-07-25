# Changelog — PraxiOS

Alle nennenswerten Änderungen. Schema: [Version] — Datum — Kurztitel.

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
