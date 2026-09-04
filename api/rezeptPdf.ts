// ── PraxiOS: Privat-Rezept & Attest als PDF (A5-Rezeptpapier-Look) ─────────
// A5 hochkant wie der klassische Rezeptblock: Praxis-Kopf, Patient, „Rp.",
// Medikamenten-Feld als leicht graue Box mit dem Arzt-/Praxisnamen groß und
// dezent weiß im Hintergrund, Unterschrifts-Stempel.
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import type { AttestInhalt, RezeptInhalt } from "@contracts/rezepte";

function fontPath(name: string): string {
  const p = path.join(process.cwd(), "api", "assets", "fonts", name);
  if (fs.existsSync(p)) return p;
  throw new Error(`Font nicht gefunden: ${name}`);
}

const PETROL = "#0F766E";
const DUNKEL = "#1c1917";
const GRAU = "#57534e";
const BOX_GRAU = "#E9E9E7";
const WASSERZEICHEN = "#FFFFFF";
// A5 hochkant (Standard, Rezeptpapier) — A4 wählbar beim Download
const GROESSEN = {
  a5: { w: 419.53, h: 595.28, margin: 28, skala: 1 },
  a4: { w: 595.28, h: 841.89, margin: 40, skala: 1.35 },
} as const;

export interface RezeptPdfInput {
  typ: "rezept" | "attest";
  inhalt: RezeptInhalt | AttestInhalt;
  patient: {
    name: string;
    geburtsdatum?: string | null; // TT.MM.JJJJ oder null
    strasse?: string | null;
    plz?: string | null;
    ort?: string | null;
  };
  praxis: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    telefon?: string | null;
    email?: string | null;
  };
  /** base64-Data-URL (PNG/JPG) oder null → nur Unterschriftszeile. */
  signaturBild?: string | null;
  /** Ausstellungsdatum TT.MM.JJJJ. */
  datum: string;
  /** Papierformat: a5 (Standard, Rezeptpapier) oder a4. */
  format?: "a5" | "a4";
}

function wasserzeichenName(name: string): string {
  // Kein Abschneiden — die Schriftgrößen-Schleife beim Rendern verkleinert
  // den Namen, bis er in eine Zeile passt.
  return name;
}

