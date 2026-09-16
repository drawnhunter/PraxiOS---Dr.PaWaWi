# Dr.PaWaWi Agent-API — Leitfaden (Stand v1.14.0)

REST-API für externe Agenten (Kimi Claw). Basis: `https://<host>/api/agent`
Auth: `Authorization: Bearer ax_…` (Token aus Einstellungen → Agent-API, Klartext nur einmalig).
Fehler: `{"ok": false, "fehler": "Klartext"}` mit HTTP-Status 400/401/403/404/409/502.

## DSGVO-Modell (Gesundheitsdaten — strenger als ReWaWi)

**Pseudonymisierung an der API-Grenze** (Standard: an, Einstellungen → Agent-API):
Patienten erscheinen als `P-0001` + Jahrgang + Ort. Klarnamen, volle Adressen,
E-Mails, Telefonnummern und Geburtsdaten bleiben im System. **PDF-Inhalte
(Rezepte, Atteste, Befunde) verlassen den Server grundsätzlich nicht.**

Hinweis: Pseudonymisierte Daten bleiben personenbezogene Daten. Zum vollständigen
Bild gehören AVV mit dem KI-Anbieter und VVT-Eintrag „KI-Agent".

## Autonomie-Stufen (Einstellungen → Agent-API)
- `vorschlag` (Standard): Lesen + Entwürfe/Aufgaben/Anlagen — Freigabe immer beim Menschen
- `vollautomatik`: zusätzlich Direktversand (Rechnungen per Mail)
- **Granulare Freigabe pro Token** (ab 1.14): Token-Feld `freigabeEmpfaenger` (JSON-Array mit Adressen oder `@domain`) erlaubt Direktversand an genau diese Empfänger auch in Stufe `vorschlag`

## Transparenz & Vertrauen (ab 1.14)
- `GET /audit-log?von=&bis=&aktion=&limit=` → jede Agent-Aktion mit Zeitstempel
- **Idempotenz**: Header `Idempotenz-Key: <beliebig>` bei POSTs → Retry liefert die gespeicherte Antwort (`x-idempotent-replay: 1`), nichts dupliziert
- **Webhooks**: `POST /webhooks {ereignis: "bankbuchung.neu", url}` · `GET /webhooks` · `DELETE /webhooks/:id` (5 s Timeout, Fehlerzähler; `mail.neu` folgt mit dem Mail-Modul)
- `GET /uebersicht/heute` → Morgen-Briefing in einem Call: heutige Termine, überfällige Rechnungen, offene Bankbuchungen ohne Zuordnung, offene Aufgaben
- `GET /zahlungsziele?von=&bis=` → fällige Ausgangs-/Eingangsrechnungen + Mahnfristen mit `ueberfaellig`-Flag

## Erweiterungen Bestand (ab 1.14)
- Kunden-Suite: `GET /kunde/:id` · `PUT /kunde/:id` · `GET /kunde/nach-email/:email` · `GET /kunde/:id/rechnungen`
- Rechnungen: `GET /rechnung/:id/pdf` (GoBD-PDF als base64) · `POST /rechnung/:id/zahlung {betrag?, datum?}` · `POST /rechnung/:id/stornieren` (GoBD-Vollstorno mit Gutschrift)
- Aufgaben: `faelligAm`, `prioritaet` (niedrig/normal/hoch), `referenz` `{art: "rechnung"|"beleg"|"patient"|"plan", id}`

## Status
- `GET /status` → `{produkt, version, zeit}`

## Patienten (ab 1.13.0)
- `GET /patienten?q=&limit=` → Liste (pseudonymisiert; q = Namenssuche serverseitig)
- `GET /patient/nach-name/:name` → bis zu 5 Kandidaten (fuzzy, `{id, pseudonym, jahrgang, ort, score}`)
- `GET /patient/:id` → Detail (pseudonymisiert)
- `POST /patient` → Quick-Add `{name* („Nachname, Vorname“), geburtsdatum? (JJJJ-MM-TT), strasse?, plz?, ort?, email?, telefon?, krankenkasse?}` — **Dubletten-Prüfung** (Name + Geburtsdatum → 409 mit `vorhanden.id`) · Patientennummer aus dem Nummernkreis · Synonym P-#### automatisch

