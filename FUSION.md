# FUSION: Dr.ReWaWi → ePA (Integrations-Manifest)

**Dr.ReWaWi** ist ein Fork von WAWIPROS (React 19 + TS + Vite + Tailwind/shadcn,
Hono + tRPC 11 + Drizzle + MySQL 8, Docker), zugeschnitten auf die
Therapieplan-Abrechnung von Dr. Kühnel. Dieses Dokument listet das komplette
Delta zur WAWIPROS-Basis, damit der Code in die ePA-Patientenakte überführt
werden kann.

Kern-Workflow: IMTZ-Therapieplan (XLSX/CSV, Block-Layout) importieren →
1 Rechnung (Entwurf) pro Patient über alle gewählten Kalenderwochen →
Positionen gruppiert in „1. Ärztliche Leistungen (GOÄ, VK)" und
„2. Auslagen § 10 GOÄ (EK)" → Unklarheiten-Report (PDF/TXT) mit Fundstellen
(Sheet + Excel-Zeile) zur Rückfrage an IMTZ.

---

## 1. Neue Dateien (1:1 übernehmen)

| Datei | Zweck |
|---|---|
| `api/therapyPlan.ts` | Parser für das IMTZ-Block-Layout (KW-Blätter, Patientenblöcke, 5 Tage-Spalten, Patientendaten v2, KW-Plausicheck, Zeilen-Fundstellen). Enthält die geteilten Normalisierungs-Funktionen (`normBasis`, `normKompakt`, `normMenge`) und `isoKalenderwoche`. |
| `api/therapyImportRouter.ts` | tRPC-Router `therapyImport`: `blaetter`, `vorschau`, `importieren`, `historie`, `report`. Katalog-/Patienten-Matching, Konditionen-Preise, Duplikatsschutz (Patient+KW), Erzeugung der Entwürfe inkl. Abschnitts-Zeilen, Import-Protokoll. |
| `api/therapyReport.ts` | Unklarheiten-Report als TXT + PDF (pdfkit, DejaVu-Fonts aus `api/assets/fonts`). |
| `api/therapyPlan.test.ts` | 11 Vitest-Tests (Block-Layout, v1+v2, Serien-Daten, CSV, KW-Check, Matching-Norms, Report). |
| `contracts/therapy.ts` | Geteilte Typen (`Unklarheit`, `ImportPosition`, `PatientInfo`, `PatientVorschau`, `AnalyseErgebnis`, `ImportErgebnis`, `SheetInfo`, `ImportProtokoll`) + Abschnitts-Konstanten. |
| `src/pages/TherapyImport.tsx` | Startseite: Upload → KW-Auswahl → Vorschau (Patientenkarten mit Badges) → Import → Report-Download + Import-Verlauf. |
| `leistungskatalog.csv` | 79 Leistungen (9 GOÄ VK / 70 Auslagen EK+VK) mit Import-Aliasen — per CSV-Import (Leistungen) ladbar. |
| `patienten-vorlage.csv` | Patienten-CSV-Vorlage (Einzelspalten inkl. Geburtsdatum, Patienten-Nr.). |

## 2. Geänderte Dateien (Diffs nachziehen)

