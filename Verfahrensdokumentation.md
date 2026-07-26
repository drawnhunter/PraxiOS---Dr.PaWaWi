# Verfahrensdokumentation (GoBD) — Dr.PaWaWi (PraxiOS)

> **Hinweis:** Dieses Dokument beschreibt die technischen Verfahrensweisen von
> Dr.PaWaWi (PraxiOS) für die Abrechnung. Ergänze die mit `[...]` markierten
> Stellen, unterschreibe und bewahre das Dokument revisionsfest auf.
> Es ersetzt keine steuerliche Beratung.

**Betreiber:** `[Dr. med. Ralf-Uwe Kühnel, IMTZ GmbH, Gaußstraße 51, 14480 Potsdam]`
**Gültig ab:** `[Datum]` · **Software-Version:** Dr.PaWaWi 1.0.0 (PraxiOS)
**Erstellt am:** `[Datum]` · **Unterschrift:** `__________________`

---

## 1. Zweck und Geltungsbereich

Diese Verfahrensdokumentation beschreibt, wie mit **Dr.PaWaWi** steuerlich
relevante Belege (Ausgangsrechnungen, Gutschriften, Eingangsrechnungen,
Zahlungseingänge) erfasst, verarbeitet, gespeichert und aufbewahrt werden —
gemäß GoBD. Patientenbezogene Gesundheitsdaten (Akte, Therapiepläne, Dokumente)
sind Gegenstand separater Dokumente zum Datenschutz.

## 2. Systembeschreibung

- **Software:** Dr.PaWaWi 1.0.0 (PraxiOS), selbst gehostet (Fork von WAWIPROS)
- **Betriebsumgebung:** Ubuntu-Server in den Praxisräumen, Docker-Container
  (App + MySQL 8), verschlüsseltes Backup per `scripts/backup.sh`
- **Zugriff:** HTTPS über `[praxios.dynv6.net]`, ausschließlich nach Anmeldung
- **Datenhaltung:** MySQL 8 (utf8mb4); Selbst-Migration beim Start;
  Patienten-Dokumente im Volume `dokumente`

## 3. Belegarten und Nummernkreise

| Belegart | Nummernkreis | Vergabe |
|---|---|---|
| Ausgangsrechnungen | `RK <lfd. zweistellig> <Jahr>` (z. B. RK 06 2026) | lückenlos, automatisch bei Finalisierung |
| Gutschriften | eigener Kreis (`ST/<lfd.>`) | lückenlos, automatisch |
| Eingangsrechnungen | Originalnummer des Lieferanten + Duplikatssperre | automatisch beim Import |

Entwürfe verbrauchen **keine** Nummer; diese wird erst bei Finalisierung aus
dem lückenlosen Kreis vergeben. Therapiepläne (keine steuerlichen Belege) haben
eigene IDs außerhalb der Kreise. Duplikatsschutz: pro Patient und Kalenderwoche
wird höchstens eine Rechnung erzeugt (`invoice_therapie_wochen`).

## 4. Erfassung und Verarbeitung

- **Ausgangsrechnungen:** manuell; aus Therapieplan-Import (IMTZ-Excel oder
  PraxisAkte-CSV) mit Klar/Unklar-Entscheid und Unklarheiten-Report; direkt aus
  dokumentiertem Therapieplan („Rechnung erstellen"); aus Serien-Rechnungen.
- **Eingangsrechnungen:** manuell oder per E-Rechnung-Empfang (XRechnung-XML,
  ZUGFeRD-PDF); Original-XML validiert und unverändert archiviert.
- **Zahlungseingänge:** manuell oder per Kontoauszug-Import (Bank-CSV) mit
  Auto-Matching auf offene Rechnungen; Teilzahlungen saldiert.
- **E-Mail-Versand:** Belege per SMTP (Zugangsdaten verschlüsselt,
  AES-256-GCM); jeder Versand mit Zeitpunkt/Empfänger im Versandprotokoll
  (`mail_log`).
- **Akten-Austausch zwischen Ärzten:** nur mit dokumentierter Einwilligung des
  Patienten (Einverständnisdokument in der Akte); Versand als
  age-verschlüsseltes Paket; Exporte protokolliert (`akten_exporte`).

## 5. Unveränderbarkeit und Storno

- Finalisierte Rechnungen/Gutschriften sind **nicht mehr bearbeitbar** und
  nicht löschbar (technisch erzwungen).
- Korrekturen nur per **Storno/Gutschrift** mit eigenem Vermerk und Bezug auf
  den Originalbeleg (eigener Nummernkreis, Verrechnung).
- Entwürfe sind löschbar; der Nummernkreis bleibt davon unberührt.
- Jeder Vorgang mit Zeitstempel und Benutzerkonto nachvollziehbar.

## 6. Benutzer und Berechtigungen

- Zugang nur mit persönlichem Benutzerkonto; Passwörter als scrypt-Hash.
- Rollen: **Leitung/Arzt** (admin: alles inkl. Benutzerverwaltung,
  Einstellungen, Löschungen) sowie **Rechte-Gruppen** mit Bereichs-Rechten
  (Akte, Pläne, Dokumente, Kalender, Anamnese, Austausch, Abrechnung, Lager),
  serverseitig pro Router erzwungen. Verwaltung der Zuordnung: `[Name]`.

## 7. Speicherung, Sicherung und Aufbewahrung

- **Speicherort:** Praxisräume `[Adresse]`; Versand außerhalb nur per
  Arzt-zu-Arzt-Austausch (verschlüsselt) oder E-Mail.
- **Backup:** `scripts/backup.sh` — täglich per Cron: mysqldump +
  Dokumente-Volume, verschlüsselt (gpg AES256), Rotation 30 Tage.
  Passphrase: `~/.praxios-backup.secret` (separat verwahrt).
- **Aufbewahrungsfristen:** steuerlich relevante Belege 10 Jahre (§ 147 AO);
  Patienten-Löschungen nur nach Fristprüfung mit pseudonymisiertem
  Löschprotokoll (Art. 17 DSGVO) — bei vorhandenen Rechnungen keine Löschung,
  nur Archivierung (GoBD vor Art. 17).
- **Restore-Test:** jährlich nach `SERVER-ANLEITUNG.md` („Restore") auf
  Testinstallation nachspielen und Protokoll führen (siehe Abschnitt 10).

## 8. Updates und Migration

- Updates per Paket (tar.gz); vor jedem Update Backup; DB-Schema aktualisiert
  sich beim Start selbst (Self-Migration, idempotent).
- Änderungen dokumentiert im `CHANGELOG.md` (Keep-a-Changelog, SemVer).

## 9. Datenschutz

Verarbeitungsverzeichnis, TOMs und Löschkonzept als separate Dokumente:
`docs/datenschutz/` (vorzulegen bei Bedarf durch `[Name]`).

## 10. Änderungshistorie und Restore-Protokoll

| Datum | Version | Änderung / Restore-Test | Name |
|---|---|---|---|
| `[Datum]` | 1.0.0 | Ersterstellung | `[Name]` |
| `[Datum]` | — | Restore-Test Nr. 1: Backup vom `[Datum]` auf Test-DB eingespielt, Login + Akte + Dokument + Rechnung geprüft ✓ | `[Name]` |
