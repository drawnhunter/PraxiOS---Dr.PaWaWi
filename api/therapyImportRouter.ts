// ── Dr.ReWaWi: Therapieplan-Import ─────────────────────────────────────────────
// Kern-Workflow: IMTZ-Wochendokumentation (XLSX/CSV) importieren ->
// 1 Rechnung (Entwurf) pro Patient über alle gewählten Wochen.
// Unklarheiten landen im Report (TXT/PDF) zum Zurückschicken an IMTZ.
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import {
  invoices,
  invoiceItems,
  invoiceTherapieWochen,
  therapyImports,
  customers,
  products,
  konditionen,
  companySettings,
  bankAccounts,
} from "@db/schema";
import { computeTotals, centToDecimal } from "@contracts/invoicing";
import type {
  AnalyseErgebnis,
  ImportErgebnis,
  ImportPosition,
  PatientVorschau,
  Unklarheit,
} from "@contracts/therapy";
import {
  ABSCHNITT_LEISTUNGEN,
  ABSCHNITT_AUSLAGEN,
} from "@contracts/therapy";
import {
  parseTherapieplan,
  blaetterDesPlans,
  normBasis as norm,
  normKompakt as normKomprimiert,
  normMenge,
  type PlanEintrag,
} from "./therapyPlan";
import { baueReportText, renderReportPdf } from "./therapyReport";

const dateiInput = z.object({
  dateiname: z.string().min(1),
  base64: z.string().min(1),
  jahr: z.number().int().min(2000).max(2100),
  sheets: z.array(z.string()).min(1),
});

type Produkt = typeof products.$inferSelect;
type Kunde = typeof customers.$inferSelect;

interface AnalyseKontext {
  katalog: Map<string, Produkt>; // norm + normKomprimiert + normMenge + Aliasse -> Produkt
  kunden: Kunde[];
  belegteWochen: Map<string, { nummer: string | null; invoiceId: number; status: string }>;
  konditionen: Map<string, string>; // "kundeId|produktId" -> Sonderpreis
}

function katalogIndex(produktListe: Produkt[]): Map<string, Produkt> {
  const map = new Map<string, Produkt>();
  const setze = (schluessel: string, p: Produkt) => {
    if (schluessel && !map.has(schluessel)) map.set(schluessel, p);
  };
  const indexiere = (bezeichnung: string, p: Produkt) => {
    setze(norm(bezeichnung), p);
    setze(normKomprimiert(bezeichnung), p);
    setze(normMenge(bezeichnung), p);
  };
  for (const p of produktListe) {
    indexiere(p.name, p);
    for (const alias of (p.importNamen ?? "").split(/[\n;]/)) {
      const a = alias.trim();
      if (a) indexiere(a, p);
    }
  }
  return map;
}

function findeProdukt(katalog: Map<string, Produkt>, name: string): Produkt | null {
  // „(?)"-Marker vor dem Abgleich entfernen (Unsicherheit wird separat gemeldet)
  const sauber = name.replace(/\(\s*\?\s*\)/g, "").trim();
  return (
    katalog.get(norm(sauber)) ??
    katalog.get(normKomprimiert(sauber)) ??
    katalog.get(normMenge(sauber)) ??
    null
  );
}

function nachname(name: string): string {
  const i = name.indexOf(",");
  return norm(i >= 0 ? name.slice(0, i) : name);
}

function findeKunde(kunden: Kunde[], patientName: string): { kunde: Kunde; abweichung: boolean } | null {
  const n = norm(patientName);
  const exakt = kunden.find((k) => norm(k.name) === n);
  if (exakt) return { kunde: exakt, abweichung: false };
  const nn = nachname(patientName);
  if (!nn) return null;
  const treffer = kunden.filter((k) => nachname(k.name) === nn);
  if (treffer.length === 1) return { kunde: treffer[0], abweichung: true };
  return null;
}

const fmtDe = (iso: string) => {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
};

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function tagKurz(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return `${WOCHENTAGE[d.getUTCDay()]}, ${fmtDe(iso)}`;
}