| Datei | Änderung |
|---|---|
| `api/router.ts` | `therapyImport: therapyImportRouter` registriert. |
| `db/schema.ts` | `products`: + `kategorie` ENUM('leistung','auslage') DEFAULT 'leistung', + `import_namen` TEXT. `customers`: + `geburtsdatum` DATE, + `patienten_nr` VARCHAR(50). **Neue Tabellen:** `invoice_therapie_wochen` (UNIQUE customer_id+jahr+kw — Duplikatsschutz), `therapy_imports` (Import-Protokoll/JSON). |
| `api/migrate.ts` | Dieselben Spalten/Tabellen als idempotente Nachrüstung für Bestands-DBs (NEUE_SPALTEN/NEUE_TABELLEN). |
| `schema.sql` | Vollständiges Schema inkl. aller neuen Spalten/Tabellen (frische Installationen). |
| `api/invoiceRouter.ts` | `delete` gibt beim Löschen von Entwürfen die Therapiewochen frei (`invoice_therapie_wochen`-Zeilen mitlöschen). |
| `api/queries/invoicing.ts` | `formatInvoiceNumber` → `RK <lfd. 2stellig> <Jahr>` (z. B. „RK 06 2026"). |
| `api/pdf.ts` | Positions-Rendering: Zeilen mit Menge 0 **und** Preis 0 werden als fette Abschnitts-Zwischenüberschrift über die volle Breite gezeichnet (keine Pos.-Nr., keine Zahlen); laufende Positionsnummerierung zählt Abschnittszeilen nicht mit. |
| `api/importRouter.ts` | Produkte-CSV: + Spalten `Kategorie` (GOÄ/Auslage § 10), `EK netto`, `Import-Namen`; USt-Default 0. Kunden-CSV: + Einzelspalten `Straße/PLZ/Ort` (Vorrang vor „Adresse"), `Geburtsdatum`, `Patienten-Nr.`, `Zahlungsziel (Tage)`. |
| `api/productRouter.ts` | `productInput`: + `kategorie` (enum), + `importNamen` (nullable). |
| `api/customerRouter.ts` | `customerInput`: + `geburtsdatum` (ISO, nullable), + `patientenNr` (nullable). |
| `src/App.tsx` | Route `/` = `TherapyImport` (Startseite); Dashboard auf `/uebersicht`. |
| `src/components/Layout.tsx` | Navigation verschlankt (Therapie-Import, Rechnungen, Gutschriften, Bank, Patienten, Leistungen, Einstellungen); Branding „Dr.ReWaWi". |
| `src/pages/Products.tsx` | Felder Kategorie (GOÄ/§ 10) + Import-Namen; USt-Default 0 %; §-10-Badge. |
| `src/pages/Customers.tsx` | Felder Geburtsdatum + Patienten-Nr.; UI „Patienten". |
| `index.html`, `public/manifest.webmanifest`, `src/pages/Login.tsx` | Branding Dr.ReWaWi. |
| `docker-compose.yml` | Projektname/DB `rewaki`, Port-Mapping `3100:3000` (neben WAWIPROS lauffähig). |
| `Dockerfile` | Basisimage `node:24-slim` (npm 11; npm 10 aus node:22-slim bricht den Build ab). |
| `package.json` | Name `dr-rewawi`; **Dependency `xlsx` (SheetJS) neu** — serverseitiges XLSX-Parsing. |

## 3. Datenbank-Delta (SQL, falls die ePA-DB gemergt wird)

```sql
ALTER TABLE products ADD COLUMN kategorie ENUM('leistung','auslage') NOT NULL DEFAULT 'leistung' AFTER ek_preis_netto;
ALTER TABLE products ADD COLUMN import_namen TEXT NULL AFTER kategorie;
ALTER TABLE customers ADD COLUMN geburtsdatum DATE NULL AFTER telefon;
ALTER TABLE customers ADD COLUMN patienten_nr VARCHAR(50) NULL AFTER geburtsdatum;

CREATE TABLE IF NOT EXISTS invoice_therapie_wochen (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  jahr INT NOT NULL,
  kw INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX therapie_woche_eindeutig (customer_id, jahr, kw),
  INDEX therapie_woche_invoice_idx (invoice_id)
);

CREATE TABLE IF NOT EXISTS therapy_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dateiname VARCHAR(255) NOT NULL,
  jahr INT NOT NULL,
  sheets TEXT NOT NULL,    -- JSON: string[]
  ergebnis TEXT NOT NULL,  -- JSON: ImportErgebnis
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 4. Fachliche Festlegungen (Domain-Logik, beim Merge beachten)

- **„Erledigt"-Häkchen der Vorlage werden ignoriert** — jede Zeile mit Menge + Name zählt als erbrachte Leistung.
- **Gruppierung:** 1 Rechnung (immer Entwurf) pro Patient über alle beim Import gewählten KW-Blätter. Finalisierung manuell nach Prüfung (GoBD: erst dann Nummer aus dem Kreis „RK nn JJJJ").
- **Preise:** Kategorie `leistung` → `preis_netto` (VK/GOÄ); Kategorie `auslage` → `ek_preis_netto` (Selbstkosten § 10). **Patienten-Konditionen haben Vorrang** vor beiden. USt-Standard 0 % (§ 4 Nr. 14a UStG).
- **Matching Leistungen:** normalisiert (Kleinschreibung, Leerzeichen, Komma/Punkt) + Mengen-Umstellung (`600mg Clindamycin` ≙ `Clindamycin 600 mg`) + Aliasliste `products.import_namen` (eine pro Zeile). `(?)`-Markierungen → Unklarheit.
- **Matching Patienten:** exakter Name (norm.), sonst eindeutiger Nachname (mit Abweichungs-Unklarheit), sonst Neuanlage — mit allen Patientendaten aus der Vorlage (v2); fehlende Stamm-Felder werden aus der Vorlage ergänzt (nie überschrieben). Abweichender Rechnungsempfänger → Unklarheit.
- **Duplikatsschutz:** `invoice_therapie_wochen` sperrt Patient+KW auch für Entwürfe; Löschen des Entwurfs gibt die Woche frei. Betroffene Patienten werden komplett übersprungen (keine Teil-Rechnungen).
- **KW-Plausicheck:** Datum außerhalb der Blatt-KW (Tippfehler, z. B. 01.10 statt 01.01) → Unklarheit.
- **Unklarheiten-Report:** enthält je Punkt Sheet + Excel-Zeile + Patient; als PDF/TXT; jederzeit über `therapyImport.report` erneut ladbar (Protokoll in `therapy_imports`).

## 5. Build & Betrieb

- Build: `npm install && npm run build` (Vite + esbuild-Bundle `api/boot.ts` → `dist/boot.js`); Tests: `npm run test`; Typcheck: `npm run check`.
- Docker: App + MySQL 8 via `docker-compose.yml` (DB-Init aus `schema.sql`, Selbst-Migration beim Start via `api/migrate.ts`).
- Ersteinrichtung im Browser (Wizard: Admin + Firmendaten), danach Leistungskatalog (`leistungskatalog.csv`) und Patienten (`patienten-vorlage.csv`) per CSV-Import laden.
