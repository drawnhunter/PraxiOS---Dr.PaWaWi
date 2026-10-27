// ── PraxiOS: Therapieplan-Export (PDF + XLSX, 1.29.0) ──────────────────────
// PDF = Tageskarten (Portal-Look, analog für Patienten), XLSX = Rohdaten +
// Metadatenblatt (für Weiterverarbeitung/Abrechnung).
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";

function fontPath(name: string): string {
  const p = path.join(process.cwd(), "api", "assets", "fonts", name);
  if (fs.existsSync(p)) return p;
  throw new Error(`Font nicht gefunden: ${name}`);
}

const PETROL = "#0F766E";
const DUNKEL = "#1c1917";
const GRAU = "#57534e";
const HELL = "#f5f5f4";
const GRUEN = "#166534";
const AMBER = "#92610f";

export interface ExportEintrag {
  datum: string;
  zeitVon: string | null;
  zeitBis: string | null;
  leistung: string;
  menge: string | number;
  einheit: string;
  raum: string | null;
  therapeut: string | null;
  status: string; // geplant / stattgefunden / abgesagt / ausgefallen
  bemerkung: string | null;
}

export interface ExportPlanInput {
  titel: string;
  status: string; // geplant / aktiv / dokumentiert / abgerechnet
  vonDatum: string;
  bisDatum: string;
  patient: { name: string; geburtsdatum?: string | null; patientenNr?: string | null };
  praxis: { name: string; strasse: string; plz: string; ort: string; telefon?: string | null; email?: string | null };
  eintraege: ExportEintrag[];
}

const STATUS_LABEL: Record<string, string> = {
  stattgefunden: "erledigt",
  abgesagt: "abgesagt",
  ausgefallen: "ausgefallen",
  geplant: "geplant",
};