export async function renderRezeptPdf(input: RezeptPdfInput): Promise<Buffer> {
  const G = GROESSEN[input.format ?? "a5"];
  const PAGE_W = G.w;
  const PAGE_H = G.h;
  const MARGIN = G.margin;
  const W = PAGE_W - 2 * MARGIN;
  const SK = G.skala;

  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: MARGIN,
    // Pflicht: eigener Font als Default (ESM-Bundle, siehe rezeptPdf.test.ts)
    font: fontPath("DejaVuSans.ttf"),
    info: { Title: input.typ === "rezept" ? "Privatrezept" : "Attest" },
  });
  doc.registerFont("Regular", fontPath("DejaVuSans.ttf"));
  doc.registerFont("Bold", fontPath("DejaVuSans-Bold.ttf"));
  doc.registerFont("Italic", fontPath("DejaVuSans-Oblique.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fertig = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks))),
  );

  const { praxis, patient, datum } = input;

  // ── Praxis-Kopf (kompakt) ─────────────────────────────────────────────────
  doc.font("Bold").fontSize(11.5).fillColor(PETROL).text(praxis.name, MARGIN, MARGIN);
  doc
    .font("Regular")
    .fontSize(7.5)
    .fillColor(GRAU)
    .text(`${praxis.strasse} · ${praxis.plz} ${praxis.ort}`, MARGIN, doc.y + 1);
  const kontakt = [praxis.telefon ? `Tel. ${praxis.telefon}` : null, praxis.email]
    .filter(Boolean)
    .join(" · ");
  if (kontakt) doc.text(kontakt);
  const kopfEnde = doc.y + 6;
  doc
    .moveTo(MARGIN, kopfEnde)
    .lineTo(MARGIN + W, kopfEnde)
    .lineWidth(1)
    .strokeColor(PETROL)
    .stroke();

  // ── Patient ───────────────────────────────────────────────────────────────
  const geb = patient.geburtsdatum ? `, geb. am ${patient.geburtsdatum}` : "";
  const adresse = [patient.strasse, [patient.plz, patient.ort].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  let y = kopfEnde + 10;
  doc.font("Bold").fontSize(10).fillColor(DUNKEL).text(`${patient.name}${geb}`, MARGIN, y);
  if (adresse) {
    doc.font("Regular").fontSize(8).fillColor(GRAU).text(adresse, MARGIN, doc.y + 1);
  }
  y = doc.y + 10;

  // ── Graue Box mit Wasserzeichen-Arztname ──────────────────────────────────
  const boxOben = y;
  const boxUnten = input.typ === "rezept" ? PAGE_H - 150 : PAGE_H - 170;
  const boxHoehe = boxUnten - boxOben;
  doc.save();
  doc.roundedRect(MARGIN, boxOben, W, boxHoehe, 8).fill(BOX_GRAU);
  // Arztname groß und dezent weiß im Hintergrund — Schriftgröße wird
  // automatisch verkleinert, bis der Name in EINE Zeile passt (kein Umbruch)
  const wz = wasserzeichenName(praxis.name);
  let wzGroesse = 32;
  doc.font("Bold");
  doc.fontSize(wzGroesse);
  while (wzGroesse > 12 && doc.widthOfString(wz) > W - 40) {
    wzGroesse -= 1;
    doc.fontSize(wzGroesse);
  }
  doc
    .fontSize(wzGroesse)
    .fillColor(WASSERZEICHEN)
    .fillOpacity(0.95)
    .text(wz, MARGIN + 14, boxOben + boxHoehe / 2 - wzGroesse / 2 - 4, {
      width: W - 28,
      align: "center",
      lineBreak: false,
    });
  doc.fillOpacity(1);
  doc.restore();

  const inhaltX = MARGIN + 16;
  const inhaltW = W - 32;

  if (input.typ === "rezept") {
    const inhalt = input.inhalt as RezeptInhalt;
    // ── Rp. + Verordnungen ──────────────────────────────────────────────────
    let ry = boxOben + 14;
    doc.font("Bold").fontSize(20).fillColor(PETROL).text("Rp.", inhaltX, ry);
    ry += 26;
    inhalt.medikamente.forEach((m, i) => {
      const zeile1 = [m.name, m.staerke].filter(Boolean).join(" ");
      doc
        .font("Bold")
        .fontSize(10.5)
        .fillColor(DUNKEL)
        .text(`${inhalt.medikamente.length > 1 ? `${i + 1}. ` : ""}${zeile1}`, inhaltX, ry, { width: inhaltW });
      ry = doc.y + 2;
      if (m.menge) {
        doc.font("Regular").fontSize(9).fillColor(GRAU).text(m.menge, inhaltX, ry, { width: inhaltW });
        ry = doc.y + 1;
      }
      if (m.dosierung) {
        doc.font("Italic").fontSize(9).fillColor(DUNKEL).text(`Einnahme: ${m.dosierung}`, inhaltX, ry, { width: inhaltW });
        ry = doc.y + 1;
      }
      ry += 6;
    });
    if (inhalt.hinweis?.trim()) {
      doc
        .font("Regular")
        .fontSize(8)
        .fillColor(GRAU)
        .text(`Hinweis: ${inhalt.hinweis.trim()}`, inhaltX, Math.min(ry + 2, boxUnten - 30), {
          width: inhaltW,
        });
    }
  } else {
    const inhalt = input.inhalt as AttestInhalt;
    const istAU = inhalt.art === "krankschreibung";
    // ── Attest-Text ─────────────────────────────────────────────────────────
    let ay = boxOben + 16;
    doc
      .font("Bold")
      .fontSize(13)
      .fillColor(DUNKEL)
      .text(istAU ? "Arbeitsunfähigkeitsbescheinigung" : "Ärztliches Attest", inhaltX, ay, {
        width: inhaltW,
      });
    ay = doc.y + 10;

    // Feststellung: Datum, Erst-/Folgebescheinigung, Ort (Pflichtangaben AU)
    const festDatum = inhalt.feststellungsdatum || datum;
    const festZeile: string[] = [`Festgestellt am ${festDatum}`];
    if (istAU) {
      festZeile.push(inhalt.erstbescheinigung === false ? "Folgebescheinigung" : "Erstbescheinigung");
    }
    const ort = (inhalt.feststellungsOrt ?? "Praxis").trim();
    if (ort) festZeile.push(`Ort: ${ort}`);
    doc.font("Regular").fontSize(8.5).fillColor(GRAU).text(festZeile.join(" · "), inhaltX, ay, { width: inhaltW });
    ay = doc.y + 10;

    doc.font("Regular").fontSize(10).fillColor(DUNKEL);
    if (istAU) {
      const von = inhalt.auVon || datum;
      const bis = inhalt.auBis || "…";
      doc.text(
        `${patient.name}${geb} ist vom ${von} bis voraussichtlich einschließlich ${bis} arbeitsunfähig erkrankt.`,
        inhaltX,
        ay,
        { width: inhaltW, lineGap: 3 },
      );
      ay = doc.y + 10;
    }
    if (inhalt.text.trim()) {
      doc.text(inhalt.text.trim(), inhaltX, ay, { width: inhaltW, lineGap: 3 });
      ay = doc.y + 8;
    }

    // Diagnose/ICD nur wenn ausdrücklich ausgewiesen (Arbeitgeber-Exemplar-Regel)
    if (inhalt.diagnoseAusweisen && inhalt.icdCodes && inhalt.icdCodes.length > 0) {
      doc.font("Bold").fontSize(8.5).fillColor(DUNKEL).text("Diagnose(n) nach ICD-10-GM:", inhaltX, ay, { width: inhaltW });
      ay = doc.y + 2;
      for (const c of inhalt.icdCodes) {
        doc.font("Regular").fontSize(8.5).fillColor(DUNKEL).text(`${c.code} — ${c.text}`, inhaltX, ay, { width: inhaltW });
        ay = doc.y + 1;
      }
    }
  }

  // ── Fußbereich: Hinweis (nur Rezept) + Ort/Datum + Unterschrift ──────────
  if (input.typ === "rezept") {
    doc
      .font("Regular")
      .fontSize(6.8)
      .fillColor(GRAU)
      .text(
        "Privat verordnet — die Kosten dieser Verordnung werden nicht von der gesetzlichen Krankenversicherung übernommen.",
        MARGIN,
        boxUnten + 8,
        { width: W },
      );
  }

  const sigY = PAGE_H - 86;
  doc
    .font("Regular")
    .fontSize(9)
    .fillColor(DUNKEL)
    .text(`${praxis.ort}, den ${datum}`, MARGIN, sigY + 26);

  const sigX = PAGE_W - MARGIN - 170;
  if (input.signaturBild) {
    try {
      const b64 = input.signaturBild.split(",")[1] ?? "";
      const buf = Buffer.from(b64, "base64");
      if (buf.length > 100) {
        doc.image(buf, sigX + 6, sigY - 44, { fit: [170 * SK, 66 * SK] });
      }
    } catch {
      /* defektes Bild → nur Linie */
    }
  }
  doc
    .moveTo(sigX, sigY + 32)
    .lineTo(sigX + 170, sigY + 32)
    .lineWidth(0.8)
    .strokeColor(DUNKEL)
    .stroke();
  doc
    .font("Regular")
    .fontSize(7)
    .fillColor(GRAU)
    .text("Unterschrift Arzt/Ärztin", sigX, sigY + 36, { width: 170, align: "center" });

  doc.end();
  return fertig;
}
