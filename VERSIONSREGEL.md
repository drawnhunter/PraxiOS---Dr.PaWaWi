# Versionsregel PraxiOS (bindend ab v1.20.1)

Diese Regel gilt für alle PraxiOS-Produkte (Dr.PaWaWi, ReWaWi, SupportHub).
Zweck: Maschinen und Menschen erkennen **sofort und fehlerfrei**, welches
Produkt und welche Version vorliegt und ob eine Version neuer ist.

## 1. Format: MAJOR.MINOR.PATCH (SemVer-angelehnt)

| Stelle | Erhöhen, wenn … | Beispiele |
|---|---|---|
| **PATCH** (x.y.**Z**) | Fehler behoben werden, ohne Verhaltensänderung | Login-Fix, Label-Korrektur |
| **MINOR** (x.**Y**.z) | neue Funktion kommt dazu (abwärtskompatibel) | Praxisbedarf, Portal-PIN, Mail-Pro |
| **MAJOR** (**X**.y.z) | Bruch im Datenmodell/Verhalten oder Produkt-Familiensprung | (bisher nicht genutzt) |

Regeln:
- Bei MINOR-Sprung wird PATCH auf 0 zurückgesetzt (1.19.2 → 1.20.0).
- Keine Suffixe/Präfixe in der Version selbst (`1.20.0`, nicht `1.20.0-beta1`).
  Git-Tags tragen ein kleines `v` davor (`v1.20.0`).
- Jede Versionsänderung = Commit + CHANGELOG-Eintrag + Tag + Bus-Meldung.

## 2. Einzige Wahrheit

Kanonische Quelle: **`api/lib/version.ts` → `APP_VERSION`**.
Synchron Pflicht (Test `api/lib/version.test.ts` erzwingt es):
`package.json/version`, `CHANGELOG.md` (oberster Eintrag), Git-Tag.

## 3. Vergleichsregel (für Hub & Update-Button)

„Neuer als" ist **numerischer Tripelvergleich**, nie Stringvergleich:
`1.9.2 < 1.10.0` (lexikografisch wäre das falsch!).

1. Führendes `v` entfernen
2. An `.` splitten → drei Ganzzahlen
3. Der Reihe nach vergleichen (MAJOR, dann MINOR, dann PATCH)

## 4. Produkt-Identität (Instanz-Pass)

Jede Instanz ist maschinenlesbar als **Produkt-Reihe** gekennzeichnet:
- **`praxios-produkt.json`** (Repo-Root): `produkt` = `pawawi` / `rewawi` / `supporthub`
- **Docker-LABELs** `org.praxios.produkt*` im Image
- **Boot-Log** `[stempel] … produkt=pawawi · vX.Y.Z`
- **`api/lib/version.ts`**: `APP_PRODUKT`, `APP_PRODUKT_NAME`, `APP_HERSTELLER`

**Hoheitsregel (gegen Quereinspielung):** Der SupportHub darf ein Paket nur
bereitstellen, wenn `produkt(Paket) === produkt(Ziel-Instanz)`. Ein
ReWaWi-Paket gehört nie in einen PaWaWi-Kontext (Unfall 18.09.2026).

## 5. Migrationen

Datenbank-Migrationen laufen idempotent beim Start (Selbst-Migration,
`information_schema`-Checks). Eine App-Version trägt ihre Migration immer
selbst mit — Downgrades auf ältere Versionen sind nicht vorgesehen.
