# Changelog — PraxiOS

Alle nennenswerten Änderungen. Schema: [Version] — Datum — Kurztitel.

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
