// ── Bogen-Importer: docx/pdf → Block-Erkennung (Heuristiken) ───────────────
// Ziel: Arzt lädt seine bisherige Word-/PDF-Anamnese hoch, bekommt eine
// Vorschau der erkannten Baublöcke (mit Typ + Inhalt) und korrigiert im Editor.
import { execFile } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import type { BlockConfig, BlockTyp, FormBlock } from "@contracts/anamnese";

const execFileP = promisify(execFile);

export interface ImportAnalyse {
  bloecke: FormBlock[];
  hinweise: string[];
  quelle: "docx" | "pdf";
  zeilenGesamt: number;
  uebernommen: number;
}

/** Text aus docx (mammoth) oder pdf (pdftotext -layout) extrahieren. */
export async function extrahiereText(dateiname: string, puffer: Buffer): Promise<{ text: string; quelle: "docx" | "pdf" }> {
  const lower = dateiname.toLowerCase();
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer: puffer });
    return { text: res.value, quelle: "docx" };
  }
  if (lower.endsWith(".pdf")) {
    const dir = mkdtempSync(join(tmpdir(), "bogenimport-"));
    try {
      const pfad = join(dir, "bogen.pdf");
      writeFileSync(pfad, puffer);
      const { stdout } = await execFileP("pdftotext", ["-layout", pfad, "-"], {
        timeout: 60000,
        maxBuffer: 8 * 1024 * 1024,
      });
      return { text: stdout, quelle: "pdf" };
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* aufräumen best effort */
      }
    }
  }
  throw new Error("Nur .docx- und .pdf-Dateien werden unterstützt.");
}

// ── Erkennung ────────────────────────────────────────────────────────────────
const CHECK = "☐";
const normBox = (z: string) => z.replace(/[□☑☒✓✔◻◼⬜]/g, CHECK);

const BEREICH_RE = /(daten|beschwerden|ziele|vorgeschichte|vorerkrank|medikament|allergi|nahrungserg|symptom|lebensstil|umwelt|einwilligung|erklärung|datenschutz|anamnese|geschichte|operation|implantat)/i;
const BUCHSTABE_RE = /^([A-Z]|[IVX]{1,3})[.)]\s+\S/;
const CHECKBOX_ZEILE_RE = /☐/;
const JA_NEIN_RE = /(ja\s*☐?\s*[\/|]?\s*nein|☐\s*ja\b|\bja\s*☐)/i;
const UNTERSTRICH_RE = /_{5,}/;
const SKALA_RE = /skala|1\s*[-–]\s*10|\(1\s*[-–]\s*10\)/i;
const HAEUFIG_RE = /(gar nicht|selten|manchmal|häufig|täglich|nie\b|normal)/i;
const RECHT_RE =
  /(dsgvo|einwilligung|datenschutz|schweigepflicht|datenverarbeitung|aufbewahrungsfrist|widerruf|willige ein|willigen sie|zustimmung|wahrheitsgemäß|personenbezogen)/i;

function istBereichsTitel(zeile: string): boolean {
  const z = zeile.trim();
  if (z.length < 3 || z.length > 70) return false;
  // Ankreuz-Zeilen und echte Fragen sind nie Bereichs-Titel
  if (z.includes(CHECK)) return false;
  if (z.endsWith("?") || z.endsWith("?")) return false;
  if (BUCHSTABE_RE.test(z)) return true;
  if (z.endsWith(":") && BEREICH_RE.test(z)) return true;
  // Eigenständige Kurzzeile mit Bereichs-Keyword, ohne Satzende
  if (BEREICH_RE.test(z) && !z.endsWith(".") && z.split(" ").length <= 8) return true;
  return false;
}

function blockNeu(titel: string, typ: BlockTyp, config: BlockConfig): FormBlock {
  return { typ, titel: titel.trim(), config };
}

