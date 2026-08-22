// ── PraxiOS: Geteilte Abrechnungs-Engine (Plan → Rechnungsentwurf) ─────────
// Kapselt Katalog-Auflösung (Produkt-ID direkt oder Namens-Matching),
// Preislogik (Kondition > EK § 10 / VK GOÄ), Abschnitte, GoBD-Entwurf und
// Wochen-Duplikatschutz. Genutzt von plaene.rechnungErstellen.
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./queries/connection";
import {
  bankAccounts,
  companySettings,
  customers,
  invoices,
  invoiceItems,
  invoiceTherapieWochen,
  konditionen,
  products,
} from "@db/schema";
import { computeTotals, centToDecimal } from "@contracts/invoicing";
import {
  ABSCHNITT_LEISTUNGEN,
  ABSCHNITT_AUSLAGEN,
} from "@contracts/therapy";
import { isoKalenderwoche, normBasis, normKompakt, normMenge } from "./therapyPlan";

export interface AbrechnungsEintrag {
  datum: string; // ISO
  menge: number;
  leistungText: string; // Name/Freitext aus der Dokumentation
  leistungId: number | null; // direkte Katalog-Referenz, falls vorhanden
}

export interface AbrechnungsErgebnis {
  invoiceId: number;
  summeCent: number;
  wochen: { jahr: number; kw: number }[];
  nichtUebernommen: { datum: string; name: string; grund: string }[];
}

/** Sortierung innerhalb eines Tages: manuelle Reihenfolge zuerst (falls
 *  gesetzt), dann Uhrzeit, dann id. */
export function eintraegeSortieren<
  T extends { datum: string; zeitVon: string | null; id: number; reihenfolge?: number | null },
>(liste: T[]): T[] {
  const rf = (e: T) => (e.reihenfolge && e.reihenfolge > 0 ? e.reihenfolge : Number.MAX_SAFE_INTEGER);
  return [...liste].sort((a, b) => {
    if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
    if (rf(a) !== rf(b)) return rf(a) - rf(b);
    const az = a.zeitVon ?? null;
    const bz = b.zeitVon ?? null;
    if (az && !bz) return -1;
    if (!az && bz) return 1;
    if (az && bz && az !== bz) return az.localeCompare(bz);
    return a.id - b.id;
  });
}

const fmtDe = (iso: string) => {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
};
const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const tagKurz = (iso: string) =>
  `${WOCHENTAGE[new Date(iso + "T12:00:00Z").getUTCDay()]}, ${fmtDe(iso)}`;

/**
 * Erstellt einen Rechnungsentwurf für einen Patienten aus dokumentierten
 * Einträgen (eine Rechnung über den gesamten Zeitraum, Abschnitte GOÄ/§ 10).
 */
