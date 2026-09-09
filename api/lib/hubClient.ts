// ── PraxiOS: Hub-Client (Pull-Modell, Auftrag Bus #18) ─────────────────────
// Die App meldet sich periodisch beim SupportHub und holt Befehle ab —
// NUR wenn ein Support-Schlüssel verbunden ist. Bei Hub-Ausfall: still weiter.
// Grenzen (verbindlich): keine Shell/kein Dateizugriff außerhalb der App,
// keine Patienten-/Buchhaltungsdaten — nur Metadaten.
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { createGzip } from "zlib";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { eq, gte, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { companySettings, supportMeldungen } from "@db/schema";
import { env } from "./env";
import { APP_VERSION } from "./version";

const execFileP = promisify(execFile);
const HUB_URL = (process.env.SUPPORT_HUB_URL || "https://support.praxios.dynv6.net").replace(/\/$/, "");
const PRODUKT = process.env.SUPPORT_PRODUKT || "Dr.PaWaWi";
const INTERVALL_MS = 10 * 60 * 1000; // alle ~10 min

interface HubAntwort {
  ok: boolean;
  fehler?: string;
}
interface HubBefehl {
  id: number;
  typ: string; // "backup" | "update-hinweis" | "diagnose"
  inhalt?: string | null;
}

async function hubAufruf<T>(pfad: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(HUB_URL + "/api/hub" + pfad, {
    ...init,
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const daten = (await res.json()) as T & { ok?: boolean };
  if (typeof daten?.ok !== "boolean") return null;
  return daten;
}

async function ladeSchluessel(): Promise<string | null> {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
    columns: { supportSchluessel: true, backupZuletztAm: true },
  });
  return s?.supportSchluessel ?? null;
}

/** Festplatten-Auslastung in % (df des Upload-Dirs, Bordmittel). */
async function diskProzent(): Promise<number | null> {
  try {
    const { stdout } = await execFileP("df", ["-P", env.uploadDir], { timeout: 5000 });
    const zeile = stdout.trim().split("\n").pop() ?? "";
    const m = /(\d+)%/.exec(zeile);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

async function fehler24h(): Promise<number> {
  const seit = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await getDb().query.supportMeldungen.findMany({
    where: gte(supportMeldungen.createdAt, seit),
    columns: { id: true, status: true },
  });
  return rows.filter((r) => r.status === "fehlgeschlagen").length;
}

// ── Befehl: backup ─────────────────────────────────────────────────────────
// DB-Dump via mysqldump aus dem DB-Container ist vom App-Container nicht
// erreichbar — deshalb: eigner SQL-Dump über die App-DB-Verbindung ins
// Backups-Verzeichnis (nebengelegen zum persistenten Upload-Volume), gzipped.
async function backupAusfuehren(): Promise<{ ok: boolean; detail: string }> {
  const db = getDb();
  const zielOrdner = path.join(env.uploadDir, "..", "backups");
  mkdirSync(zielOrdner, { recursive: true });
  const stempel = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const ziel = path.join(zielOrdner, `${PRODUKT.replace(/\s/g, "")}-backup-${stempel}.sql.gz`);

  const [tabellen] = (await db.execute(sql`SHOW TABLES`)) as unknown as [
    Record<string, string>[],
    unknown,
  ];

  const datei = createWriteStream(ziel);
  const gzip = createGzip();
  const strom = pipeline(gzip, datei);

  gzip.write(`-- ${PRODUKT} DB-Backup (Hub-Befehl) · ${new Date().toISOString()}\n\n`);
  for (const t of tabellen) {
    const name = Object.values(t)[0];
    gzip.write(`\n-- Tabelle: ${name}\n`);
    const [zeilen] = (await db.execute(
      sql.raw(`SELECT * FROM \`${name}\``),
    )) as unknown as [Record<string, unknown>[], unknown];
    for (const z of zeilen) {
      const spalten = Object.keys(z).map((k) => `\`${k}\``).join(", ");
      const werte = Object.values(z)
        .map((v) => {
          if (v === null) return "NULL";
          if (typeof v === "number" || typeof v === "bigint") return String(v);
          if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
          return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
        })
        .join(", ");
      gzip.write(`INSERT INTO \`${name}\` (${spalten}) VALUES (${werte});\n`);
    }
  }
  gzip.end();
  await strom;

  const { size } = await import("fs").then((fs) => fs.promises.stat(ziel));
  return {
    ok: true,
    detail: `DB-Dump erstellt: ${path.basename(ziel)} (${Math.round(size / 1024)} KB) im Backups-Ordner. Hinweis: Dokumente-Dateien deckt der Host-Backup (scripts/backup.sh) ab.`,
  };
}

// ── Befehl: diagnose ───────────────────────────────────────────────────────
async function diagnoseAusfuehren(): Promise<{ ok: boolean; detail: string }> {
  const disk = await diskProzent();
  const fehler = await fehler24h();
  return {
    ok: true,
    detail: JSON.stringify({
      produkt: PRODUKT,
      version: APP_VERSION,
      zeit: new Date().toISOString(),
      uptimeSek: Math.round(process.uptime()),
      diskProzent: disk,
      fehler24h: fehler,
      node: process.version,
    }),
  };
}

// ── Befehl: update-hinweis ─────────────────────────────────────────────────
// Setzt eine lokale Notiz (company_settings hat kein Feld dafür — die Meldung
// geht an die Support-Meldungen und taucht dort als „problem"-Eintrag auf).
async function updateHinweisAusfuehren(inhalt?: string | null): Promise<{ ok: boolean; detail: string }> {
  await getDb().insert(supportMeldungen).values({
    typ: "problem",
    betreff: "Update-Hinweis vom SupportHub",
    nachricht: inhalt?.trim() || "Ein Update ist verfügbar — bitte über den SupportHub bereitstellen.",
    benutzer: "system",
    instanz: PRODUKT,
    version: APP_VERSION,
    status: "gesendet",
  });
  return { ok: true, detail: "Update-Hinweis lokal registriert." };
}

async function zyklus() {
  try {
    const schluessel = await ladeSchluessel();
    if (!schluessel) return; // nicht verbunden → still weiter

    const s = await getDb().query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
      columns: { backupZuletztAm: true },
    });
    const heartbeat = {
      schluessel,
      produkt: PRODUKT,
      version: APP_VERSION,
      status: "ok",
      diskProzent: await diskProzent(),
      uptimeSek: Math.round(process.uptime()),
      letztesBackup: s?.backupZuletztAm?.toISOString() ?? null,
      fehler24h: await fehler24h(),
    };
    const hb = await hubAufruf<HubAntwort>("/heartbeat", {
      method: "POST",
      body: JSON.stringify(heartbeat),
    });
    if (!hb?.ok) return; // Hub-Ausfall/Fehler → still weiter (wie bei report)

    // Befehle abholen
    const befehle = await hubAufruf<HubAntwort & { befehle?: HubBefehl[] }>(
      `/befehle?schluessel=${encodeURIComponent(schluessel)}`,
    );
    if (!befehle?.ok || !befehle.befehle?.length) return;

    for (const b of befehle.befehle) {
      let ergebnis: { ok: boolean; detail: string };
      try {
        if (b.typ === "backup") ergebnis = await backupAusfuehren();
        else if (b.typ === "diagnose") ergebnis = await diagnoseAusfuehren();
        else if (b.typ === "update-hinweis") ergebnis = await updateHinweisAusfuehren(b.inhalt);
        else ergebnis = { ok: false, detail: `Unbekannter Befehlstyp: ${b.typ}` };
      } catch (e) {
        ergebnis = { ok: false, detail: e instanceof Error ? e.message : String(e) };
      }
      await hubAufruf("/ergebnis", {
        method: "POST",
        body: JSON.stringify({
          schluessel,
          befehlId: b.id,
          ok: ergebnis.ok,
          detail: ergebnis.detail.slice(0, 4000),
        }),
      }).catch(() => undefined);
    }
  } catch {
    // Nie die App stören — Hub-Fernverwaltung ist best effort.
  }
}

/** Startet den Hub-Client (nur Produktion; einmalig beim Boot). */
export function starteHubClient() {
  setTimeout(zyklus, 90 * 1000); // erster Lauf 90 s nach Boot
  setInterval(zyklus, INTERVALL_MS);
  console.log(`[hub] Client aktiv (Pull alle ${INTERVALL_MS / 60000} min, Ziel ${HUB_URL})`);
}
