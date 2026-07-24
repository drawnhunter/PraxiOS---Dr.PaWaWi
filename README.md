# PraxisWerk — ReWaDo

**Die vereinigte Praxis-Software: Patientenakte, Therapiepläne, Kalender und
Abrechnung in einer App.** Entstanden aus der Fusion von **PraxisAkte** (Akte,
Pläne, Kalender, Dokumente) und **Dr.ReWaWi** (Therapieplan-Abrechnung,
Rechnungen, GOÄ/§-10-Engine) — beides Forks von WAWIPROS (React 19 + TS + Vite
+ Tailwind/shadcn, Hono + tRPC 11 + Drizzle + MySQL 8, Docker, PWA).

## Was die App kann

### Akte (aus PraxisAkte)
- **Patientenakte** pro Person: Stammdaten (Name „Nachname, Vorname",
  Geburtsdatum, Adresse, Kontakt, Krankenkasse, Versichertennummer, ärztl.
  Ansprechpartner, Tags), Kontaktpersonen (inkl. Flag „abweichender
  Rechnungsempfänger"), Chronik (Timeline), Dokumentenablage (Upload auch vom
  Handy), Ausfallquote, DSGVO-Löschkonzept (pseudonymisiertes Protokoll,
  GoBD-Guard: Patienten mit Rechnungen werden archiviert statt gelöscht)
- **Therapiepläne** mit Wochenraster (Mo–Fr, wie die IMTZ-Excel): Einträge mit
  Leistung (Katalog/Freitext), Menge, Therapeut (mit Farbe), Raum, Zeiten,
  Status (geplant/stattgefunden/abgesagt/ausgefallen); Serien-Assistent
  (Wochentage × N Wochen); Statusfluss geplant → aktiv → dokumentiert →
  abgerechnet
- **Wochenkalender** Mo–Fr mit Therapeuten-Farben
- **Dashboard**: heutige Termine, Praxis-Kennzahlen + Abrechnungs-Kennzahlen

### Abrechnung (aus Dr.ReWaWi)
- **Therapie-Import** (Menü „Abrechnung"): IMTZ-Excel (Block-Layout, v2 mit
  Patientendaten) **oder** PraxisWerk/PraxisAkte-CSV-Export → 1 Rechnung
  (Entwurf) pro Patient über alle gewählten Wochen; Katalog-Matching mit
  Aliasen + Mengen-Umstellung; KW-Plausicheck; Duplikatsschutz (Patient+KW);
  Unklarheiten-Report (PDF/TXT) mit Fundstellen
- **Rechnungen**: Entwurf → Finalisierung (GoBD-Kreis „RK nn JJJJ"),
  Abschnitte „1. Ärztliche Leistungen (GOÄ, VK)" / „2. Auslagen § 10 (EK)",
  Konditionen je Patient, Teilzahlungen, Storno/Gutschriften, PDF
- **Leistungskatalog**: 79 Einträge (Preisliste EK&VK 2026) werden beim ersten
  Start automatisch geseedet; Preise/Aliase im UI pflegbar
- Bank, Bankimport, DATEV, XRechnung (aus WAWIPROS, per URL erreichbar)

### Eine Datenbasis
**Kunde = Patient** (eine Tabelle): Rechnungen, Konditionen, Pläne, Dokumente,
Kontakte und Chronik hängen an derselben Person. Patientendaten aus dem
Therapieplan-Import ergänzen Stamm-Lücken (nie überschreibend); Patienten-Nr.
ist der starke Abgleichschlüssel (unique).

## Betrieb

```bash
docker compose up --build   # App auf Port 3100, MySQL 8 + dokumente-Volume
```

Beim ersten Start: DB aus `schema.sql`, Selbst-Migration, **Seed des
Leistungskatalogs (79 Einträge)** und der Nummernkreise. Danach im Browser:
Ersteinrichtung (Admin + Praxisdaten) → Benutzer mit Kalenderfarben anlegen →
Bankkonto (Standard) → CSV-Import der Patienten (`patienten-vorlage.csv`) oder
direkt losdokumentieren.

Env: `DATABASE_URL`, `APP_SECRET` (Pflicht, `openssl rand -hex 32`), `PORT`,
`UPLOAD_DIR` (Default `./dokumente`; im Compose als Volume `/app/dokumente`),
`LOCAL_AUTH_BYPASS` (**nur lokal**).

## Rollen

- **Praxisleitung = admin**: Benutzerverwaltung (+Farben), Einstellungen,
  Löschungen (DSGVO-Protokoll)
- **Therapeut = user**: Pläne, Termine, Dokumente, Patienten, Abrechnung

## DSGVO-Hinweis

On-Premise; Patientendaten (Art. 9) verlassen das Haus nicht. Keine
TI/ePA-Anbindung (kein §-291-SGB-V-System). Löschkonzept Art. 17 mit
pseudonymisiertem Protokoll; Rechnungsdaten unterliegen der GoBD
(Aufbewahrung i. d. R. 10 Jahre). **Backups verschlüsselt** (mysqldump +
dokumente-Volume via gpg — Skript siehe SERVER-ANLEITUNG.md).

## Herkunft / Merge

Merge-Stand siehe `FUSION.md`. CSV-Brücke PraxisWerk ↔ Dr.ReWaWi-Instanzen:
`contracts/constants.ts` (`DR_REWAWI_CSV_SPALTEN`, 17 Spalten) — bei
Änderungen beidseitig abstimmen.
