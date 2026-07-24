# FUSION: PraxisWerk (ReWaDo) — Merge-Dokumentation

**PraxisWerk ist die vereinigte App aus PraxisAkte (v1.1) und Dr.ReWaWi.**
Dieses Dokument beschreibt, wie die beiden Codebasen verschmolzen wurden
(Referenz für künftige Updates aus den Ursprungs-Entwicklungslinien).

## Ausgangslage

- **Basis: Dr.ReWaWi** (Rechnungs-Engine, Therapieplan-Import, PDF, Bank,
  Konditionen, GoBD-Nummernkreis „RK nn JJJJ")
- **Hineinportiert: PraxisAkte** (Patientenakte, Therapiepläne, Wochenkalender,
  Dokumentenablage, Timeline, Serien, Ausfallquote, Löschkonzept,
  Therapeuten-Farben)

## Zentrale Merge-Entscheidung: Kunde = Patient

PraxisAkte hatte eine eigene `patients`-Tabelle (nachname/vorname getrennt),
Dr.ReWaWi nutzt `customers` (Name „Nachname, Vorname" als ein Feld;
Rechnungen/Konditionen referenzieren sie). **Vereinigt auf `customers`** —
erweitert um die Akte-Felder:

- `customers` **+** `krankenkasse`, `versichertennummer`,
  `aerztlicher_ansprechpartner`, `tags` (und aus Dr.ReWaWi bereits:
  `geburtsdatum`, `patienten_nr` — jetzt mit UNIQUE-Index)
- Alle Akte-Tabellen referenzieren `customers.id`:
  `patient_contacts`, `therapy_plans`, `plan_entries`, `documents`,
  `timeline_events` (+ `loeschprotokoll` ohne FK)
- `users` **+** `kalenderFarbe` (Therapeuten-Farben)
- `products`: Dr.ReWaWi-Stand (kategorie ENUM leistung/auslage + import_namen);
  Labels über `KATEGORIE_LABEL` in `contracts/constants.ts`
  (PraxisAkte speicherte die Label-Strings direkt — vereinheitlicht auf Enum)
- GoBD-Guard im Löschkonzept: Patient mit Rechnungen → CONFLICT (archivieren),
  sonst transaktionale Löschung inkl. `invoice_therapie_wochen`-Freigabe

## Portierte Module (PraxisAkte → PraxisWerk)

| Modul | Anpassung |
|---|---|
| `api/planRouter.ts` | `patients`→`customers`; CSV-Export splittet Name in Nachname/Vorname; Kategorie-Enum→Label |
| `api/calendarRouter.ts` | Join auf `customers`, Name aus einem Feld |
| `api/documentRouter.ts` | unverändert |
| `api/boot.ts` | Upload/Download-Endpunkte (`/api/dokumente`), `UPLOAD_DIR` |
| `api/customerRouter.ts` | **+** Kontakte, Notiz, Ausfallquote, `loeschen` (Admin, GoBD-Guard), Tag-Filter, `get` mit Kontakte+Timeline; patientenNr-CONFLICT |
| `api/auth-router.ts` | **+** `therapeuten` (öffentliche Therapeutenliste), `benutzerFarbe`, kalenderFarbe in `benutzer`/`benutzerAnlegen` |
| `api/dashboardRouter.ts` | **+** `heute`, `uebersicht` (neben den Rechnungs-Stats) |
| `api/lib/kalender.ts`, `timeline.ts` | unverändert übernommen |
| `contracts/constants.ts` | **+** `DR_REWAWI_CSV_*`, `KATEGORIE_LABEL`, `DOKUMENT_KATEGORIEN`, `PLAN_STATUS`, `ENTRY_STATUS` |
| `db/seed.ts` | **+** `seedLeistungskatalog()` (79 Einträge mit Preisen/Aliasen aus `db/leistungskatalog.ts`, idempotent bei leerem Katalog) |
| Frontend | `pages/Kalender`, `Plans`, `PlanDetail`, `Patients`, `PatientDetail` (**+ Rechnungen-Tab**), `components/PatientForm` (vereinigt: Akte + Abrechnungsfelder + Konditionen), `TimelineList`, `KontakteSection`, `DokumentenAblage`, `SerienAssistent`, `Benutzerverwaltung` (Farben), `Dashboard` (Praxis + Abrechnung) |
| `api/router.ts` | **+** `plaene`, `kalender`, `dokumente`; `leistungen` als Alias auf `products` |

## Router-Vertrag (Akte, Kurzform)

`customers`: list({suche?, tag?, inklArchivierte?}) · get (mit kontakte+timeline) ·
create/update (CONFLICT bei doppelter patientenNr) · setArchiviert ·
loeschen (admin, GoBD-Guard) · addKontakt/updateKontakt/removeKontakt ·
addNotiz · ausfallquote
`plaene`: list · byId (entries mit leistung + therapeut ohne Hash) ·
create/update · setStatus · addEntry/updateEntry/removeEntry ·
serieAnlegen · dokumentieren · exportDrReWaWi
`kalender`: woche({jahr, kw}) · `dashboard`: stats · recentPaid · heute · uebersicht
`dokumente`: list · byId · update · loeschen (Upload/Download via Hono, nicht tRPC)
`leistungen` = `products` (Alias)

## Datenbank

Neue Spalten: `customers.{krankenkasse, versichertennummer,
aerztlicher_ansprechpartner, tags}`, `users.kalenderFarbe`,
UNIQUE `customers_patienten_nr_unique`.
Neue Tabellen: `patient_contacts`, `therapy_plans`, `plan_entries`,
`documents`, `timeline_events`, `loeschprotokoll`.
Alles in `schema.sql` (Frischinstallation) + `api/migrate.ts` (Bestands-DBs,
idempotent).

## Qualitätsstand

`tsc -b` fehlerfrei · 21/21 vitest-Tests grün (13 Dr.ReWaWi-Import/Parser +
8 ISO-8601-KW aus PraxisAkte) · Produktions-Build ok.

## Deployment-Notiz

Frische Installation (keine Datenmigration — Stand „nur Testdaten" in beiden
Vorgänger-Systemen). Compose: `name: praxiswerk`, DB `praxiswerk`, Port
`3100:3000`, Volume `dokumente` (Uploads). Bestehende Caddy-Blöcke können auf
die vereinigte App zeigen; die alten Instanzen (rewaki, praxisakte) können
nach Abnahme abgeschaltet werden.
