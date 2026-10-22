// ── PraxiOS: Heil- und Kostenplan (HKP) als DOCX (1.25.0) ──────────────────
// Word-Ausgabe zum Weiterbearbeiten (gleiche Struktur wie das PDF).
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { KostenplanPdfInput } from "./kostenplanPdf";
import { HKP_FUSSNOTE } from "./kostenplanPdf";

const AKZENT = "92610F";
const GRAU = "57534E";

function p(text: string, opts?: { fett?: boolean; groesse?: number; farbe?: string; abstandUnten?: number; italic?: boolean }): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: opts?.fett, italics: opts?.italic, size: opts?.groesse ?? 19, color: opts?.farbe }),
    ],
    spacing: { after: opts?.abstandUnten ?? 60 },
  });
}

export async function renderKostenplanDocx(input: KostenplanPdfInput): Promise<Buffer> {
  const geld = (v: number) =>
    new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const kinder: (Paragraph | Table)[] = [];

  // Briefkopf
  kinder.push(p(input.praxis.name, { fett: true, groesse: 28, farbe: AKZENT }));
  kinder.push(p(`${input.praxis.strasse} · ${input.praxis.plz} ${input.praxis.ort}`, { groesse: 16, farbe: GRAU }));
  const kontakt = [input.praxis.telefon ? `Tel. ${input.praxis.telefon}` : null, input.praxis.email].filter(Boolean).join(" · ");
  if (kontakt) kinder.push(p(kontakt, { groesse: 16, farbe: GRAU }));
  kinder.push(p("", { abstandUnten: 200 }));

  // Titel
  kinder.push(p(input.titel, { fett: true, groesse: 32 }));
  kinder.push(p(
    `${input.nummer} · Datum: ${input.datum}${input.zeitraum ? ` · Zeitraum: ${input.zeitraum}` : ""}`,
    { groesse: 17, farbe: GRAU, abstandUnten: 200 },
  ));

  // Patient
  const geb = input.patient.geburtsdatum ? `, geb. am ${input.patient.geburtsdatum}` : "";
  const adresse = [input.patient.strasse, [input.patient.plz, input.patient.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  kinder.push(p(`${input.patient.name}${geb}`, { fett: true, groesse: 20 }));
  if (adresse) kinder.push(p(adresse, { groesse: 17, farbe: GRAU, abstandUnten: 160 }));

  // Diagnosen
  if (input.diagnosen?.length) {
    kinder.push(p("Diagnosen (ICD-10)", { fett: true, groesse: 19, farbe: AKZENT, abstandUnten: 120 }));
    for (const d of input.diagnosen) {
      kinder.push(p(`${d.code} — ${d.text}`, { groesse: 17 }));
      if (d.kurzbegruendung) kinder.push(p(d.kurzbegruendung, { italic: true, groesse: 16, farbe: GRAU }));
    }
    kinder.push(p("", { abstandUnten: 120 }));
  }

  // Begründung
  if (input.begruendung?.trim()) {
    kinder.push(p("Pathophysiologische Begründung", { fett: true, groesse: 19, farbe: AKZENT, abstandUnten: 120 }));
    kinder.push(p(input.begruendung.trim(), { groesse: 17, abstandUnten: 200 }));
  }

  // Kostenaufstellung (Tabelle)
  kinder.push(p("Kostenaufstellung", { fett: true, groesse: 19, farbe: AKZENT, abstandUnten: 120 }));
  const zeileKopf = new TableRow({
    children: ["Pos.", "Bezeichnung", "Menge", "Preis", "USt.", "Betrag"].map(
      (t) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 16 })] })],
        }),
    ),
  });
  const zeilen: TableRow[] = [zeileKopf];
  let summeNetto = 0;
  let summeUst = 0;
  const gruppen = new Map<string, typeof input.positionen>();
  for (const pos of input.positionen) {
    const g = pos.gruppe?.trim() || "Positionen";
    gruppen.set(g, [...(gruppen.get(g) ?? []), pos]);
  }
  for (const [gruppe, positionen] of gruppen) {
    if (gruppen.size > 1) {
      zeilen.push(new TableRow({
        children: [new TableCell({
          columnSpan: 6,
          children: [new Paragraph({ children: [new TextRun({ text: gruppe, bold: true, size: 17, color: AKZENT })] })],
          borders: { top: { style: BorderStyle.SINGLE, size: 4, color: "E7E0D5" } },
        })],
      }));
    }
    let gruppenNetto = 0;
    positionen.forEach((pos, i) => {
      const betrag = Number(pos.menge) * Number(pos.einzelpreis);
      const ust = betrag * (pos.ustSatz / 100);
      summeNetto += betrag;
      summeUst += ust;
      gruppenNetto += betrag;
      const bez = pos.goaeText ? `${pos.bezeichnung} — ${pos.goaeText}` : pos.bezeichnung;
      zeilen.push(new TableRow({
        children: [
          String(i + 1),
          bez + (pos.beschreibung?.trim() ? `\n${pos.beschreibung.trim()}` : ""),
          new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(Number(pos.menge)),
          `${geld(Number(pos.einzelpreis))} €`,
          pos.ustSatz === 0 ? "0 %" : `${pos.ustSatz} %`,
          `${geld(betrag)} €`,
        ].map((t, j) => new TableCell({
          children: [new Paragraph({
            alignment: j >= 2 ? AlignmentType.RIGHT : AlignmentType.LEFT,
            children: [new TextRun({ text: t, size: 16 })],
          })],
        })),
      }));
    });
    if (gruppen.size > 1) {
      zeilen.push(new TableRow({
        children: [
          new TableCell({ columnSpan: 5, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Zwischensumme ${gruppe}`, bold: true, size: 16, color: GRAU })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${geld(gruppenNetto)} €`, bold: true, size: 16 })] })] }),
        ],
      }));
    }
  }
  // Summen
  zeilen.push(new TableRow({
    children: [new TableCell({ columnSpan: 5, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Summe netto", size: 16 })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${geld(summeNetto)} €`, bold: true, size: 16 })] })] })],
  }));
  if (summeUst > 0.005) {
    zeilen.push(new TableRow({
      children: [new TableCell({ columnSpan: 5, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Umsatzsteuer", size: 16 })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${geld(summeUst)} €`, size: 16 })] })] })],
    }));
  }
  zeilen.push(new TableRow({
    children: [new TableCell({ columnSpan: 5, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Gesamtkosten", bold: true, size: 20, color: AKZENT })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${geld(summeNetto + summeUst)} €`, bold: true, size: 20 })] })] })],
  }));

  kinder.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: zeilen,
  }));

  // Klartext-Note
  if (input.klartextNote?.trim()) {
    kinder.push(p("", { abstandUnten: 120 }));
    kinder.push(p(input.klartextNote.trim(), { groesse: 15, farbe: GRAU }));
  }

  // Feste Rechts-Fußnote (1.27.0, Bus #179): beide Typen, immer
  kinder.push(p("", { abstandUnten: 100 }));
  kinder.push(p(HKP_FUSSNOTE, { groesse: 14, farbe: GRAU }));

  // Unterschriften
  kinder.push(p("", { abstandUnten: 400 }));
  kinder.push(p(`${input.praxis.ort}, den ${input.datum}`, { groesse: 17 }));
  kinder.push(p("", { abstandUnten: 400 }));
  kinder.push(p("_________________________          _________________________", { groesse: 16 }));
  kinder.push(p("Unterschrift Heilberufler/in          Unterschrift Patient/in (Kenntnisnahme & Kostenübernahme)", { groesse: 14, farbe: GRAU }));

  const docu = new Document({
    creator: "Dr.PaWaWi (PraxiOS)",
    title: `${input.titel} ${input.nummer}`,
    sections: [{ children: kinder }],
  });
  return Packer.toBuffer(docu);
}
