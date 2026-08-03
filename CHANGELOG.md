# Changelog — PraxiOS

## [1.3.0] — 2026-08-03 — Rezepte & Atteste, Proforma/Vorkasse, Bogen-Import, Muster-Dr.-X

### Privat-Rezepte & Atteste (Prio 1/3 der Praxis-Taskliste)
- **Neuer Tab „Rezepte & Atteste"** in der Patientenakte: **Privatrezept**
  (mehrere Verordnungszeilen mit Stärke, Menge/Packung, Dosierung + Hinweis),
  **Arbeitsunfähigkeitsbescheinigung** (Zeitraum von/bis einschließlich) und
  **freies Attest** — als sauberes A4-PDF mit Praxis-Kopf, „Rp."-Block und
  Unterschriftsbereich
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