// ── Analyse (geteilt zwischen Vorschau und Import) ──────────────────────────
async function analysiere(
  input: z.infer<typeof dateiInput>,
): Promise<AnalyseErgebnis & { kontext: AnalyseKontext }> {
  const db = getDb();
  const { eintraege, probleme, patientenInfos } = parseTherapieplan(
    input.dateiname,
    input.base64,
    input.jahr,
    input.sheets,
  );

  const [produktListe, kundenListe, wochenListe, konditionenListe] = await Promise.all([
    db.query.products.findMany({ where: eq(products.aktiv, true) }),
    db.query.customers.findMany({ where: eq(customers.archiviert, false) }),
    db
      .select({
        customerId: invoiceTherapieWochen.customerId,
        jahr: invoiceTherapieWochen.jahr,
        kw: invoiceTherapieWochen.kw,
        invoiceId: invoiceTherapieWochen.invoiceId,
        nummer: invoices.nummer,
        status: invoices.status,
      })
      .from(invoiceTherapieWochen)
      .innerJoin(invoices, eq(invoices.id, invoiceTherapieWochen.invoiceId)),
    // Patienten-Sonderpreise (Konditionen) — haben Vorrang vor Katalogpreis
    db
      .select({
        partnerId: konditionen.partnerId,
        productId: konditionen.productId,
        preisNetto: konditionen.preisNetto,
      })
      .from(konditionen),
  ]);

  const kontext: AnalyseKontext = {
    katalog: katalogIndex(produktListe),
    kunden: kundenListe,
    belegteWochen: new Map(
      wochenListe.map((w) => [
        `${w.customerId}|${w.jahr}|${w.kw}`,
        { nummer: w.nummer, invoiceId: w.invoiceId, status: w.status },
      ]),
    ),
    konditionen: new Map(
      konditionenListe.map((k) => [`${k.partnerId}|${k.productId}`, k.preisNetto]),
    ),
  };

  const unklarheiten: Unklarheit[] = [...probleme];
  const uebersprungen: { patient: string; grund: string }[] = [];

  // Gruppierung: ein Patient (über alle gewählten Wochen) = eine Rechnung
  const nachPatient = new Map<string, PlanEintrag[]>();
  for (const e of eintraege) {
    const key = norm(e.patient) || "(ohne namen)";
    if (!nachPatient.has(key)) nachPatient.set(key, []);
    nachPatient.get(key)!.push(e);
  }

  const patienten: PatientVorschau[] = [];

  for (const gruppe of nachPatient.values()) {
    const patientName = gruppe[0].patient || "(ohne Namen)";
    const eigeneUnklarheiten: Unklarheit[] = [];
    const melde = (u: Unklarheit) => {
      eigeneUnklarheiten.push(u);
      unklarheiten.push(u);
    };

    // Patientendaten aus der Vorlage (v2); null, wenn der Block keine enthält
    const infoRoh = patientenInfos[norm(patientName) || "(ohne namen)"] ?? null;
    const info =
      infoRoh &&
      (infoRoh.strasse ||
        infoRoh.plz ||
        infoRoh.ort ||
        infoRoh.geburtsdatum ||
        infoRoh.patientenNr ||
        infoRoh.email ||
        infoRoh.telefon ||
        infoRoh.empfaengerAbweichend)
        ? infoRoh
        : null;

    // Patientenstamm-Matching
    const treffer = patientName === "(ohne Namen)" ? null : findeKunde(kundenListe, patientName);
    let kundeNeu = false;
    if (!treffer) {
      kundeNeu = true;
      // Neuanlage: mit den Daten aus der Vorlage — nur fehlende Felder melden
      const fehlend: string[] = [];
      if (!info?.strasse || !info?.plz || !info?.ort) fehlend.push("Adresse");
      if (!info?.geburtsdatum) fehlend.push("Geburtsdatum");
      if (fehlend.length > 0) {
        melde({
          sheet: null,
          zeile: null,
          patient: patientName,
          grund: `Patient „${patientName}“ nicht im Stamm — wird neu angelegt; aus der Vorlage fehlen: ${fehlend.join(", ")}`,
        });
      }
    } else if (treffer.abweichung) {
      melde({
        sheet: null,
        zeile: null,
        patient: patientName,
        grund: `Namensabweichung: Vorlage „${patientName}“ vs. Stamm „${treffer.kunde.name}“ — bitte prüfen`,
      });
    }
    const kunde = treffer?.kunde ?? null;
    // Stamm-Adresse unvollständig UND die Vorlage liefert es auch nicht -> melden
    if (kunde) {
      const fehlendStamm: string[] = [];
      if (!kunde.strasse && !info?.strasse) fehlendStamm.push("Straße");
      if (!kunde.plz && !info?.plz) fehlendStamm.push("PLZ");
      if (!kunde.ort && !info?.ort) fehlendStamm.push("Ort");
      if (fehlendStamm.length > 0) {
        melde({
          sheet: null,
          zeile: null,
          patient: patientName,
          grund: `Adresse von „${kunde.name}“ unvollständig (${fehlendStamm.join(", ")} fehlt) — bitte ergänzen`,
        });
      }
    }
    // Abweichender Rechnungsempfänger -> immer Rückfrage
    if (info?.empfaengerAbweichend) {
      melde({
        sheet: null,
        zeile: null,
        patient: patientName,
        grund: `Rechnungsempfänger abweichend${info.empfaengerText ? `: ${info.empfaengerText}` : " (kein Empfänger angegeben)"} — bitte prüfen und der Rechnung zuordnen`,
      });
    }

    // Duplikatsschutz: Woche + Patient bereits berechnet?
    const wochen = [...new Map(gruppe.map((e) => [`${input.jahr}|${e.kw}`, { jahr: input.jahr, kw: e.kw }])).values()];
    if (kunde) {
      const doppelt = wochen
        .map((w) => ({ w, belegt: kontext.belegteWochen.get(`${kunde.id}|${w.jahr}|${w.kw}`) }))
        .filter((x) => x.belegt);
      if (doppelt.length > 0) {
        const liste = doppelt
          .map((x) => `KW ${x.w.kw} bereits in Rechnung ${x.belegt!.nummer ?? `#${x.belegt!.invoiceId}`} (${x.belegt!.status})`)
          .join("; ");
        melde({
          sheet: null,
          zeile: null,
          patient: patientName,
          grund: `Bereits berechnet: ${liste} — Patient wird übersprungen`,
        });
        uebersprungen.push({ patient: patientName, grund: `Duplikat: ${liste}` });
        continue;
      }
    }

    // Positionen: Leistung -> Katalog -> Preis
    const posMap = new Map<string, ImportPosition & { mengeZahl: number }>();
    for (const e of gruppe) {
      if (!e.datum) {
        melde({
          sheet: e.sheet,
          zeile: e.zeile,
          patient: patientName,
          grund: `Datum fehlt/nicht lesbar für „${e.name}“ — Eintrag nicht übernommen`,
        });
        continue;
      }
      if (e.unsicher) {
        melde({
          sheet: e.sheet,
          zeile: e.zeile,
          patient: patientName,
          grund: `Unsichere Angabe „${e.name}“ (mit „(?)“ markiert) — bitte bestätigen`,
        });
      }
      if (e.kwAbweichung && e.datum) {
        melde({
          sheet: e.sheet,
          zeile: e.zeile,
          patient: patientName,
          grund: `Datum ${e.datum.split("-").reverse().join(".")} passt nicht zur KW ${e.kw} (Tippfehler?) — bitte prüfen`,
        });
      }
      const produkt = findeProdukt(kontext.katalog, e.name);
      if (!produkt) {
        melde({
          sheet: e.sheet,
          zeile: e.zeile,
          patient: patientName,
          grund: `Leistung „${e.name}“ nicht im Katalog — Eintrag nicht übernommen`,
        });
        continue;
      }
      const istAuslage = produkt.kategorie === "auslage";
      // Preis: Patienten-Kondition > EK (Auslage § 10) bzw. VK (GOÄ-Leistung)
      const kondition = kunde
        ? kontext.konditionen.get(`${kunde.id}|${produkt.id}`)
        : undefined;
      const preis = kondition ?? (istAuslage ? produkt.ekPreisNetto : produkt.preisNetto);
      if (!preis) {
        melde({
          sheet: e.sheet,
          zeile: e.zeile,
          patient: patientName,
          grund: `„${produkt.name}“ ist Auslage § 10 GOÄ, hat aber keinen EK-Preis — Eintrag nicht übernommen`,
        });
        continue;
      }
      const key = `${e.datum}|${produkt.id}`;
      const vorhanden = posMap.get(key);
      if (vorhanden) {
        vorhanden.mengeZahl += e.menge;
        vorhanden.menge = String(Math.round(vorhanden.mengeZahl * 1000) / 1000);
      } else {
        posMap.set(key, {
          datum: e.datum,
          bezeichnung: produkt.name,
          menge: String(e.menge),
          einheit: produkt.einheit,
          einzelpreis: preis,
          ustSatz: produkt.ustSatz,
          kategorie: produkt.kategorie,
          quelle: e.name,
          mengeZahl: e.menge,
        });
      }
    }

    const positionen = [...posMap.values()].sort((a, b) => {
      if (a.kategorie !== b.kategorie) return a.kategorie === "leistung" ? -1 : 1;
      const d = (a.datum ?? "").localeCompare(b.datum ?? "");
      return d !== 0 ? d : a.bezeichnung.localeCompare(b.bezeichnung);
    });

    const totals = computeTotals(positionen);
    const daten = gruppe.map((e) => e.datum).filter((d): d is string => d !== null).sort();

    patienten.push({
      patientName,
      kundeId: kunde?.id ?? null,
      kundeName: kunde?.name ?? null,
      kundeNeu,
      patientInfo: info,
      wochen,
      zeitraum: daten.length > 0 ? { von: daten[0], bis: daten[daten.length - 1] } : null,
      positionen,
      summeCent: totals.bruttoCent,
      klar: eigeneUnklarheiten.length === 0 && positionen.length > 0,
    });
  }

  // Patienten ohne einzige verrechenbare Position -> überspringen
  const endgueltig: PatientVorschau[] = [];
  for (const p of patienten) {
    if (p.positionen.length === 0) {
      const grund = "Keine zuordenbaren Positionen (alle Einträge unklar)";
      unklarheiten.push({ sheet: null, zeile: null, patient: p.patientName, grund });
      uebersprungen.push({ patient: p.patientName, grund });
    } else {
      endgueltig.push(p);
    }
  }

  return {
    patienten: endgueltig,
    unklarheiten,
    uebersprungen,
    eintraegeGesamt: eintraege.length,
    kontext,
  };
}

function kwListe(wochen: { jahr: number; kw: number }[]): string {
  return wochen.map((w) => w.kw).sort((a, b) => a - b).join("/");
}

// ── Router ──────────────────────────────────────────────────────────────────
export const therapyImportRouter = createRouter({
  /** Erkennt die KW-Blätter einer hochgeladenen Datei (für die Auswahl). */
  blaetter: authedQuery
    .input(z.object({ dateiname: z.string().min(1), base64: z.string().min(1) }))
    .mutation(({ input }) => {
      const sheets = blaetterDesPlans(input.dateiname, input.base64);
      if (sheets.length === 0) {
        throw new Error("Keine KW-Blätter gefunden (erwartet Blattnamen wie „KW28“).");
      }
      return { sheets };
    }),

  /** Analyse ohne Schreibzugriff: Patienten, Positionen, Unklarheiten. */
  vorschau: authedQuery.input(dateiInput).mutation(async ({ input }) => {
    const { kontext: _k, ...ergebnis } = await analysiere(input);
    return ergebnis;
  }),

  /** Legt Patienten (neu) und Rechnungsentwürfe an + protokolliert den Import. */
  importieren: authedQuery.input(dateiInput).mutation(async ({ input }) => {
    const db = getDb();
    const analyse = await analysiere(input);

    const settings = await db.query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
    });
    const standardBank = await db.query.bankAccounts.findFirst({
      where: eq(bankAccounts.istStandard, true),
    });

    const heute = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const zielTage = settings?.standardZahlungsziel ?? 14;
    const faellig = new Date(heute);
    faellig.setDate(faellig.getDate() + zielTage);

    const ergebnis: ImportErgebnis = {
      rechnungen: [],
      unklarheiten: analyse.unklarheiten,
      uebersprungen: analyse.uebersprungen,
    };

    for (const p of analyse.patienten) {
      // Patientenstamm: unbekannte Patienten neu anlegen (Adresse fehlt -> Report)
      let kundeId = p.kundeId;
      let stamm: Kunde | undefined | null = kundeId
        ? analyse.kontext.kunden.find((k) => k.id === kundeId)
        : null;
      if (!kundeId) {
        // Neuanlage mit allen Daten aus der Vorlage (v2)
        const info = p.patientInfo;
        const [res] = await db
          .insert(customers)
          .values({
            name: p.patientName,
            strasse: info?.strasse ?? "",
            plz: info?.plz ?? "",
            ort: info?.ort ?? "",
            land: "Deutschland",
            email: info?.email ?? null,
            telefon: info?.telefon ?? null,
            geburtsdatum: info?.geburtsdatum ?? null,
            patientenNr: info?.patientenNr ?? null,
            notizen: `Automatisch angelegt durch Therapieplan-Import (${input.dateiname})`,
          })
          .$returningId();
        kundeId = res.id;
        stamm = await db.query.customers.findFirst({ where: eq(customers.id, kundeId) });
      } else if (p.patientInfo && stamm) {
        // Bekannter Patient: fehlende Stamm-Felder aus der Vorlage ergänzen
        // (keine Überschreibung vorhandener Daten)
        const info = p.patientInfo;
        const patch: Partial<typeof customers.$inferInsert> = {};
        if (!stamm.strasse && info.strasse) patch.strasse = info.strasse;
        if (!stamm.plz && info.plz) patch.plz = info.plz;
        if (!stamm.ort && info.ort) patch.ort = info.ort;
        if (!stamm.geburtsdatum && info.geburtsdatum) patch.geburtsdatum = info.geburtsdatum;
        if (!stamm.patientenNr && info.patientenNr) patch.patientenNr = info.patientenNr;
        if (!stamm.email && info.email) patch.email = info.email;
        if (!stamm.telefon && info.telefon) patch.telefon = info.telefon;
        if (Object.keys(patch).length > 0) {
          await db.update(customers).set(patch).where(eq(customers.id, stamm.id));
          stamm = { ...stamm, ...patch };
        }
      }
      if (!stamm) continue;

      // Positionen inkl. Abschnitts-Zeilen (1. GOÄ-Leistungen / 2. Auslagen § 10)
      const hatLeistung = p.positionen.some((x) => x.kategorie === "leistung");
      const hatAuslage = p.positionen.some((x) => x.kategorie === "auslage");
      const mitAbschnitten = hatLeistung && hatAuslage;
      const items: {
        bezeichnung: string;
        beschreibung: string | null;
        menge: string;
        einheit: string;
        einzelpreis: string;
        ustSatz: number;
      }[] = [];
      let abschnittOffen = false;
      for (const pos of p.positionen) {
        if (mitAbschnitten && (!abschnittOffen || pos.kategorie !== aktuelleKategorie(items))) {
          items.push({
            bezeichnung: pos.kategorie === "leistung" ? ABSCHNITT_LEISTUNGEN : ABSCHNITT_AUSLAGEN,
            beschreibung: null,
            menge: "0",
            einheit: "Stück",
            einzelpreis: "0.00",
            ustSatz: 0,
          });
          abschnittOffen = true;
        }
        items.push({
          bezeichnung: pos.bezeichnung,
          beschreibung: pos.datum ? tagKurz(pos.datum) : null,
          menge: pos.menge,
          einheit: pos.einheit,
          einzelpreis: pos.einzelpreis,
          ustSatz: pos.ustSatz,
        });
      }
      function aktuelleKategorie(
        liste: typeof items,
      ): "leistung" | "auslage" | null {
        for (let i = liste.length - 1; i >= 0; i--) {
          if (liste[i].bezeichnung === ABSCHNITT_LEISTUNGEN) return "leistung";
          if (liste[i].bezeichnung === ABSCHNITT_AUSLAGEN) return "auslage";
        }
        return null;
      }

      const totals = computeTotals(items);
      const leistungsdatum = p.zeitraum
        ? p.zeitraum.von === p.zeitraum.bis
          ? `${fmtDe(p.zeitraum.von)} (KW ${kwListe(p.wochen)})`
          : `${fmtDe(p.zeitraum.von)}–${fmtDe(p.zeitraum.bis)} (KW ${kwListe(p.wochen)})`
        : null;

      const [re] = await db
        .insert(invoices)
        .values({
          customerId: kundeId,
          status: "entwurf",
          rechnungsdatum: fmt(heute),
          faelligkeitsdatum: fmt(faellig),
          leistungsdatum,
          bankAccountId: standardBank?.id ?? null,
          kundeName: stamm.name,
          kundeZusatz: stamm.zusatz,
          kundeStrasse: stamm.strasse,
          kundePlz: stamm.plz,
          kundeOrt: stamm.ort,
          kundeLand: stamm.land,
          netto: centToDecimal(totals.nettoCent),
          ust: centToDecimal(totals.ustCent),
          brutto: centToDecimal(totals.bruttoCent),
          bemerkung: `Therapieplan-Import ${input.dateiname} (${input.sheets.join(", ")})`,
        })
        .$returningId();

      await db.insert(invoiceItems).values(
        items.map((it, i) => ({
          invoiceId: re.id,
          position: i + 1,
          bezeichnung: it.bezeichnung,
          beschreibung: it.beschreibung,
          menge: it.menge,
          einheit: it.einheit,
          einzelpreis: it.einzelpreis,
          ustSatz: it.ustSatz,
        })),
      );

      // Wochen als berechnet markieren (Duplikatsschutz, auch für Entwürfe)
      await db.insert(invoiceTherapieWochen).values(
        p.wochen.map((w) => ({
          invoiceId: re.id,
          customerId: kundeId!,
          jahr: w.jahr,
          kw: w.kw,
        })),
      );

      ergebnis.rechnungen.push({ id: re.id, patient: p.patientName, klar: p.klar });
    }

    // Protokoll für Audit + Report-Nachdownload
    const [imp] = await db
      .insert(therapyImports)
      .values({
        dateiname: input.dateiname,
        jahr: input.jahr,
        sheets: JSON.stringify(input.sheets),
        ergebnis: JSON.stringify(ergebnis),
      })
      .$returningId();

    return { importId: imp.id, ...ergebnis };
  }),

  /** Liste der bisherigen Importe (für Verlauf + Report-Nachdownload). */
  historie: authedQuery.query(async () => {
    const rows = await getDb()
      .select()
      .from(therapyImports)
      .orderBy(desc(therapyImports.createdAt))
      .limit(50);
    return rows.map((r) => {
      const erg = JSON.parse(r.ergebnis) as ImportErgebnis;
      return {
        id: r.id,
        dateiname: r.dateiname,
        jahr: r.jahr,
        sheets: JSON.parse(r.sheets) as string[],
        erstelltAm: r.createdAt.toISOString(),
        anzahlRechnungen: erg.rechnungen.length,
        anzahlUnklarheiten: erg.unklarheiten.length,
      };
    });
  }),

  /** Unklarheiten-Report eines Imports als TXT oder PDF (Base64). */
  report: authedQuery
    .input(z.object({ id: z.number(), format: z.enum(["txt", "pdf"]) }))
    .query(async ({ input }) => {
      const row = await getDb().query.therapyImports.findFirst({
        where: eq(therapyImports.id, input.id),
      });
      if (!row) throw new Error("Import nicht gefunden.");
      const ergebnis = JSON.parse(row.ergebnis) as ImportErgebnis;
      const sheets = JSON.parse(row.sheets) as string[];
      const basis = `Unklarheiten-Report_${row.dateiname.replace(/\.[^.]+$/, "")}_${sheets.join("-")}`;
      if (input.format === "pdf") {
        const pdf = await renderReportPdf(row.dateiname, row.jahr, sheets, ergebnis, row.createdAt);
        return { dateiname: `${basis}.pdf`, mime: "application/pdf", base64: pdf.toString("base64") };
      }
      const txt = baueReportText(row.dateiname, row.jahr, sheets, ergebnis, row.createdAt);
      return {
        dateiname: `${basis}.txt`,
        mime: "text/plain",
        base64: Buffer.from(txt, "utf-8").toString("base64"),
      };
    }),
});