export async function erstelleEntwurfAusEintraegen(
  patientId: number,
  eintraege: AbrechnungsEintrag[],
  quelle: string, // z. B. „Therapieplan #42 (28.09.–09.10.2026)"
  erstelltVon: number | null,
  optionen?: {
    /** Herkunfts-Plan (Plan→Rechnung): ermöglicht Rücksetzung beim Löschen des Entwurfs. */
    therapieplanId?: number;
    /** Kopf-Datum explizit setzen (z. B. Plan-Zeitraum statt nur abgerechnete Tage). */
    leistungsdatum?: string;
  },
): Promise<AbrechnungsErgebnis> {
  const db = getDb();
  const patient = await db.query.customers.findFirst({
    where: eq(customers.id, patientId),
  });
  if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });

  // Wochen + Duplikatschutz (auch Entwürfe sperren)
  const wochen = [
    ...new Map(
      eintraege.map((e) => {
        const kw = isoKalenderwoche(e.datum);
        const jahr = Number(e.datum.slice(0, 4));
        return [`${jahr}|${kw}`, { jahr, kw }];
      }),
    ).values(),
  ];
  for (const w of wochen) {
    const belegt = await db
      .select({ nummer: invoices.nummer, id: invoices.id })
      .from(invoiceTherapieWochen)
      .innerJoin(invoices, eq(invoices.id, invoiceTherapieWochen.invoiceId))
      .where(
        and(
          eq(invoiceTherapieWochen.customerId, patientId),
          eq(invoiceTherapieWochen.jahr, w.jahr),
          eq(invoiceTherapieWochen.kw, w.kw),
        ),
      )
      .limit(1);
    if (belegt.length > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `KW ${w.kw} wurde für diesen Patienten bereits berechnet (Rechnung ${belegt[0].nummer ?? `#${belegt[0].id}`}). Kein erneuter Entwurf.`,
      });
    }
  }

  // Katalog + Konditionen
  const [produktListe, konditionenListe, settings, standardBank] = await Promise.all([
    db.query.products.findMany({ where: eq(products.aktiv, true) }),
    db
      .select()
      .from(konditionen)
      .where(and(eq(konditionen.typ, "kunde"), eq(konditionen.partnerId, patientId))),
    db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) }),
    db.query.bankAccounts.findFirst({ where: eq(bankAccounts.istStandard, true) }),
  ]);
  const nachId = new Map(produktListe.map((p) => [p.id, p]));
  const katalog = new Map<string, (typeof produktListe)[number]>();
  const setze = (s: string, p: (typeof produktListe)[number]) => {
    if (s && !katalog.has(s)) katalog.set(s, p);
  };
  for (const p of produktListe) {
    setze(normBasis(p.name), p);
    setze(normKompakt(p.name), p);
    setze(normMenge(p.name), p);
    for (const a of (p.importNamen ?? "").split(/[\n;]/)) {
      const t = a.trim();
      if (t) {
        setze(normBasis(t), p);
        setze(normKompakt(t), p);
        setze(normMenge(t), p);
      }
    }
  }
  const konditionMap = new Map(
    konditionenListe.map((k) => [k.productId, k.preisNetto]),
  );

  // Positionen: aggregieren je (Datum, Produkt), sortiert Leistung vor Auslage
  const posMap = new Map<
    string,
    {
      datum: string;
      bezeichnung: string;
      mengeZahl: number;
      einheit: string;
      einzelpreis: string;
      ustSatz: number;
      kategorie: "leistung" | "auslage";
      goaeBezug: string | null;
    }
  >();
  const nichtUebernommen: AbrechnungsErgebnis["nichtUebernommen"] = [];

  for (const e of eintraege) {
    const produkt =
      (e.leistungId ? nachId.get(e.leistungId) : undefined) ??
      katalog.get(normBasis(e.leistungText)) ??
      katalog.get(normKompakt(e.leistungText)) ??
      katalog.get(normMenge(e.leistungText));
    if (!produkt) {
      nichtUebernommen.push({
        datum: e.datum,
        name: e.leistungText,
        grund: "nicht im Leistungskatalog",
      });
      continue;
    }
    const istAuslage = produkt.kategorie === "auslage";
    const preis =
      konditionMap.get(produkt.id) ?? (istAuslage ? produkt.ekPreisNetto : produkt.preisNetto);
    if (!preis) {
      nichtUebernommen.push({
        datum: e.datum,
        name: produkt.name,
        grund: `Auslage § 10 ohne EK-Preis`,
      });
      continue;
    }
    const key = `${e.datum}|${produkt.id}`;
    const vorhanden = posMap.get(key);
    if (vorhanden) {
      vorhanden.mengeZahl += e.menge;
    } else {
      posMap.set(key, {
        datum: e.datum,
        bezeichnung: produkt.name,
        mengeZahl: e.menge,
        einheit: produkt.einheit,
        einzelpreis: preis,
        ustSatz: produkt.ustSatz,
        kategorie: produkt.kategorie,
        goaeBezug: produkt.goaeZiffer
          ? `GOÄ ${produkt.goaeZiffer}${produkt.goaeArt === "analog" ? " (entspr.)" : produkt.goaeArt === "§2" ? " (§ 2)" : ""}`
          : null,
      });
    }
  }

  const positionen = [...posMap.values()].sort((a, b) => {
    if (a.kategorie !== b.kategorie) return a.kategorie === "leistung" ? -1 : 1;
    const d = a.datum.localeCompare(b.datum);
    return d !== 0 ? d : a.bezeichnung.localeCompare(b.bezeichnung);
  });
  if (positionen.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Keine verrechenbaren Positionen (alle Einträge ohne Katalog-Zuordnung oder ohne Preis).",
    });
  }

  // Abschnitte + Items
  const hatLeistung = positionen.some((p) => p.kategorie === "leistung");
  const hatAuslage = positionen.some((p) => p.kategorie === "auslage");
  const items: {
    bezeichnung: string;
    beschreibung: string | null;
    menge: string;
    einheit: string;
    einzelpreis: string;
    ustSatz: number;
  }[] = [];
  let abschnitt: "leistung" | "auslage" | null = null;
  for (const p of positionen) {
    if (hatLeistung && hatAuslage && abschnitt !== p.kategorie) {
      items.push({
        bezeichnung: p.kategorie === "leistung" ? ABSCHNITT_LEISTUNGEN : ABSCHNITT_AUSLAGEN,
        beschreibung: null,
        menge: "0",
        einheit: "Stück",
        einzelpreis: "0.00",
        ustSatz: 0,
      });
      abschnitt = p.kategorie;
    }
    items.push({
      bezeichnung: p.bezeichnung,
      beschreibung: tagKurz(p.datum) + (p.goaeBezug ? ` · ${p.goaeBezug}` : ""),
      menge: String(Math.round(p.mengeZahl * 1000) / 1000),
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      ustSatz: p.ustSatz,
    });
  }

  const totals = computeTotals(items);
  const daten = eintraege.map((e) => e.datum).sort();
  const kwListe = wochen.map((w) => w.kw).sort((a, b) => a - b).join("/");
  const leistungsdatum =
    optionen?.leistungsdatum ??
    (daten.length > 1
      ? `${fmtDe(daten[0])}–${fmtDe(daten[daten.length - 1])} (KW ${kwListe})`
      : `${fmtDe(daten[0])} (KW ${kwListe})`);

  const heute = new Date();
  const zielTage = patient.zahlungszielTage ?? settings?.standardZahlungsziel ?? 14;
  const faellig = new Date(heute);
  faellig.setDate(faellig.getDate() + zielTage);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [re] = await db
    .insert(invoices)
    .values({
      customerId: patientId,
      status: "entwurf",
      rechnungsdatum: fmt(heute),
      faelligkeitsdatum: fmt(faellig),
      leistungsdatum,
      bankAccountId: standardBank?.id ?? null,
      kundeName: patient.name,
      kundeZusatz: patient.zusatz,
      kundeStrasse: patient.strasse,
      kundePlz: patient.plz,
      kundeOrt: patient.ort,
      kundeLand: patient.land,
      netto: centToDecimal(totals.nettoCent),
      ust: centToDecimal(totals.ustCent),
      brutto: centToDecimal(totals.bruttoCent),
      bemerkung: `Erstellt aus ${quelle}`,
      therapieplanId: optionen?.therapieplanId ?? null,
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
  await db.insert(invoiceTherapieWochen).values(
    wochen.map((w) => ({
      invoiceId: re.id,
      customerId: patientId,
      jahr: w.jahr,
      kw: w.kw,
    })),
  );

  void erstelltVon;
  return {
    invoiceId: re.id,
    summeCent: totals.bruttoCent,
    wochen,
    nichtUebernommen,
  };
}