## Therapiepläne (ab 1.13.0)
- `GET /therapieplaene?patientId=&status=` → Liste (ohne Papierkorb)
- `GET /therapieplan/:id` → Plan mit allen Einträgen
- `POST /therapieplan-entwurf` → Plan als **„geplant"** anlegen (Praxis aktiviert):
  ```json
  {
    "patientId": 42,              // oder "patient": "Name" (fuzzy)
    "titel": "Therapieplan KW 40–42",
    "vonDatum": "2026-10-05",
    "bisDatum": "2026-10-23",
    "diagnoseZiele": "…",
    "eintraege": [
      { "datum": "2026-10-05", "zeitVon": "09:00", "leistungText": "Vitamin C 7,5 g", "menge": "1" },
      { "datum": "2026-10-05", "leistungId": 123 }
    ]
  }
  ```
  Validierung: 1–500 Einträge, Datum im Zeitraum, `leistungId` muss im Katalog
  existieren (`GET /leistungskatalog`), `leistungText` wird aus dem Katalog
  ergänzt, wenn nur `leistungId` gegeben. Reihenfolge je Tag = Übergabereihenfolge.

## Termine / Kalender (ab 1.13.0)
- `GET /termine?von=&bis=&patientId=` → Plan-Einträge im Zeitraum (JJJJ-MM-TT)

## Rezepte & Atteste (ab 1.13.0 — nur Metadaten)
- `GET /rezepte?patientId=` → `[{id, typ, erstelltAm, patient}]` — **keine Inhalte** (Gesundheitsdaten bleiben lokal)

## Rechnungen & Finanzen (aus ReWaWi-Sync, Kunden = Patienten)
- `GET /offene-rechnungen` · `GET /entwuerfe` · `GET /rechnung/:id` · `GET /kunden-ohne-rechnung?tage=`
- `GET /mahnungen` · `POST /mahnung {rechnungId, stufe?}` · `DELETE /entwurf/:id` (nur Entwürfe, GoBD)
- `POST /rechnung-entwurf {kundenId|kunde, items:[{bezeichnung, menge?, einzelpreis, ustSatz?}], pdfNotiz?}`
- `POST /rechnung/:id/versenden` → **vollautomatik** erforderlich
- `GET /kunden` · `POST /kunde` (Quick-Add; für Patienten besser `POST /patient` nutzen!)
- `GET /leistungskatalog`

## Banking
- `GET /kontostand` · `GET /bankbuchungen?tage=` · `GET /bankbuchung/:id`
- `GET /zahlungsabgleich` (Auto-Match-Vorschläge)
- `POST /bankbuchung/:id/zuordnen {rechnungId|nummer|eingangsrechnungId}` · `POST /bankbuchung/:id/loesen` (Reversal)
- `GET /import-status`

## Aufgabenliste (Wiedervorlage)
- `GET /aufgaben` · `POST /aufgaben {text*}` · `POST /aufgaben/:id/erledigt`

## Stolpersteine (FAQ)
- **Windows-curl**: einfache Anführungszeichen um JSON funktionieren in cmd.exe **nicht** — doppelte + Escape (`\"`) oder `--data @body.json`. Auf Linux/Mac ist `'…'` korrekt.
- **Patient vs. Kunde**: PaWaWi-Kunden SIND Patienten. Für die Akte immer `POST /patient` (Dubletten-Prüfung + Patientennummer) — `POST /kunde` ist das generische ReWaWi-Erbe ohne diese Prüfungen.
- **Pläne aktivieren**: Der Agent legt Therapiepläne bewusst nur als „geplant" an. Aktivierung/Dokumentation erfolgt durch die Praxis (medizinische Hoheit).
- **Jede Aktion nachvollziehbar**: `agent_log` (sichtbar in Einstellungen → Agent-API).
