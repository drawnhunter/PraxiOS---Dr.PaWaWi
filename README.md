# Dr.ReWaWi — Rechnungswesen Kühnel

**Fork von [WAWIPROS](https://example.invalid) — zugeschnitten auf genau einen
Workflow: die wöchentliche Abrechnung der IMTZ-Therapiepläne durch Dr. Kühnel.**

## Kern-Workflow

1. **IMTZ** dokumentiert die Therapiewochen in der Excel-Vorlage
   (ein Blatt pro Kalenderwoche, z. B. `KW28`, bis zu 3 Patientenblöcke,
   bis zu 5 Behandlungstage mit Menge/Leistung je Tag).
2. **Dr. Kühnel** lädt die Datei auf der Startseite hoch, wählt die
   abzurechnenden Wochen und prüft die Vorschau.
3. Dr.ReWaWi erstellt **pro Patient eine Rechnung (Entwurf)** über alle gewählten
   Wochen — Positionen gruppiert in
   **1. Ärztliche Leistungen (GOÄ, VK)** und **2. Auslagen § 10 GOÄ (EK)**.
4. **Unklarheiten** (unbekannte Leistung, fehlende Adresse, unsichere
   „(?)“-Angaben, Duplikate) erzeugen einen **Report als PDF/TXT** mit
   Fundstellen (Sheet + Excel-Zeile), der an IMTZ zurückgeht.
5. Nach Klärung werden die Entwürfe ergänzt und per Klick finalisiert
   (GoBD-Nummernkreis: `RK 01 2026`, `RK 02 2026`, …).

## Regeln im Detail

- **Leistungskatalog** (Menü „Leistungen“): jede Leistung hat Kategorie
  (GOÄ-Leistung mit VK / Auslage § 10 mit EK), optional **Import-Namen**
  für abweichende Schreibweisen im Therapieplan (eine pro Zeile).
- **Patientenstamm** (Menü „Patienten“): Matching per Name (exakt, sonst
  Nachname); Unbekannte werden angelegt und landen als Unklarheit im Report
  (Adresse/Geburtsdatum nachpflegen).
- **„Erledigt“-Häkchen** in der Vorlage werden ignoriert — jede Zeile mit
  Menge + Name zählt als erbrachte Leistung.
- **Duplikatsschutz**: pro Patient und KW nur eine Rechnung; bereits
  berechnete Wochen werden übersprungen und im Report benannt.
- Heilbehandlungen: **0 % USt** (§ 4 Nr. 14a UStG) — USt-Standard im Katalog.

## Betrieb

Stack: React 19 + TS + Vite + Tailwind/shadcn, Hono + tRPC + Drizzle +
MySQL 8, Docker. Selbst-Migration beim Start zieht fehlende Spalten nach.

```bash
docker compose up --build        # App auf Port 3100 (neben WAWIPROS lauffähig)
```

- Lokaler Start ohne Docker: siehe [LOKAL-STARTEN.md](LOKAL-STARTEN.md)
- Server/Caddy/Backup/Update: siehe [SERVER-ANLEITUNG.md](SERVER-ANLEITUNG.md)
  (dort `wawipros` durch `rewaki` und Port `3100` ersetzen)

## Wichtige Abweichungen vom WAWIPROS-Stand

- Startseite = **Therapieplan-Import** (statt Dashboard)
- Nummernformat Rechnungen: **`RK <lfd.> <Jahr>`**
- `products`: + `kategorie` (leistung/auslage), + `import_namen`
- `customers`: + `geburtsdatum`, + `patienten_nr`
- Neu: `invoice_therapie_wochen` (Duplikatsschutz), `therapy_imports`
  (Import-Protokoll inkl. Report-Nachdownload)
- Menü verschlankt (Import, Rechnungen, Gutschriften, Bank, Patienten,
  Leistungen, Einstellungen) — übrige Module bleiben per URL erreichbar