function wochentag(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long" });
}
function datumDe(iso: string): string {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

// ── PDF: Tageskarten (analog Portal) ────────────────────────────────────────
export async function renderTherapieplanPdf(input: ExportPlanInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    font: fontPath("DejaVuSans.ttf"),
    info: { Title: `${input.titel} — ${input.patient.name}` },
  });
  doc.registerFont("Regular", fontPath("DejaVuSans.ttf"));
  doc.registerFont("Bold", fontPath("DejaVuSans-Bold.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fertig = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const M = 42;
  const W = 595.28 - 2 * M;

  // Kopf
  doc.font("Bold").fontSize(13).fillColor(PETROL).text(input.praxis.name, M, M);
  doc.font("Regular").fontSize(8).fillColor(GRAU)
    .text(`${input.praxis.strasse} · ${input.praxis.plz} ${input.praxis.ort}`, M, doc.y + 1);
  const kontakt = [input.praxis.telefon ? `Tel. ${input.praxis.telefon}` : null, input.praxis.email].filter(Boolean).join(" · ");
  if (kontakt) doc.text(kontakt);
  const kopfEnde = doc.y + 5;
  doc.save().moveTo(M, kopfEnde).lineTo(M + W, kopfEnde).lineWidth(1).strokeColor(PETROL).stroke().restore();

  // Titel + Patient + Summe
  let y = kopfEnde + 12;
  doc.font("Bold").fontSize(15).fillColor(DUNKEL).text(input.titel, M, y, { width: W });
  y = doc.y + 3;
  const geb = input.patient.geburtsdatum ? `, geb. am ${input.patient.geburtsdatum}` : "";
  const nr = input.patient.patientenNr ? ` · Patienten-Nr. ${input.patient.patientenNr}` : "";
  doc.font("Regular").fontSize(9).fillColor(DUNKEL).text(`${input.patient.name}${geb}${nr}`, M, y);
  y = doc.y + 2;
  doc.font("Regular").fontSize(8.5).fillColor(GRAU).text(`Zeitraum: ${datumDe(input.vonDatum)}–${datumDe(input.bisDatum)} · Status: ${input.status}`, M, y);
  y = doc.y + 4;
  const gesamt = input.eintraege.length;
  const erledigt = input.eintraege.filter((e) => e.status === "stattgefunden").length;
  doc.font("Bold").fontSize(9).fillColor(PETROL).text(`${gesamt} Anwendungen · ${erledigt} erledigt`, M, y);
  y += 12;

  // Tage gruppieren und stabil nach Datum ausgeben
  const tage = new Map<string, ExportEintrag[]>();
  for (const e of input.eintraege) {
    tage.set(e.datum, [...(tage.get(e.datum) ?? []), e]);
  }

  const ZEIT_X = M + 6;
  const ZEIT_W = 60;
  const LEISTUNG_X = M + 72;
  const LEISTUNG_W = W - 283;
  const MENGE_X = LEISTUNG_X + LEISTUNG_W + 6;
  const MENGE_W = 70;
  const RAUM_X = MENGE_X + MENGE_W + 6;
  const RAUM_W = 55;
  const STATUS_X = RAUM_X + RAUM_W + 6;
  const STATUS_W = 62;
  const INHALT_ENDE = 752;

  const neueSeite = () => {
    doc.addPage();
    y = M;
    doc.font("Bold").fontSize(10).fillColor(PETROL).text(`${input.titel} · Fortsetzung`, M, y, { width: W });
    y = doc.y + 10;
  };

  const tagesKopf = (tag: string, liste: ExportEintrag[], fortsetzung = false) => {
    const tagErledigt = liste.filter((e) => e.status === "stattgefunden").length;
    const alleErledigt = tagErledigt === liste.length;
    doc.save().roundedRect(M, y, W, 22, 4).fill(HELL).restore();
    doc.font("Bold").fontSize(9.5).fillColor(DUNKEL).text(
      `${wochentag(tag)}, ${datumDe(tag)}${fortsetzung ? " · Fortsetzung" : ""}`,
      M + 8,
      y + 6,
      { lineBreak: false },
    );
    const statusText = alleErledigt ? "abgeschlossen" : `${tagErledigt}/${liste.length} erledigt`;
    doc.font("Regular").fontSize(7.5).fillColor(alleErledigt ? GRUEN : AMBER)
      .text(statusText, M, y + 6, { width: W - 10, align: "right", lineBreak: false });
    y += 26;
  };

  const tabellenKopf = () => {
    doc.font("Bold").fontSize(7).fillColor(GRAU);
    doc.text("Zeit", ZEIT_X, y, { width: ZEIT_W, lineBreak: false });
    doc.text("Leistung", LEISTUNG_X, y, { width: LEISTUNG_W, lineBreak: false });
    doc.text("Menge", MENGE_X, y, { width: MENGE_W, align: "right", lineBreak: false });
    doc.text("Raum", RAUM_X, y, { width: RAUM_W, align: "right", lineBreak: false });
    doc.text("Status", STATUS_X, y, { width: STATUS_W, align: "right", lineBreak: false });
    y += 10;
    doc.save().moveTo(M, y).lineTo(M + W, y).lineWidth(0.4).strokeColor(HELL).stroke().restore();
    y += 5;
  };

  if (input.eintraege.length === 0) {
    doc.font("Regular").fontSize(9).fillColor(GRAU).text("Keine Anwendungen eingetragen.", M, y + 8);
    y += 28;
  }

  const sortierteTage = [...tage.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [tagIndex, [tag, liste]] of sortierteTage.entries()) {
    // Auf der letzten Inhaltsseite bleibt Platz für den Unterschriftsblock.
    const fussReserve = tagIndex === sortierteTage.length - 1 ? 58 : 0;
    // Tageskarte, Tabellenkopf und erste Zeile gehören zusammen auf eine Seite.
    if (y + 86 + fussReserve > INHALT_ENDE) neueSeite();
    tagesKopf(tag, liste);
    tabellenKopf();

    for (const [index, eintrag] of liste.entries()) {
      const zeit = [eintrag.zeitVon, eintrag.zeitBis].filter(Boolean).join("–") || "—";
      const mengeText = `${String(eintrag.menge).replace(".", ",")} ${eintrag.einheit}`;
      const raumText = eintrag.raum ?? "—";
      doc.font("Regular").fontSize(8);
      const leistungHoehe = doc.heightOfString(eintrag.leistung, { width: LEISTUNG_W });
      const zeitHoehe = doc.heightOfString(zeit, { width: ZEIT_W });
      const mengeHoehe = doc.heightOfString(mengeText, { width: MENGE_W });
      const raumHoehe = doc.heightOfString(raumText, { width: RAUM_W });
      const zusatz = [
        eintrag.therapeut?.trim() ? `Therapeut: ${eintrag.therapeut.trim()}` : null,
        eintrag.bemerkung?.trim() || null,
      ].filter(Boolean).join("\n");
      doc.fontSize(7);
      const zusatzHoehe = zusatz ? doc.heightOfString(zusatz, { width: LEISTUNG_W }) : 0;
      const grundHoehe = Math.max(15, leistungHoehe, zeitHoehe, mengeHoehe, raumHoehe) + 5;
      const zeilenHoehe = grundHoehe + (zusatz ? zusatzHoehe + 3 : 0);

      // Mitten im Tag umgebrochen: Datum und Spaltenköpfe wiederholen.
      if (y + zeilenHoehe + fussReserve > INHALT_ENDE) {
        neueSeite();
        tagesKopf(tag, liste, true);
        tabellenKopf();
      }

      const zeilenY = y;
      doc.font("Regular").fontSize(8).fillColor(DUNKEL);
      doc.text(zeit, ZEIT_X, zeilenY, { width: ZEIT_W });
      doc.text(eintrag.leistung, LEISTUNG_X, zeilenY, { width: LEISTUNG_W });
      doc.text(mengeText, MENGE_X, zeilenY, { width: MENGE_W, align: "right" });
      doc.text(raumText, RAUM_X, zeilenY, { width: RAUM_W, align: "right" });

      const statusLabel = STATUS_LABEL[eintrag.status] ?? eintrag.status;
      const badge = eintrag.status === "stattgefunden"
        ? { flaeche: "#dcfce7", text: GRUEN }
        : eintrag.status === "ausgefallen"
          ? { flaeche: "#fee2e2", text: "#991b1b" }
          : eintrag.status === "abgesagt"
            ? { flaeche: "#fef3c7", text: AMBER }
            : { flaeche: "#e7e5e4", text: GRAU };
      doc.save().roundedRect(STATUS_X, zeilenY - 1, STATUS_W, 13, 6).fill(badge.flaeche).restore();
      doc.font("Bold").fontSize(6.8).fillColor(badge.text)
        .text(statusLabel, STATUS_X, zeilenY + 2, { width: STATUS_W, align: "center", lineBreak: false });

      y = zeilenY + grundHoehe;
      if (zusatz) {
        doc.font("Regular").fontSize(7).fillColor(GRAU).text(zusatz, LEISTUNG_X, y - 1, { width: LEISTUNG_W });
        y += zusatzHoehe + 3;
      }
      if (index < liste.length - 1) {
        doc.save().moveTo(LEISTUNG_X, y - 2).lineTo(M + W, y - 2).lineWidth(0.25).strokeColor(HELL).stroke().restore();
      }
    }
    y += 10;
  }

  // Kompakter Fuß: Praxis-Ort/Datum + Unterschriftslinie auf der letzten Inhaltsseite.
  if (y + 58 > 800) neueSeite();
  const sigY = y + 10;
  doc.font("Regular").fontSize(8.5).fillColor(DUNKEL).text(`${input.praxis.ort}, den ${new Date().toLocaleDateString("de-DE")}`, M, sigY);
  doc.save().moveTo(M + W - 190, sigY + 30).lineTo(M + W - 20, sigY + 30).lineWidth(0.7).strokeColor(DUNKEL).stroke().restore();
  doc.font("Regular").fontSize(7).fillColor(GRAU).text("Unterschrift Praxis", M + W - 190, sigY + 34, { width: 170, align: "center" });

  doc.end();
  return fertig;
}

// ── XLSX: Rohdaten + Metadatenblatt ────────────────────────────────────────
export async function renderTherapieplanXlsx(input: ExportPlanInput): Promise<Buffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dr.PaWaWi (PraxiOS)";
  wb.created = new Date();

  // Blatt 1: Plan-Metadaten
  const meta = wb.addWorksheet("Plan");
  meta.columns = [{ width: 28 }, { width: 60 }];
  const zeilen: [string, string | number][] = [
    ["Titel", input.titel],
    ["Patient", input.patient.name],
    ["Geburtsdatum", input.patient.geburtsdatum ?? ""],
    ["Patienten-Nr.", input.patient.patientenNr ?? ""],
    ["Zeitraum", `${datumDe(input.vonDatum)}–${datumDe(input.bisDatum)}`],
    ["Status", input.status],
    ["Anwendungen gesamt", input.eintraege.length],
    ["davon erledigt", input.eintraege.filter((e) => e.status === "stattgefunden").length],
    ["Praxis", input.praxis.name],
    ["Erstellt am", new Date().toLocaleDateString("de-DE")],
  ];
  for (const [k, v] of zeilen) meta.addRow([k, v]);
  meta.getColumn(1).font = { bold: true };

  // Blatt 2: Rohdaten je Eintrag
  const ws = wb.addWorksheet("Einträge");
  ws.columns = [
    { header: "Datum", key: "datum", width: 12, style: { numFmt: "dd.mm.yyyy" } },
    { header: "Wochentag", key: "wochentag", width: 12 },
    { header: "Von", key: "zeitVon", width: 8 },
    { header: "Bis", key: "zeitBis", width: 8 },
    { header: "Leistung", key: "leistung", width: 44 },
    { header: "Menge", key: "menge", width: 10 },
    { header: "Einheit", key: "einheit", width: 10 },
    { header: "Raum", key: "raum", width: 12 },
    { header: "Therapeut", key: "therapeut", width: 20 },
    { header: "Status", key: "status", width: 14 },
    { header: "Bemerkung", key: "bemerkung", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const e of input.eintraege) {
    ws.addRow({
      datum: new Date(`${e.datum}T00:00:00Z`),
      wochentag: wochentag(e.datum),
      zeitVon: e.zeitVon ?? "",
      zeitBis: e.zeitBis ?? "",
      leistung: e.leistung,
      menge: Number(e.menge),
      einheit: e.einheit,
      raum: e.raum ?? "",
      therapeut: e.therapeut ?? "",
      status: STATUS_LABEL[e.status] ?? e.status,
      bemerkung: e.bemerkung ?? "",
    });
  }
  ws.autoFilter = { from: "A1", to: `K${ws.rowCount}` };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