/** Heuristische Block-Erkennung aus Fließtext (docx/pdf-Anamnese). */
export function analysiereBogenText(text: string): ImportAnalyse {
  const rohZeilen = normBox(text)
    .split(/\r?\n/)
    .map((z) => z.replace(/\s+/g, " ").trim());

  const bloecke: FormBlock[] = [];
  const hinweise: string[] = [];
  let uebernommen = 0;

  // Aktueller Sammelzustand je laufendem Block
  let titel = "Allgemein";
  let cb: string[] = [];
  let jn: string[] = [];
  let jnNotiz: string | null = null;
  let tf: { frage: string; zeilen: number }[] = [];
  let skalen: { frage: string }[] = [];
  let hf: string[] = [];
  let info: string[] = [];

  const flush = () => {
    const hatte =
      cb.length + jn.length + tf.length + skalen.length + hf.length + (info.join(" ").trim() ? 1 : 0);
    if (cb.length > 0) bloecke.push(blockNeu(titel, "checkboxen", { fragen: cb, spalten: 2 }));
    if (jn.length > 0)
      bloecke.push(
        blockNeu(titel, "jaNein", {
          fragen: jn,
          notizFrage: jnNotiz ?? undefined,
        }),
      );
    for (const t of tf) bloecke.push(blockNeu(titel, "textfeld_schreibfeld", { frage: t.frage, zeilen: t.zeilen }));
    for (const sk of skalen) bloecke.push(blockNeu(titel, "skala_1_10", { frage: sk.frage }));
    if (hf.length > 0) bloecke.push(blockNeu(titel, "haeufigkeit", { fragen: hf }));
    const infoText = info.join("\n\n").trim();
    if (infoText) {
      bloecke.push(
        blockNeu(titel, "infotext", {
          text: infoText,
          checkboxLabel: RECHT_RE.test(infoText) ? "Ich willige ein" : "",
          pflicht: true,
        }),
      );
    }
    if (hatte === 0 && titel !== "Allgemein") hinweise.push(`Bereich „${titel}“: nichts Eindeutiges erkannt`);
    cb = [];
    jn = [];
    jnNotiz = null;
    tf = [];
    skalen = [];
    hf = [];
    info = [];
  };

  let letzteFrage = "";
  for (let i = 0; i < rohZeilen.length; i++) {
    const zeile = rohZeilen[i];
    if (!zeile) continue;
    uebernommen++;

    // Anweisungen an den Patienten („Bitte kreuzen/ beschreiben Sie …“) überspringen
    // (VOR der Titel-Erkennung — solche Zeilen enden oft mit „:“)
    if (/^bitte (kreuzen|beantworten|beschreiben|geben|fülle|markiere)/i.test(zeile)) {
      uebernommen++;
      continue;
    }

    // Bereichs-Titel → Blockwechsel
    if (istBereichsTitel(zeile)) {
      // Tabellen-Sonderfall: Kurzzeile („Operationen“) gefolgt von einer
      // eigenen „☐ Ja ☐ Nein“-Zeile → das ist eine Ja/Nein-Frage, kein Titel
      const naechste = rohZeilen.slice(i + 1).find((z) => z);
      if (naechste && /^\s*☐?\s*ja\s*☐?\s*[\/|]?\s*nein\s*☐?\s*$/i.test(naechste)) {
        const frage = zeile.replace(/^([A-Z]|[IVX]{1,3})[.)]\s+/, "").replace(/[:.]\s*$/, "").trim();
        // Tabellen-Kopfzeile („Organsystem / Bereich“) ist keine Frage
        if (frage.length > 3 && !/organsystem\s*\/\s*bereich/i.test(frage)) jn.push(frage);
        uebernommen++;
        continue;
      }
      flush();
      // Kurztitel säubern: nur führende Ordnungszeichen („A.“ / „1.“ / „IV.“) entfernen
      titel = zeile.replace(/^([A-Z]|[IVX]{1,3})[.)]\s+/, "").trim() || zeile.trim();
      letzteFrage = "";
      continue;
    }

    // Erklärungstext (DSGVO & Co. sammeln)
    if (RECHT_RE.test(zeile) && zeile.length > 40) {
      info.push(zeile);
      continue;
    }
    if (info.length > 0 && zeile.length > 40 && !CHECKBOX_ZEILE_RE.test(zeile)) {
      info.push(zeile);
      continue;
    }

    // Skala erkennen („… (Skala 1-10)")
    if (SKALA_RE.test(zeile) && !CHECKBOX_ZEILE_RE.test(zeile)) {
      // Nur echte Hint-Klammern und Antwort-Unterstriche entfernen —
      // der Fragetext selbst bleibt vollständig erhalten.
      const frage =
        zeile
          .replace(/_{3,}/g, "")
          .replace(/[:：]\s*$/, "")
          .replace(/\((?:skala|1\s*[-–]\s*10)[^)]*\)\s*$/i, "")
          .replace(/[:：]\s*$/, "")
          .trim() || letzteFrage;
      skalen.push({ frage: frage.replace(/:\s*$/, "") });
      uebernommen++;
      continue;
    }

    // Häufigkeits-Listen
    if (HAEUFIG_RE.test(zeile) && !CHECKBOX_ZEILE_RE.test(zeile) && zeile.length < 90) {
      hf.push(zeile.replace(/:\s*$/, ""));
      continue;
    }

    // Tabellen-Fall: Zeile enthält NUR „Ja / Nein“ → an die vorherige Frage hängen
    if (/^\s*☐?\s*ja\s*☐?\s*[\/|]?\s*nein\s*☐?\s*$/i.test(zeile) && letzteFrage) {
      // Tabellen-Kopfzeile („Organsystem / Bereich“) ist keine Frage
      if (!/organsystem\s*\/\s*bereich/i.test(letzteFrage)) {
        jn.push(letzteFrage.endsWith("?") || !letzteFrage.endsWith(".") ? letzteFrage : letzteFrage.slice(0, -1));
      }
      if (/welche|seit wann|wann\?/i.test(zeile) || /welche|seit wann|wann\?/i.test(letzteFrage)) jnNotiz = "Wenn ja, welche / seit wann?";
      uebernommen++;
      continue;
    }

    // Ja/Nein-Frage
    if (JA_NEIN_RE.test(zeile)) {
      const frage = zeile
        .replace(/☐/g, "")
        .replace(/\bja\b\s*[\/|]?\s*\bnein\b/i, "")
        .replace(/[:：]\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (frage.length > 3 && frage.length < 140) {
        // Tabellen-Kopfzeile („Organsystem / Bereich“) ist keine Frage
        if (!/organsystem\s*\/\s*bereich/i.test(frage)) {
          jn.push(frage.endsWith("?") || !frage.endsWith(".") ? frage : frage.slice(0, -1));
          // Nachfrage auf Notiz („Wenn ja, …?“)
          if (/wenn ja|welche|seit wann|wann\?/i.test(zeile)) jnNotiz = "Wenn ja, welche / seit wann?";
        }
        uebernommen++;
        continue;
      }
    }

    // Ankreuz-Optionen (☐ Option)
    if (CHECKBOX_ZEILE_RE.test(zeile)) {
      const teile = zeile.split(CHECK).map((t) => t.trim()).filter(Boolean);
      for (const teil of teile) {
        const sauber = teil.replace(/\s+/g, " ").trim();
        // Spalten wie „hoch / niedrig“ oder „in Ruhe / bei Belastung“ bleiben im Text
        if (sauber.length > 1 && sauber.length < 90 && !/^ja$/i.test(sauber) && !/^nein$/i.test(sauber)) {
          cb.push(sauber.replace(/:\s*$/, ""));
        }
      }
      uebernommen++;
      continue;
    }

    // Schreibfeld: Zeile mit vielen Unterstrichen ODER Frage gefolgt von Unterstrich-Linie
    const unterstrich = zeile.match(UNTERSTRICH_RE);
    if (unterstrich) {
      const frage = (zeile.replace(UNTERSTRICH_RE, "").replace(/[:：]\s*$/, "").trim() || letzteFrage).replace(/:\s*$/, "");
      if (frage && !tf.some((t) => t.frage === frage)) tf.push({ frage, zeilen: 3 });
      uebernommen++;
      continue;
    }
    const fragezeichenZeile =
      /[:？?]\s*$/.test(zeile) || (zeile.includes("?") && zeile.length < 160);
    if (fragezeichenZeile && zeile.length > 12 && zeile.length < 160 && !zeile.endsWith(".")) {
      // Frage mit Doppelpunkt/Fragezeichen am Ende → Schreibfeld-Kandidat (wenn nächste Zeile Unterstrich)
      const naechste = rohZeilen[i + 1] ?? "";
      if (UNTERSTRICH_RE.test(naechste) || naechste === "") {
        const frage = zeile.replace(/\s*\([^)]*\)\s*$/, "").replace(/[:？?]\s*$/, "").trim();
        if (frage && !tf.some((t) => t.frage === frage)) tf.push({ frage, zeilen: 3 });
        letzteFrage = frage;
        uebernommen++;
        continue;
      }
    }

    // Einzel-Textfeld („Feld: ___" in Tabellenzeilen wie „Name, Vorname")
    if (UNTERSTRICH_RE.test(zeile) && zeile.length < 120) {
      const frage = zeile.replace(UNTERSTRICH_RE, "").replace(/[:：]\s*$/, "").trim();
      if (frage && !tf.some((t) => t.frage === frage)) tf.push({ frage, zeilen: 2 });
      continue;
    }

    // Tabellenartige kurze Zeilen (z. B. Organsysteme) als potenzielle Frage merken
    if (zeile.length < 80 && !zeile.endsWith(".") && !CHECKBOX_ZEILE_RE.test(zeile)) {
      letzteFrage = zeile.replace(/:\s*$/, "");
      uebernommen++;
      continue;
    }

    hinweise.push(`Zeile ${i + 1} nicht zugeordnet: „${zeile.slice(0, 70)}${zeile.length > 70 ? "…" : ""}“`);
  }
  flush();

  // Kopfbogen-Hinweis, falls „Persönliche Daten" als Block auftaucht —
  // ALLE Blöcke mit diesem Titel entfernen (Kopfbogen ist im System fest)
  if (bloecke.some((b) => /persönliche daten|personalien/i.test(b.titel))) {
    hinweise.unshift(
      "Block „Persönliche Daten“ erkannt — wird NICHT als Baublock übernommen (der Kopfbogen ist im System fest eingebaut; seine Felder bitte dort prüfen).",
    );
    for (let j = bloecke.length - 1; j >= 0; j--) {
      if (/persönliche daten|personalien/i.test(bloecke[j].titel)) bloecke.splice(j, 1);
    }
  }

  return { bloecke, hinweise, quelle: "docx", zeilenGesamt: rohZeilen.length, uebernommen };
}
