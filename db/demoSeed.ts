/**
 * Demo-Seed für die demopa-Instanz (Praxis-Musterdaten).
 * Aufruf auf der Demo-Instanz:  npx tsx db/demoSeed.ts
 * Idempotent: läuft nur, wenn die Markierung DEMO-001 noch nicht existiert.
 */
import { getDb } from "../api/queries/connection";
import {
  anamnesisForms,
  companySettings,
  customers,
  gruppen,
  incomingInvoices,
  invoices,
  invoiceItems,
  kollegen,
  numberSequences,
  planEntries,
  postEingang,
  products,
  protokolle,
  protokollVorlagen,
  therapyPlans,
  timelineEvents,
  users,
} from "./schema";
import { DRX_BOGEN } from "./anamneseDrx";
import { hashPassword } from "../api/lib/password";
import { STANDARD_GRUPPEN } from "../contracts/constants";
import { formatInvoiceNumber } from "../api/queries/invoicing";
import { eq, like } from "drizzle-orm";
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import crypto from "node:crypto";

const DEMO_PASSWORT = "pawawi-demo"; // steht auf der Demo-Landingpage (/demo/)

function fontPath(name: string): string {
  return path.join(process.cwd(), "api", "assets", "fonts", name);
}

async function demoBelegPdf(): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50, font: fontPath("DejaVuSans.ttf") });
  doc.registerFont("Bold", fontPath("DejaVuSans-Bold.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fertig = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  doc.font("Bold").fontSize(14).text("Praxisbedarf Müller GmbH");
  doc.fontSize(9).text("Lieferweg 7 · 14476 Potsdam");
  doc.moveDown(1.5);
  doc.font("Bold").fontSize(12).text("RECHNUNG Nr. 2026-118");
  doc.fontSize(10).text("Rechnungsdatum: 05.08.2026 · Fällig: 19.08.2026");
  doc.moveDown(1);
  doc.fontSize(10);
  doc.text("10× Einmalhandschuhe Nitril Gr. M (100er)      89,00 €");
  doc.text(" 4× Desinfektionsmittel 1 l                    48,00 €");
  doc.text(" 2× Auflagenrollen 50 cm                        18,00 €");
  doc.moveDown(0.5);
  doc.text("Zwischensumme netto: 155,00 €");
  doc.text("USt. 19 %: 29,45 €");
  doc.font("Bold").text("Gesamt brutto: 184,45 €");
  doc.moveDown(1);
  doc.fontSize(9).text("IBAN: DE41 1203 0000 0012 3456 78 · Bitte unter Angabe der Rechnungsnummer überweisen.");
  doc.end();
  return fertig;
}

async function main() {
  const db = getDb();

  const schonDa = await db.query.customers.findFirst({
    where: eq(customers.patientenNr, "DEMO-001"),
  });
  if (schonDa) {
    console.log("[demo-seed] Musterdaten existieren bereits (DEMO-001) — nichts zu tun.");
    return;
  }
  console.log("[demo-seed] Lege Praxis-Musterdaten an …");

  // ── Praxisdaten (nur Anzeige-Felder; Secrets der Instanz bleiben) ─────────
  await db
    .insert(companySettings)
    .values({
      id: 1,
      name: "Praxis Dr. Demo",
      strasse: "Klinikweg 12",
      plz: "14480",
      ort: "Potsdam",
      email: "praxis@demo.local",
      telefon: "0331 / 000 000",
      fussText: "Demo-Instanz — wird täglich zurückgesetzt.",
    } as never)
    .onDuplicateKeyUpdate({
      set: {
        name: "Praxis Dr. Demo",
        strasse: "Klinikweg 12",
        plz: "14480",
        ort: "Potsdam",
        email: "praxis@demo.local",
        telefon: "0331 / 000 000",
      } as never,
    });

  // age-Schlüsselpaar für die Austausch-Seite (Demo-Werte, keine echten Geheimnisse)
  const { generateIdentity, identityToRecipient } = await import("age-encryption");
  const identitaet = await generateIdentity();
  await db
    .update(companySettings)
    .set({ ageRecipient: await identityToRecipient(identitaet), ageSecret: identitaet })
    .where(eq(companySettings.id, 1));

  // ── Rollen-Gruppen sicherstellen ──────────────────────────────────────────
  for (const g of STANDARD_GRUPPEN) {
    const vorhanden = await db.query.gruppen.findFirst({ where: eq(gruppen.name, g.name) });
    if (!vorhanden) {
      await db.insert(gruppen).values({ name: g.name, rechte: JSON.stringify(g.rechte) });
    }
  }
  const medGruppe = await db.query.gruppen.findFirst({
    where: eq(gruppen.name, "Med. Personal"),
  });

  // ── Benutzer: demo-Login + zwei Therapeuten mit Kalenderfarben ────────────
  const hash = hashPassword(DEMO_PASSWORT);
  const [demoAdmin] = await db
    .insert(users)
    .values({
      unionId: "demo-user-admin",
      username: "demo",
      passwordHash: hash,
      name: "Dr. Demo",
      email: "demo@demo.local",
      role: "admin",
    })
    .$returningId()
    .catch(async () => {
      const vorhanden = await db.query.users.findFirst({ where: eq(users.username, "demo") });
      return [vorhanden!];
    });

  const therapeuten: { username: string; name: string; farbe: string; id?: number }[] = [
    { username: "lena", name: "Lena Behrend", farbe: "#0F766E" },
    { username: "jonas", name: "Jonas Krüger", farbe: "#B45309" },
  ];
  for (const t of therapeuten) {
    const [row] = await db
      .insert(users)
      .values({
        unionId: `demo-user-${t.username}`,
        username: t.username,
        passwordHash: hash,
        name: t.name,
        role: "user",
        kalenderFarbe: t.farbe,
        gruppeId: medGruppe?.id ?? null,
      })
      .$returningId()
      .catch(async () => {
        const vorhanden = await db.query.users.findFirst({ where: eq(users.username, t.username) });
        return [vorhanden!];
      });
    t.id = row.id;
  }
  const lenaId = therapeuten[0].id!;
  const jonasId = therapeuten[1].id!;

  // ── Patienten ─────────────────────────────────────────────────────────────
  const patientenDaten = [
    { nr: "DEMO-001", name: "Schneider, Maria", geb: "1958-03-17", kasse: "AOK Nordost", tags: "borreliose,apherese", strasse: "Lindenallee 5" },
    { nr: "DEMO-002", name: "Weber, Thomas", geb: "1974-11-02", kasse: "Barmer", tags: "infusionstherapie", strasse: "Am Kanal 21" },
    { nr: "DEMO-003", name: "Yilmaz, Ayse", geb: "1989-06-25", kasse: "Techniker", tags: "erschöpfung", strasse: "Bergstr. 8" },
    { nr: "DEMO-004", name: "Kowalski, Jan", geb: "1966-01-30", kasse: "SBK", tags: "", strasse: "Feldweg 14" },
    { nr: "DEMO-005", name: "Neumann, Greta", geb: "1949-09-12", kasse: "AOK Nordost", tags: "nachsorge", strasse: "Ringstr. 3" },
    { nr: "DEMO-006", name: "Hoffmann, Ben", geb: "2001-04-08", kasse: "Barmer", tags: "sportmedizin", strasse: "Seestr. 40" },
  ] as const;
  const patientIds: Record<string, number> = {};
  for (const p of patientenDaten) {
    const [{ id }] = await db
      .insert(customers)
      .values({
        name: p.name,
        strasse: p.strasse,
        plz: "14480",
        ort: "Potsdam",
        email: `${p.nr.toLowerCase()}@beispiel.invalid`,
        telefon: "0151 / 000 000",
        geburtsdatum: p.geb,
        patientenNr: p.nr,
        krankenkasse: p.kasse,
        tags: p.tags || null,
      })
      .$returningId();
    patientIds[p.nr] = id;
  }
  const maria = patientIds["DEMO-001"];
  const thomas = patientIds["DEMO-002"];

  const kollegeRecipient = await identityToRecipient(await generateIdentity());
  console.log("[demo-seed] Patienten + Benutzer ok — Pläne, Protokolle, Abrechnung …");
  return { db, maria, thomas, lenaId, jonasId, demoAdminId: demoAdmin.id, kollegeRecipient };
}

// Teil 2 (Pläne/Protokolle/Abrechnung) in seedTeil2, damit main() lesbar bleibt
export async function seedTeil2(ctx: {
  db: ReturnType<typeof getDb>;
  maria: number;
  thomas: number;
  lenaId: number;
  jonasId: number;
  demoAdminId: number;
  kollegeRecipient: string;
}) {
  const { db, maria, thomas, lenaId, jonasId, demoAdminId, kollegeRecipient } = ctx;

  // ── Therapieplan mit dokumentierter Woche (Mo 10.08. – Fr 14.08.2026) ────
  const [{ id: planId }] = await db
    .insert(therapyPlans)
    .values({
      patientId: maria,
      titel: "Borreliose-Behandlung, Serie 3",
      vonDatum: "2026-08-10",
      bisDatum: "2026-08-28",
      diagnoseZiele: "Borreliose (ICD A69.2) — Ziel: Belastbarkeit, Reduktion Erschöpfung",
      status: "aktiv",
      createdBy: demoAdminId,
    })
    .$returningId();

  const eintraege = [
    { datum: "2026-08-10", von: "09:00", bis: "10:30", text: "Infusion (Clindamycin)", therapeut: lenaId, status: "stattgefunden" as const, menge: "1" },
    { datum: "2026-08-10", von: "10:45", bis: "11:15", text: "Vitale Kontrolle + Gespräch", therapeut: jonasId, status: "stattgefunden" as const, menge: "1" },
    { datum: "2026-08-11", von: "09:00", bis: "10:30", text: "Infusion (Clindamycin)", therapeut: lenaId, status: "stattgefunden" as const, menge: "1" },
    { datum: "2026-08-12", von: "09:00", bis: "10:30", text: "Infusion (Clindamycin)", therapeut: lenaId, status: "geplant" as const, menge: "1" },
    { datum: "2026-08-13", von: "09:00", bis: "10:30", text: "Infusion (Clindamycin)", therapeut: lenaId, status: "geplant" as const, menge: "1" },
    { datum: "2026-08-13", von: "11:00", bis: "11:30", text: "Hyperthermie", therapeut: jonasId, status: "geplant" as const, menge: "1" },
    { datum: "2026-08-14", von: "09:00", bis: "09:45", text: "Abschlussgespräch + Labor", therapeut: lenaId, status: "geplant" as const, menge: "1" },
  ];
  await db.insert(planEntries).values(
    eintraege.map((e, i) => ({
      planId,
      datum: e.datum,
      zeitVon: e.von,
      zeitBis: e.bis,
      leistungText: e.text,
      menge: e.menge,
      therapeutId: e.therapeut,
      raum: i % 2 === 0 ? "Raum 1" : "Raum 2",
      status: e.status,
    })),
  );

  const [{ id: planB }] = await db
    .insert(therapyPlans)
    .values({
      patientId: thomas,
      titel: "Infusionstherapie Aufbau",
      vonDatum: "2026-08-17",
      bisDatum: "2026-08-28",
      status: "geplant",
      createdBy: demoAdminId,
    })
    .$returningId();
  await db.insert(planEntries).values(
    ["2026-08-17", "2026-08-19", "2026-08-21"].map((datum, i) => ({
      planId: planB,
      datum,
      zeitVon: "14:00",
      zeitBis: "15:30",
      leistungText: "Aufbau-Infusion",
      menge: "1",
      therapeutId: jonasId,
      raum: "Raum 2",
      status: "geplant" as const,
    })),
  );

  // ── Protokoll-Vorlage + ausgefülltes Protokoll (mit Diagramm-Daten) ───────
  const [{ id: vorlageId }] = await db
    .insert(protokollVorlagen)
    .values({
      titel: "Infusionsprotokoll (Standard)",
      beschreibung: "Vitalparameter-Verlauf + Befindlichkeit bei Infusionstherapien",
      schemaJson: JSON.stringify([
        { id: "t1", typ: "text", titel: "Bemerkungen vor Beginn", inhalt: "" },
        { id: "v1", typ: "vital", titel: "Vitalparameter", spalten: 3, felder: [] },
        { id: "s1", typ: "skala", titel: "Befindlichkeit (1–10)", wert: null },
      ]),
      createdBy: demoAdminId,
    })
    .$returningId();

  await db.insert(protokolle).values({
    patientId: maria,
    vorlageId,
    titel: "Infusionsprotokoll 10.08.2026",
    schemaJson: JSON.stringify([
      { id: "t1", typ: "text", titel: "Bemerkungen vor Beginn", inhalt: "Pat. gut aufgelegt, Schlaf besser als letzte Woche. Venenzugang links problemlos." },
      {
        id: "v1", typ: "vital", titel: "Vitalparameter", spalten: 3,
        felder: [
          { label: "Zeitpunkt", wert: "09:05" },
          { label: "RR systolisch (mmHg)", wert: "128" },
          { label: "RR diastolisch (mmHg)", wert: "82" },
          { label: "Puls (/min)", wert: "74" },
          { label: "Temperatur (°C)", wert: "36,4" },
          { label: "SpO₂ (%)", wert: "98" },
        ],
      },
      {
        id: "tab1", typ: "tabelle", titel: "Verlauf während der Infusion",
        spalten: ["Zeit", "RR sys", "Puls", "Temp"],
        zeilen: [
          ["09:00", "128", "74", "36,4"],
          ["09:30", "124", "72", "36,5"],
          ["10:00", "121", "70", "36,5"],
          ["10:30", "118", "68", "36,6"],
        ],
        diagramm: true,
      },
      { id: "s1", typ: "skala", titel: "Befindlichkeit (1–10)", wert: 3 },
    ]),
    createdBy: lenaId,
  });

  // ── Dr.-X-Musterbogen anlegen (Anamnese sofort zeigbar) ───────────────────
  await db.insert(anamnesisForms).values({
    titel: DRX_BOGEN.titel,
    beschreibung: DRX_BOGEN.beschreibung,
    schemaJson: JSON.stringify(DRX_BOGEN.bloecke),
    createdBy: demoAdminId,
  });

  // ── Abrechnung: Rechnung (finalisiert), Vorkasse (bezahlt), Schlussrechnung mit Depot ──
  const jahr = 2026;
  await db
    .insert(numberSequences)
    .values({ typ: "invoice", jahr, letzteNummer: 2 })
    .onDuplicateKeyUpdate({ set: { letzteNummer: 2 } });

  const snapshotKunde = (name: string, strasse: string) => ({
    kundeName: name,
    kundeStrasse: strasse,
    kundePlz: "14480",
    kundeOrt: "Potsdam",
    kundeLand: "Deutschland",
  });
  const firmaSnapshot = JSON.stringify({
    name: "Praxis Dr. Demo",
    strasse: "Klinikweg 12",
    plz: "14480",
    ort: "Potsdam",
    land: "Deutschland",
  });

  const [{ id: rechnungId }] = await db
    .insert(invoices)
    .values({
      nummer: formatInvoiceNumber(jahr, 1),
      status: "finalisiert",
      customerId: maria,
      rechnungsdatum: "2026-08-10",
      faelligkeitsdatum: "2026-08-24",
      leistungsdatum: "KW 32/2026",
      ...snapshotKunde("Schneider, Maria", "Lindenallee 5"),
      firmenSnapshot: firmaSnapshot,
      netto: "470.00",
      ust: "0.00",
      brutto: "470.00",
      finalizedAt: new Date("2026-08-10T16:00:00"),
    })
    .$returningId();
  await db.insert(invoiceItems).values([
    { invoiceId: rechnungId, position: 1, bezeichnung: "Infusionstherapie (Clindamycin)", beschreibung: "Mo, 10.08.2026 · GOÄ 272", menge: "2", einheit: "Anwendung", einzelpreis: "180.00", ustSatz: 0 },
    { invoiceId: rechnungId, position: 2, bezeichnung: "Vitale Kontrolle + Beratung", beschreibung: "Mo, 10.08.2026 · GOÄ 1", menge: "1", einheit: "Anwendung", einzelpreis: "40.00", ustSatz: 0 },
    { invoiceId: rechnungId, position: 3, bezeichnung: "Verbrauchsmaterial (§ 10 GOÄ)", beschreibung: "10.08.2026", menge: "1", einheit: "Pauschale", einzelpreis: "70.00", ustSatz: 0 },
  ]);

  const [{ id: proformaId }] = await db
    .insert(invoices)
    .values({
      typ: "proforma",
      status: "finalisiert",
      customerId: thomas,
      rechnungsdatum: "2026-07-27",
      faelligkeitsdatum: "2026-08-10",
      ...snapshotKunde("Weber, Thomas", "Am Kanal 21"),
      firmenSnapshot: firmaSnapshot,
      netto: "900.00",
      ust: "0.00",
      brutto: "900.00",
      bezahltBetrag: "500.00",
      bezahltAm: "2026-08-03",
      finalizedAt: new Date("2026-07-27T10:00:00"),
    })
    .$returningId();
  await db.insert(invoiceItems).values([
    { invoiceId: proformaId, position: 1, bezeichnung: "Therapiepaket Aufbau-Infusionen (10 Einheiten)", beschreibung: "Vorkasse/Therapiedepot", menge: "1", einheit: "Pauschale", einzelpreis: "900.00", ustSatz: 0 },
  ]);

  const [{ id: schlussId }] = await db
    .insert(invoices)
    .values({
      nummer: formatInvoiceNumber(jahr, 2),
      status: "finalisiert",
      customerId: thomas,
      rechnungsdatum: "2026-08-10",
      faelligkeitsdatum: "2026-08-24",
      ...snapshotKunde("Weber, Thomas", "Am Kanal 21"),
      firmenSnapshot: firmaSnapshot,
      netto: "900.00",
      ust: "0.00",
      brutto: "900.00",
      abschlagBetrag: "500.00",
      proformaVonId: proformaId,
      finalizedAt: new Date("2026-08-10T17:00:00"),
    })
    .$returningId();
  await db.insert(invoiceItems).values([
    { invoiceId: schlussId, position: 1, bezeichnung: "Therapiepaket Aufbau-Infusionen (10 Einheiten)", beschreibung: "Schlussrechnung — Abzug Vorkasse siehe Summenblock", menge: "1", einheit: "Pauschale", einzelpreis: "900.00", ustSatz: 0 },
  ]);

  // ── Post Manager: ein ungebuchter Beleg (OCR-Übungsstück) ────────────────
  const belegPdf = await demoBelegPdf();
  await db.insert(postEingang).values({
    typ: "rechnung",
    status: "neu",
    originalname: "Scan-Mueller-GmbH-2026-118.pdf",
    mime: "application/pdf",
    groesse: belegPdf.length,
    dateiInhalt: belegPdf.toString("base64"),
    absenderFreitext: "Praxisbedarf Müller GmbH",
    rechnungsnummer: "2026-118",
    betrag: "184.45",
    ustSatz: 19,
    rechnungsdatum: "2026-08-05",
    faelligAm: "2026-08-19",
    quelle: "demo-seed",
  });

  // ── Kollege + Chronik ─────────────────────────────────────────────────────
  await db.insert(kollegen).values({
    name: "Gemeinschaftspraxis Dr. Sommer",
    notiz: "Dr. med. A. Sommer · sommer@beispiel.invalid",
    ageRecipient: kollegeRecipient,
  });

  await db.insert(timelineEvents).values([
    { patientId: maria, typ: "plan" as const, titel: "Therapieplan Serie 3 begonnen", beschreibung: "Borreliose-Behandlung, 3 Wochen", datum: "2026-08-10", createdBy: demoAdminId },
    { patientId: maria, typ: "dokument" as const, titel: "Infusionsprotokoll dokumentiert", beschreibung: "Vitalparameter stabil", datum: "2026-08-10", createdBy: lenaId },
    { patientId: thomas, typ: "dokument" as const, titel: "Vorkasse Therapiedepot bezahlt", beschreibung: "500,00 € von 900,00 €", datum: "2026-08-03", createdBy: demoAdminId },
  ]);

  console.log("[demo-seed] FERTIG — Login: demo / pawawi-demo");
}

main()
  .then(async (ctx) => {
    if (ctx) await seedTeil2(ctx);
    process.exit(0);
  })
  .catch((e) => {
    console.error("[demo-seed] FEHLER:", e);
    process.exit(1);
  });
