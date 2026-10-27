# Dr.PaWaWi Agent-API — Leitfaden (kanonisch)

**Für externe Agenten (Kimi Claw u. a.).** Diese Datei ist die Referenz —
gelesen werden muss sie **vor** dem ersten Auftrag. Stand: **v1.29.0**.

**Pflicht-Regel (alex' Auftrag #182):** Diese Datei wird **bei jedem Release
mitgepflegt** — jede neue/geänderte Route landet hier UND als Versionshinweis
im Bus. Bei Abweichung Doku ↔ Verhalten gilt das Verhalten — und das ist ein
Bug zum Melden.

---

## 1. Einstieg — erst prüfen, dann handeln

```bash
GET /api/agent/status
Authorization: Bearer ax_…
```

Antwort: `{ ok: true, produkt: "pawawi", version: "1.29.0", autonomie: "vorschlag" }`.
**Immer zuerst aufrufen** — die Versionsangabe sagt dir, welche Endpunkte
verfügbar sind (diese Doku = v1.29.0). Gibt die Instanz eine ältere Version,
gelten nicht alle Endpunkte dieser Liste.

## 2. Authentifizierung

- Header: `Authorization: Bearer ax_…` (RFC 6750 — nicht `X-Agent-Token`)
- Token wird in der Instanz angelegt (Einstellungen → Agent-API), Klartext nur
  einmalig sichtbar; serverseitig sha256-gehasht
- **Autonomie-Stufen** (Einstellungen → Agent-API): `vorschlag` (Standard —
  Schreib-Endpunkte legen Entwürfe an, Versand ist gesperrt) ↔ `vollautomatik`
  (Versand erlaubt). Feinsteuerung je Token: `freigabe_empfaenger`
  (Adressen/@domains, die auch in `vorschlag` direkt versandt werden dürfen)
- Jede Schreibaktion landet im `agent_log` (sichtbar per `GET /audit-log`)
- Jede Lektion der App = siehe Abschnitt „Wenn etwas fehlt" (unten)

## 3. Antwort-Konventionen (Envelope) — **lies das zuerst, wenn etwas „ins Leere greift"**

Es gibt **kein Wrapper-Objekt**. Die Regeln sind fest:

| Fall | HTTP | Body |
|---|---|---|
| Erfolg (Liste) | 200 | `{ anzahl: N, <schlüssel>: [...] }` |
| Erfolg (Aktion/Anlage) | 200 | `{ ok: true, id: …, … }` |
| Fehler (Validierung/Zustand) | 400 / 404 / 409 | `{ fehler: "menschlich lesbarer Grund" }` |
| Fehler (Auth) | 401 | `{ fehler: "Bearer-Token fehlt …" / "Token ungültig oder deaktiviert." }` |

**Konsequenzen für den Agenten:**
- **HTTP-Status zuerst lesen.** Bei ≠ 200 gibt es kein `ok`-Feld, sondern `fehler`.
- Listen haben IMMER `anzahl` + einen Schlüssel (z. B. `rechnungen`, `produkte`,
  `eintraege`). Der Schlüssel steht in der Tabelle unten je Endpunkt.
- Roh-JSON ist die Wahrheit — keine `data`-/`result`-Hülle, keine Meta-Blöcke.

## 4. Idempotenz & Wiederholung

Bei jedem **POST** den Header `Idempotenz-Key: <eindeutig>` mitschicken
(z. B. `uuid`). Ein Retry nach Timeout liefert die gespeicherte Antwort mit
`x-idempotent-replay: 1` — **nichts dupliziert**. Ohne Key bei Retry kann
doppeltes Anlegen passieren.

## 5. Pseudonymisierung (DSGVO, Gesundheitsdaten)

Listen zeigen standardmäßig **P-Nummern** (`P-0001`) statt Klarnamen,
wenn in den Einstellungen die Pseudonymisierung aktiv ist (Standard: an).
E-Mail-Adressen kommen domänen-maskiert. **Klartext nur dort, wo es der
Auftrag braucht** (z. B. PDF-Erzeugung für den konkreten Patienten). Bank-
Gegenstellen: bekannte Partner als Synonym, unbekannte maskiert.

## 6. Endpunkt-Katalog (v1.29.0)

Basis-Pfad: `/api/agent`. Alle Listen sind gekürzt auf 100–200 Einträge.

### Status & Übersicht
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/status` | Produkt, Version, Autonomie-Stufe |
| GET | `/uebersicht/heute` | Morgen-Briefing (Termine, offene Rechnungen, offene Bankbuchungen, Aufgaben) |
| GET | `/audit-log` | Vollständige Agent-Aktionshistorie (`?von=&bis=&aktion=`) |
| GET | `/zahlungsziele` | Fällige Aus-/Eingangsrechnungen + Mahnfristen (mit Überfällig-Flag) |

### Patienten (Gesundheitsdaten — streng)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/patienten` | Liste (Pseudonyme) |
| GET | `/patient/nach-name/:name` | Suche (fuzzy) |
| GET | `/patient/:id` | Detail |
| POST | `/patient` | Anlegen (Dubletten-Prüfung Name+Geburtsdatum, 409 bei Treffer) |
| PUT | `/kunde/:id` | Stammdaten ändern |
| POST | `/patient/:id/dokumente` | **Batch-Upload** (≤25 Dateien; `{dateien:[{dateiname,base64,kategorie?,dokumentdatum?,notiz?}], ocr?}` → je Datei `{id, extraktionsStatus}`) |
| GET | `/patient/:id/dokumente` | Dokumente der Akte (mit Extraktions-Status) |
| GET | `/dokument/:id/text` | Text eines Dokuments — **jetzt auch DOCX** (mammoth, 1.27.0) — OCR on-demand, dauerhaft abgelegt |
| GET | `/dokument/:id/datei` | **Raw-Download** (1.27.0): `{ok, dateiname, mime, groesse, base64}` |

### Therapiepläne
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/therapieplaene` | Liste (`?patientId=`, `?status=`) |
| GET | `/therapieplan/:id` | Plan + Einträge lesen |
| GET | `/therapieplan/:id/pdf` | **Patienten-PDF** (1.29.0): Tageskarten mit farbigen Status-Badges; `{ok, dateiname, base64, mime}` |
| GET | `/therapieplan/:id/xlsx` | **Excel-Rohdaten** (1.29.0): Blatt „Plan“ (Metadaten) + „Einträge“ (alle Einträge, echte Excel-Datumswerte); `{ok, dateiname, base64, mime}` |
| POST | `/therapieplan` (= `/therapieplan-entwurf`) | Plan anlegen `{patientId, titel, vonDatum, bisDatum, eintraege[]}` |
| POST | `/therapieplan/:id/eintraege` | Einträge füllen — `{eintraege:[…]}`, Einzel-Felder **oder rohes Array** `[{…}]` (1.24.0) |
| PUT | `/therapieplan/:id/eintraege/:eintragId` | Eintrag ändern (stattgefundene Einträge sind gesperrt) |
| DELETE | `/therapieplan/:id/eintraege/:eintragId` | Eintrag löschen (ebenfalls nur geplante) |

### Leistungen / Produkte (Katalog)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/leistungen` (= `/leistungskatalog`) | Katalog (`?q=`), {leistungId, name, preis, ustSatz, kategorie} |
| GET | `/produkte` | Sortiment + EK/VK + Lagerbestand + Mindestbestand (`?q=`) |
| GET | `/waren` | Alias (schlank) |
| GET | `/warengruppen` | Kategorien |
| POST | `/produkte` (≡ `/leistungen`) | Produkt anlegen (Dubletten-Schutz per Name → 409) |
| PUT/PATCH | `/produkt/:id` (≡ `/leistungen/:id`) | Produkt ändern (beide Methoden, beide Pfade) |
| DELETE | `/produkt/:id` (≡ `/leistungen/:id`) | GoBD-sicher: deaktiviert statt gelöscht, wenn referenziert |

### Rechnungen / Vorkasse / Gutschriften
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/rechnungen` | Liste (`?patientId=&q=&von=&bis=&status=`) |
| GET | `/rechnung/:id` (≡ `/rechnungen/:id`) | Detail inkl. Positionen |
| GET | `/rechnung/:id/pdf` | GoBD-PDF (base64); seit 1.28.2 auch Entwürfe mit komplettem Layout + ENTWURF-Wasserzeichen |
| GET | `/offene-rechnungen` | Offen/überfällig |
| GET | `/kunden-ohne-rechnung` | Kunden ohne Rechnung seit X |
| POST | `/rechnung-entwurf` (= `/rechnungen`) | Entwurf `{kundenId\|kunde, items[], typ?, behandlungszeitraum?, pdfNotiz?}` |
| POST | `/rechnung/:id/finalisieren` | Finalisieren (Proforma bekommt keine Nummer) |
| POST | `/rechnung/:id/zahlung` | Zahlung buchen `{betrag?, datum?}` |
| POST | `/rechnung/:id/vorkasse-setzen` | `{proformaId\|null}` — Abschlag verrechnen/ablösen |
| POST | `/rechnung/:id/in-rechnung-umwandeln` | Proforma → Schlussrechnung |
| POST | `/rechnung/:id/gutschrift` | `{betrag?, grund}` — weglassen = Vollstorno (GoBD); kleiner = Teilgutschrift-Entwurf |
| POST | `/rechnung/:id/stornieren` | Vollstorno (Legacy-Alias) |
| POST | `/rechnung-aus-plan` | **Entwurf aus Therapieplan** (1.24.0): `{therapieplanId, grundlage?}` — grundlage `stattgefunden` (Standard) / `alle` (Vorschau ganze Woche) |
| DELETE | `/rechnung/:id` (≡ `/rechnungen/:id`) | **Entwurf löschen** (1.24.1, nur Status entwurf; sonst 409 → Storno) |
| POST | `/rechnung/:id/versenden` | Versand (Vollautomatik-Gate / Freigabeliste) |
| GET | `/entwuerfe` / DELETE `/entwurf/:id` | Entwürfe lesen/löschen |
| GET/POST | `/mahnungen`, `/mahnung` | Mahnwesen lesen/versenden |
| GET | `/zahlungsabgleich` | Offene Bank-Zuordnungen |

### Banking
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/bankbuchungen` | Liste (`?q=&von=&bis=&betragMin=&betragMax=&kontoId=`) |
| GET | `/bankbuchung/:id` | Detail |
| POST | `/bankbuchung/:id/zuordnen` | Zuordnung (mit Reversal) |
| POST | `/bankbuchung/:id/loesen` | Zuordnung auflösen |
| GET | `/kontostand` | Salden je Konto (bankAccountId explizit) |
| GET | `/import-status` | Import-Status |

### Kostenpläne / HKP (1.25.0+)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/kostenplaene` | Liste (`?patientId=`) |
| GET | `/kostenplan/:id` | Detail (Diagnosen, Begründung, Positionen) |
| POST | `/kostenplan` | Anlegen `{patientId\|patient, titel?, zeitraumVon/Bis?, diagnosen[]?, begruendung?, klartextNote?, positionen[{bezeichnung, einzelpreis, menge?, einheit?, ustSatz?, gruppe?, goaeText?, leistungId?}]}` |
| PUT | `/kostenplan/:id` | Ändern (nur Entwurf) |
| POST | `/kostenplan/:id/finalisieren` | Finalisieren → HKP-Nummer + PDF in Akte |
| POST | `/kostenplan/:id/duplizieren` | Als Vorlage kopieren (neuer Entwurf) |
| DELETE | `/kostenplan/:id` | Löschen (nur Entwurf) |
| GET | `/kostenplan/:id/pdf` · `/docx` | Ausgabe (base64) |

### Rezepte & Dokumente (Formulare)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/rezepte` | Rezepte + hochgeladene Rezept-Dateien (quelle: rezept/dokument-upload) |
| POST | `/rezept` | Privatrezept erzeugen `{patientId\|patient, positionen[{name,staerke?,menge?,dosierung?,pzn?}], notiz?}` → A5-PDF mit Signatur |
| POST | `/rezept/:id/qes-signieren` | **QES-Auftrag an Sproof** (1.28.0) `{apothekeEmail?, notiz?}` → Signatur-Link/Sign-ID; Sproof-Zugang nötig |
| GET | `/rezept/:id/qes-status` | Signaturstatus beim Anbieter + lokalen Ablauf lesen |
| POST | `/rezept/:id/qes-fertigstellen` | Signiertes PDF in der Akte ablegen; optional `{anApothekeSenden:true, betreff?, text?}` per Mail versenden (Versand-Gate beachten) |

### Mail
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/mails` | Liste (`?q=&ordner=&von=&bis=`) |
| GET | `/mail/:id` | Lesen; `GET /mail/:id/anhang/:index[/text]` Anhänge |
| POST | `/mail/entwurf` | Entwurf (KI macht vor, Mensch sendet ab) |
| GET | `/mail-entwuerfe` / DELETE `/mail-entwurf/:id` / POST `/mail-entwurf/:id/senden` | Entwürfe verwalten/senden |
| POST | `/mail/versenden` | Direktversand (Vollautomatik/Freigabeliste) |
| POST | `/mail/:id/als-entwurf` | Weiterleitung mit Anhang-Übernahme |
| POST | `/mail/:id/als-beleg` | Mail/Anhang als Eingangsbeleg |
| POST | `/mail/:id/gelesen` · `/markierung` · `/verschieben` | Status (IMAP-Move) |
| POST | `/mails/sync` | Gezielter Sync `{kontoId?, ordner?}` |
| GET | `/mail-ordner` · GET `/versand-log` | Ordner / Versand-Protokoll |

### Kontakte, Aufgaben, Kalender
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/kontakte` | Suche (`?q=` Name/E-Mail/Firma) |
| GET/POST | `/aufgaben` | Aufgaben lesen/anlegen (`faelligAm`, `prioritaet`, `referenz`) |
| POST | `/aufgaben/:id/erledigt` | Erledigen |
| GET | `/termine` | Praxis-Kalender (`?von=&bis=&patientId=`) |

### Praxis-Einstellungen (1.28.2)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/einstellungen` (≡ `/firma`) | Öffentliche Praxis-/Rechnungsdaten lesen; **keine Secrets** |
| PUT | `/einstellungen` (≡ `/firma`) | Gewhitelistete Felder ändern, z. B. `{fussText, oeffentlicheUrl, rechnungsPrefix}` → `{ok, geaendert:[…]}` |

SMTP-Passwörter, Sproof-Token und andere Zugangsdaten werden weder gelesen noch
über diese Route verändert. Unbekannte Felder werden ignoriert; mindestens ein
bekanntes Feld ist Pflicht.

### Webhooks
| Methode | Pfad | Zweck |
|---|---|---|
| GET/POST/DELETE | `/webhooks` | `bankbuchung.neu` feuert beim Bankimport |

## 7. Fehlerkatalog

| HTTP | Bedeutung | Aktion des Agenten |
|---|---|---|
| 401 | Token fehlt/ungültig/deaktiviert | Token prüfen; **nie** weiterreichen, melden |
| 400 | Validierung (Feld fehlt/Format) | `fehler`-Text lesen, Eingabe korrigieren |
| 404 | Objekt nicht gefunden ODER Endpunkt fehlt (1.24.0: **JSON statt leerem Body** — `{fehler, hinweis: Guide}`) | ID prüfen; bei Endpunkt: Doku prüfen (Aliase beachten!) |
| 409 | Konflikt/Zustand (Duplikat, GoBD-Regel, Doppel-Verrechnung) | Text lesen — enthält die Lösung; nicht wiederholen |
| 412 | Fachliche Vorbedingung fehlt (z. B. keine Praxisdaten für den Plan-Export) | `fehler` lesen, Voraussetzung ergänzen, danach erneut versuchen |
| 429 | Rate-Limit | Backoff + Retry mit Idempotenz-Key |

## 8. Wenn etwas fehlt — der Meldeweg (verbindlich)

**Nicht raten, nicht improvisieren.** Reihenfolge:

1. Diese Doku prüfen (inkl. Aliase — siehe Katalog).
2. Prüfen, ob die Instanz aktuell ist (`GET /status` → Version).
3. Fehlt die Funktion wirklich → **präzise Anforderung auf dem Bus** stellen
   (Label `inbox-pawawi`), mit dem Muster:

   ```text
   Endpunkt: POST /therapieplan/:id/eintraege/:eintragId/verschieben
   Payload: { neuesDatum: "JJJJ-MM-TT" }
   Erwartete Antwort: { ok: true, eintragId, datum }
   Use-Case: Agent verschiebt Infusion auf nächsten Tag bei Ausfall
   ```

   Kurz, konkret, mit Nutzen — das wird gebaut.
4. Bei Fehlverhalten eines **vorhandenen** Endpunkts: Bug-Meldung mit
   Request/Response-Rohdaten.

## 9. Beispiele (cURL)

```bash
# 1. Status
curl -s "$BASE/api/agent/status" -H "Authorization: Bearer $TOKEN"

# 2. Plan-Eintrag füllen (idempotent)
curl -s -X POST "$BASE/api/agent/therapieplan/2/eintraege" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotenz-Key: plan2-2026-10-08-hyperthermie" \
  -d '{"datum":"2026-10-08","leistungText":"Hyperthermie","menge":"1","zeitVon":"10:00"}'

# 3. Proforma-Vorschuss
curl -s -X POST "$BASE/api/agent/rechnung-entwurf" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"kundenId":4000005,"typ":"proforma","behandlungszeitraum":"05.10.–09.10.2026","items":[{"bezeichnung":"Vorschuss Therapie KW41","einzelpreis":"4000","ustSatz":0}]}'
```

---
*Diese Datei ist die kanonische Referenz. Bei Abweichung Doku ↔ Verhalten
gilt das Verhalten der aktuellen Version — und das ist ein Bug zum Melden.*
