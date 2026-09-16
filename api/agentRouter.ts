// ── Agent-API (Kimi Claw) ──────────────────────────────────────────────────
// REST-Endpunkte für externe Agenten unter /api/agent/* — Bearer-Token-Auth
// (sha256 in agent_tokens), Autonomie-Stufe aus company_settings:
//   vorschlag     = Lesen + Entwürfe/Aufgaben/Kunden; kein Versand
//   vollautomatik = zusätzlich Beleg-Versand per E-Mail
// Jede Schreib-Aktion wird in agent_log auditiert (sichtbar in Einstellungen).
import { Hono } from "hono";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, like, lte } from "drizzle-orm";
import { getDb } from "./queries/connection";
import {
  agentTokens, agentAufgaben, agentLog, companySettings,
  customers, invoices, invoiceItems, planEntries, products, reminders, bankImporte,
  rezepte, therapyPlans,
} from "@db/schema";
import { naechstePatientenNr } from "./lib/patientenNr";
import { APP_VERSION } from "./lib/version";
import { computeTotals, centToDecimal } from "./queries/invoicing";
import { besterTreffer } from "@contracts/fuzzy";

const app = new Hono<{ Variables: { agentToken: { freigabeEmpfaenger?: string | null } } }>();

function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

/** Neues Token erzeugen (Klartext nur bei der Anlage sichtbar). */
export function erzeugeAgentToken(): string {
  return `ax_${randomBytes(24).toString("hex")}`;
}
export { hashToken };

// ── Auth-Middleware (+ Token-Kontext + Idempotenz-Keys, 1.14.0) ────────────
app.use("*", async (c, next) => {
  const kopf = c.req.header("authorization") ?? "";
  const token = kopf.startsWith("Bearer ") ? kopf.slice(7).trim() : "";
  if (!token) return c.json({ fehler: "Bearer-Token fehlt (Authorization: Bearer ax_…)" }, 401);
  const treffer = await getDb().query.agentTokens.findFirst({
    where: eq(agentTokens.tokenHash, hashToken(token)),
  });
  if (!treffer || !treffer.aktiv) return c.json({ fehler: "Token ungültig oder deaktiviert." }, 401);
  getDb()
    .update(agentTokens)
    .set({ letzteNutzung: new Date() })
    .where(eq(agentTokens.id, treffer.id))
    .catch(() => undefined);
  c.set("agentToken", treffer);

  // Idempotenz: POST mit Idempotenz-Key → gespeicherte Antwort replayen (Retry-sicher)
  const idemKey = c.req.header("idempotenz-key") ?? c.req.header("idempotency-key");
  if (c.req.method === "POST" && idemKey) {
    const { agentIdempotenz } = await import("@db/schema");
    const db = getDb();
    const bekannt = await db.query.agentIdempotenz.findFirst({
      where: eq(agentIdempotenz.schluessel, idemKey.slice(0, 128)),
    });
    if (bekannt) {
      return new Response(bekannt.antwortJson ?? "{}", {
        status: bekannt.status,
        headers: { "content-type": "application/json", "x-idempotent-replay": "1" },
      });
    }
    await next();
    try {
      const klon = c.res.clone();
      const antwort = await klon.text();
      if (klon.status < 500) {
        await db
          .insert(agentIdempotenz)
          .values({ schluessel: idemKey.slice(0, 128), endpunkt: c.req.path, status: klon.status, antwortJson: antwort })
          .catch(() => undefined);
      }
    } catch { /* Idempotenz darf nie blockieren */ }
    return;
  }
  return next();
});

async function audit(aktion: string, details?: unknown) {
  try {
    await getDb().insert(agentLog).values({
      aktion,
      details: details === undefined ? null : JSON.stringify(details).slice(0, 4000),
    });
  } catch { /* Audit darf nie blockieren */ }
}

async function autonomie(): Promise<"vorschlag" | "vollautomatik"> {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
    columns: { agentAutonomie: true },
  });
  return s?.agentAutonomie === "vollautomatik" ? "vollautomatik" : "vorschlag";
}

/** Granulare Autonomie (1.14.0): vollautomatik erlaubt alles; sonst
 *  Token-Freigabeliste (Adresse oder @domain) je Empfänger. */
async function versandErlaubt(c: { get: (k: string) => unknown }, empfaenger: string[]): Promise<{ ok: boolean; via: string }> {
  const stufe = await autonomie();
  if (stufe === "vollautomatik") return { ok: true, via: "vollautomatik" };
  const token = c.get("agentToken") as { freigabeEmpfaenger?: string | null } | undefined;
  let liste: string[] = [];
  try {
    liste = token?.freigabeEmpfaenger ? (JSON.parse(token.freigabeEmpfaenger) as string[]) : [];
  } catch { liste = []; }
  if (liste.length === 0) return { ok: false, via: "gesperrt" };
  const norm = liste.map((x) => x.toLowerCase().trim());
  const alleOk = empfaenger.every((e) => {
    const adr = e.toLowerCase().trim();
    const dom = adr.split("@")[1] ?? "";
    return norm.includes(adr) || norm.includes(`@${dom}`);
  });
  return alleOk ? { ok: true, via: "freigabeliste" } : { ok: false, via: "gesperrt" };
}

/** Webhook feuern (fire-and-forget, 5 s Timeout, Fehlerzähler). */
export async function webhookFeuern(ereignis: string, payload: unknown): Promise<void> {
  try {
    const { webhooks } = await import("@db/schema");
    const db = getDb();
    const ziele = await db.query.webhooks.findMany({
      where: and(eq(webhooks.ereignis, ereignis), eq(webhooks.aktiv, true)),
    });
    for (const z of ziele) {
      fetch(z.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ereignis, zeit: new Date().toISOString(), daten: payload }),
        signal: AbortSignal.timeout(5000),
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
        })
        .catch(() =>
          db.update(webhooks).set({ fehler: z.fehler + 1 }).where(eq(webhooks.id, z.id)).catch(() => undefined),
        );
    }
  } catch { /* Webhooks dürfen nie blockieren */ }
}

const heute = () => new Date().toISOString().slice(0, 10);

// ── Lesen ──────────────────────────────────────────────────────────────────
app.get("/status", async (c) => {
  return c.json({ produkt: process.env.SUPPORT_PRODUKT || "ReWaWi", version: APP_VERSION, zeit: new Date().toISOString() });
});

app.get("/offene-rechnungen", async (c) => {
  const db = getDb();
  const rows = await db.select().from(invoices).where(eq(invoices.status, "finalisiert"));
  const h = heute();
  const offene = rows
    .filter((r) => Number(r.brutto) - Number(r.bezahltBetrag) > 0.004)
    .map((r) => ({
      id: r.id,
      nummer: r.nummer,
      kunde: r.kundeName,
      kundenId: r.customerId,
      brutto: Number(r.brutto),
      offen: Number(r.brutto) - Number(r.bezahltBetrag),
      rechnungsdatum: r.rechnungsdatum,
      faelligkeitsdatum: r.faelligkeitsdatum,
      ueberfaellig: r.faelligkeitsdatum < h,
    }))
    .sort((a, b) => (a.faelligkeitsdatum < b.faelligkeitsdatum ? -1 : 1));
  return c.json({ anzahl: offene.length, ueberfaellig: offene.filter((o) => o.ueberfaellig).length, rechnungen: offene });
});

app.get("/entwuerfe", async (c) => {
  const rows = await getDb().query.invoices.findMany({
    where: eq(invoices.status, "entwurf"),
    orderBy: [desc(invoices.createdAt)],
  });
  return c.json({
    anzahl: rows.length,
    entwuerfe: rows.map((r) => ({
      id: r.id, kunde: r.kundeName, kundenId: r.customerId,
      netto: Number(r.netto), brutto: Number(r.brutto), datum: r.rechnungsdatum,
    })),
  });
});

app.get("/kunden-ohne-rechnung", async (c) => {
  const tage = Math.max(7, Math.min(365, Number(c.req.query("tage") ?? "30")));
  const schwelle = new Date(Date.now() - tage * 86400000).toISOString().slice(0, 10);
  const db = getDb();
  const [alle, finale] = await Promise.all([
    db.select().from(customers),
    db.select().from(invoices).where(eq(invoices.status, "finalisiert")),
  ]);
  const letzteJeKunde = new Map<number, string>();
  for (const r of finale) {
    const bisher = letzteJeKunde.get(r.customerId);
    if (!bisher || r.rechnungsdatum > bisher) letzteJeKunde.set(r.customerId, r.rechnungsdatum);
  }
  const faellig = alle
    .filter((k) => (letzteJeKunde.get(k.id) ?? "0000-00-00") < schwelle)
    .map((k) => ({ id: k.id, name: k.name, email: k.email, letzteRechnung: letzteJeKunde.get(k.id) ?? null }))
    .sort((a, b) => ((a.letzteRechnung ?? "") < (b.letzteRechnung ?? "") ? -1 : 1));
  return c.json({ tage, anzahl: faellig.length, kunden: faellig });
});

app.get("/mahnungen", async (c) => {
  const db = getDb();
  const h = heute();
  const alle = await db.select().from(invoices).where(eq(invoices.status, "finalisiert"));
  const alleMahnungen = await db.select().from(reminders);
  const offene = alle.filter((r) => Number(r.brutto) - Number(r.bezahltBetrag) > 0.004 && r.faelligkeitsdatum < h);
  return c.json({
    anzahl: offene.length,
    faellig: offene.map((r) => {
      const stufen = alleMahnungen.filter((m) => m.invoiceId === r.id);
      const hoechste = stufen.reduce((a, m) => Math.max(a, m.stufe), 0);
      return {
        rechnungId: r.id, nummer: r.nummer, kunde: r.kundeName,
        faelligkeitsdatum: r.faelligkeitsdatum,
        offen: Number(r.brutto) - Number(r.bezahltBetrag),
        stufenBisher: stufen.length, naechsteStufe: Math.min(3, hoechste + 1),
      };
    }),
  });
});

// ── Bank: Buchungen, Abgleich, Kontostand ──────────────────────────────────
app.get("/bankbuchungen", async (c) => {
  const tage = Math.max(1, Math.min(365, Number(c.req.query("tage") ?? "30")));
  const seit = new Date(Date.now() - tage * 86400000).toISOString().slice(0, 10);
  const { bankTransaktionen, bankAccounts } = await import("@db/schema");
  const { gte, asc } = await import("drizzle-orm");
  const rows = await getDb()
    .select({ t: bankTransaktionen, konto: bankAccounts.bezeichnung })
    .from(bankTransaktionen)
    .leftJoin(bankAccounts, eq(bankTransaktionen.bankAccountId, bankAccounts.id))
    .where(gte(bankTransaktionen.datum, seit))
    .orderBy(asc(bankTransaktionen.datum));
  return c.json({
    tage,
    anzahl: rows.length,
    buchungen: rows.map((r) => ({
      id: r.t.id,
      datum: r.t.datum,
      betrag: Number(r.t.betrag),
      name: r.t.name,
      zweck: r.t.zweck,
      konto: r.konto,
      status: r.t.status,
      quellId: r.t.quellId,
      gebuehr: r.t.gebuehr ? Number(r.t.gebuehr) : null,
    })),
  });
});

app.get("/bankbuchung/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { bankTransaktionen } = await import("@db/schema");
  const t = await getDb().query.bankTransaktionen.findFirst({
    where: eq(bankTransaktionen.id, id),
  });
  if (!t) return c.json({ fehler: "Buchung nicht gefunden." }, 404);
  return c.json(t);
});

app.get("/kontostand", async (c) => {
  const { bankAccounts, bankTransaktionen } = await import("@db/schema");
  const { and, desc, sql } = await import("drizzle-orm");
  const db = getDb();
  const konten = await db.select().from(bankAccounts);
  const aus = [];
  for (const k of konten) {
    const letzteSaldo = await db
      .select({ saldo: bankTransaktionen.saldoNach })
      .from(bankTransaktionen)
      .where(and(eq(bankTransaktionen.bankAccountId, k.id), sql`${bankTransaktionen.saldoNach} IS NOT NULL`))
      .orderBy(desc(bankTransaktionen.datum), desc(bankTransaktionen.id))
      .limit(1);
    const [agg] = await db
      .select({ summe: sql<string>`COALESCE(SUM(${bankTransaktionen.betrag}), 0)` })
      .from(bankTransaktionen)
      .where(eq(bankTransaktionen.bankAccountId, k.id));
    aus.push({
      kontoId: k.id,
      bezeichnung: k.bezeichnung,
      iban: k.iban,
      saldo: letzteSaldo[0]?.saldo !== null && letzteSaldo[0]?.saldo !== undefined
        ? Number(letzteSaldo[0].saldo)
        : Number(agg?.summe ?? 0),
      quelle: letzteSaldo.length > 0 ? "saldoNach" : "summe",
    });
  }
  return c.json({ konten: aus });
});

app.get("/zahlungsabgleich", async (c) => {
  const { autoMatch } = await import("./bankTransaktionenRouter");
  const { bankTransaktionen, bankAccounts } = await import("@db/schema");
  const { asc } = await import("drizzle-orm");
  const db = getDb();
  const offene = await db
    .select({ t: bankTransaktionen, konto: bankAccounts.bezeichnung })
    .from(bankTransaktionen)
    .leftJoin(bankAccounts, eq(bankTransaktionen.bankAccountId, bankAccounts.id))
    .where(eq(bankTransaktionen.status, "offen"))
    .orderBy(asc(bankTransaktionen.datum))
    .limit(60);
  const aus = [];
  for (const r of offene) {
    const vorschlag = await autoMatch({
      datum: r.t.datum,
      betrag: Number(r.t.betrag),
      name: r.t.name,
      zweck: r.t.zweck ?? "",
      gebuehr: r.t.gebuehr ? Number(r.t.gebuehr) : null,
      saldo: r.t.saldoNach ? Number(r.t.saldoNach) : null,
    });
    aus.push({
      transaktionId: r.t.id,
      datum: r.t.datum,
      betrag: Number(r.t.betrag),
      name: r.t.name,
      konto: r.konto,
      vorschlag: vorschlag
        ? {
            typ: vorschlag.typ,
            rechnungOderBeleg: vorschlag.nummer,
            kunde: vorschlag.bezeichner,
            offenBetrag: vorschlag.offenBetrag,
            sicherheit: vorschlag.sicherheit,
          }
        : null,
    });
  }
  return c.json({
    anzahl: aus.length,
    mitVorschlag: aus.filter((a) => a.vorschlag).length,
    buchungen: aus,
  });
});

// ── Kunden & Katalog & Einzelbeleg ─────────────────────────────────────────
app.get("/kunden", async (c) => {
  const rows = await getDb().select().from(customers);
  return c.json({
    anzahl: rows.length,
    kunden: rows.map((k) => ({
      id: k.id, name: k.name, zusatz: k.zusatz, strasse: k.strasse,
      plz: k.plz, ort: k.ort, land: k.land, email: k.email,
      zahlungszielTage: k.zahlungszielTage,
    })),
  });
});

app.get("/leistungskatalog", async (c) => {
  const rows = (await getDb().query.products.findMany()).filter((p) => p.aktiv);
  return c.json({
    anzahl: rows.length,
    produkte: rows.map((p) => ({
      id: p.id, name: p.name, artikelnummer: p.artikelnummer,
      beschreibung: p.beschreibung, einheit: p.einheit,
      preisNetto: Number(p.preisNetto), ustSatz: p.ustSatz, kategorie: p.kategorie,
    })),
  });
});

app.get("/rechnung/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const r = await getDb().query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: { items: true },
  });
  if (!r) return c.json({ fehler: "Rechnung nicht gefunden." }, 404);
  r.items.sort((a, b) => a.position - b.position);
  return c.json({
    id: r.id, nummer: r.nummer, status: r.status,
    kunde: r.kundeName, kundenId: r.customerId,
    rechnungsdatum: r.rechnungsdatum, faelligkeitsdatum: r.faelligkeitsdatum,
    netto: Number(r.netto), ust: Number(r.ust), brutto: Number(r.brutto),
    bezahltBetrag: Number(r.bezahltBetrag),
    positionen: r.items.map((it) => ({
      position: it.position, bezeichnung: it.bezeichnung, beschreibung: it.beschreibung,
      menge: Number(it.menge), einheit: it.einheit, einzelpreis: Number(it.einzelpreis), ustSatz: it.ustSatz,
    })),
  });
});

/** Body tolerant lesen: JSON (application/json) ODER Formular (urlencoded). */
async function bodyLesen(c: { req: { json: () => Promise<Record<string, unknown>>; parseBody: () => Promise<Record<string, unknown>> } }): Promise<Record<string, unknown>> {
  try {
    return await c.req.json();
  } catch {
    try {
      return await c.req.parseBody();
    } catch {
      return {};
    }
  }
}

/** Ausgangsrechnung per interner ID ODER Nummer (Agent denkt in Nummern). */
async function rechnungFinden(idOderNummer: number | string) {
  const db = getDb();
  const n = Number(idOderNummer);
  if (Number.isFinite(n) && n > 0 && String(idOderNummer).match(/^\d+$/)) {
    const perId = await db.query.invoices.findFirst({ where: eq(invoices.id, n) });
    if (perId) return perId;
  }
  return db.query.invoices.findFirst({ where: eq(invoices.nummer, String(idOderNummer)) });
}

// ── Zuordnung schreiben/loesen (produktionserprobte Logik mit Reversal) ────
app.post("/bankbuchung/:id/zuordnen", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await bodyLesen(c);
  const rechnungKey = body.rechnungId ?? body.nummer ?? null;
  const eingangsrechnungId = body.eingangsrechnungId ? Number(body.eingangsrechnungId) : null;
  if (!rechnungKey && !eingangsrechnungId) {
    return c.json({ ok: false, fehler: "rechnungId/nummer (Ausgangsrechnung) oder eingangsrechnungId (Eingangsbeleg) angeben." }, 400);
  }
  const { zuordneIntern } = await import("./bankTransaktionenRouter");
  try {
    if (rechnungKey) {
      const r = await rechnungFinden(rechnungKey as number | string);
      if (!r) {
        return c.json({ ok: false, fehler: `Ausgangsrechnung „${rechnungKey}" nicht gefunden — interne ID (z. B. 17) oder Nummer (z. B. 2026-017) angeben.` }, 404);
      }
      await zuordneIntern(id, "ausgang", r.id);
      await audit("buchung_zugeordnet", { transaktionId: id, typ: "ausgang", rechnungId: r.id, nummer: r.nummer });
      return c.json({ ok: true, typ: "ausgang", rechnungId: r.id, nummer: r.nummer });
    }
    await zuordneIntern(id, "eingang", eingangsrechnungId!);
    await audit("buchung_zugeordnet", { transaktionId: id, typ: "eingang", eingangsrechnungId });
    return c.json({ ok: true, typ: "eingang", eingangsrechnungId });
  } catch (e) {
    return c.json({ ok: false, fehler: e instanceof Error ? e.message : String(e) }, 409);
  }
});

app.post("/bankbuchung/:id/loesen", async (c) => {
  const id = Number(c.req.param("id"));
  const { zuordnungLoesenIntern } = await import("./bankTransaktionenRouter");
  try {
    await zuordnungLoesenIntern(id);
    await audit("buchung_zuordnung_geloesen", { transaktionId: id });
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ fehler: e instanceof Error ? e.message : String(e) }, 409);
  }
});

// ── Mahnung anlegen (Vorschlag — Versand bleibt beim Menschen) ─────────────
app.post("/mahnung", async (c) => {
  const body = await bodyLesen(c);
  const rechnungId = Number(body.rechnungId);
  const stufe = Number(body.stufe ?? 1);
  if (!rechnungId || ![1, 2, 3].includes(stufe)) {
    return c.json({ fehler: "rechnungId und stufe (1–3) nötig." }, 400);
  }
  const db = getDb();
  const r = await db.query.invoices.findFirst({ where: eq(invoices.id, rechnungId) });
  if (!r) return c.json({ fehler: "Rechnung nicht gefunden." }, 404);
  if (r.status !== "finalisiert") return c.json({ fehler: "Mahnungen gibt es nur zu finalisierten Rechnungen." }, 409);
  const offen = Number(r.brutto) - Number(r.bezahltBetrag);
  if (offen <= 0) return c.json({ fehler: "Die Rechnung ist bereits bezahlt." }, 409);

  const frist = new Date();
  frist.setDate(frist.getDate() + 10);
  const [{ id }] = await db
    .insert(reminders)
    .values({
      invoiceId: r.id,
      stufe,
      datum: heute(),
      zahlungsfrist: body.zahlungsfrist ? String(body.zahlungsfrist) : frist.toISOString().slice(0, 10),
      offenBetrag: offen.toFixed(2),
      bemerkung: "Per Agent-API (Kimi Claw) angelegt",
    })
    .$returningId();
  await audit("mahnung_angelegt", { id, rechnungId, stufe, nummer: r.nummer });
  return c.json({ ok: true, id, stufe, nummer: r.nummer, hinweis: "Mahnung angelegt — PDF/Versand erfolgt durch einen Menschen." });
});

// ── Entwurf löschen (nur Entwürfe, GoBD) ───────────────────────────────────
app.delete("/entwurf/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = getDb();
  const r = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
  if (!r) return c.json({ fehler: "Rechnung nicht gefunden." }, 404);
  if (r.status !== "entwurf") return c.json({ fehler: "Nur Entwürfe sind löschbar (GoBD). Finalisierte Rechnungen bleiben unveränderbar." }, 409);
  await db.transaction(async (tx) => {
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    await tx.delete(invoices).where(eq(invoices.id, id));
  });
  await audit("entwurf_geloescht", { id, kunde: r.kundeName });
  return c.json({ ok: true, geloescht: id, kunde: r.kundeName });
});

app.get("/import-status", async (c) => {
  const rows = await getDb().query.bankImporte.findMany({ orderBy: [desc(bankImporte.createdAt)] });
  const letzter = rows[0];
  const tage = letzter
    ? Math.floor((Date.now() - letzter.createdAt.getTime()) / 86400000)
    : null;
  return c.json({
    letzterImport: letzter ? { datum: letzter.createdAt.toISOString(), dateiname: letzter.dateiname, zeilen: letzter.zeilen } : null,
    tageSeitImport: tage,
    erinnerungFaellig: tage === null || tage >= 5,
  });
});

// ── Aufgabenliste ──────────────────────────────────────────────────────────
app.get("/aufgaben", async (c) => {
  const rows = await getDb().query.agentAufgaben.findMany({ orderBy: [desc(agentAufgaben.createdAt)] });
  return c.json({
    offen: rows.filter((r) => !r.erledigt),
    erledigt: rows.filter((r) => r.erledigt).slice(0, 20),
  });
});

app.post("/aufgaben", async (c) => {
  const body = await bodyLesen(c);
  const text = String(body.text ?? "").trim();
  if (!text || text.length > 500) return c.json({ fehler: "text fehlt (max. 500 Zeichen)." }, 400);
  const faelligAm = body.faelligAm && /^\d{4}-\d{2}-\d{2}$/.test(String(body.faelligAm)) ? String(body.faelligAm) : null;
  const prioritaet = ["niedrig", "normal", "hoch"].includes(String(body.prioritaet)) ? String(body.prioritaet) : "normal";
  let referenzJson: string | null = null;
  if (body.referenz && typeof body.referenz === "object") {
    const r = body.referenz as Record<string, unknown>;
    if (["rechnung", "beleg", "patient", "plan"].includes(String(r.art)) && Number(r.id) > 0) {
      referenzJson = JSON.stringify({ art: String(r.art), id: Number(r.id) });
    }
  }
  const [{ id }] = await getDb()
    .insert(agentAufgaben)
    .values({ text, quelle: "agent", faelligAm, prioritaet, referenzJson })
    .$returningId();
  await audit("aufgabe_angelegt", { id, text, faelligAm, prioritaet });
  return c.json({ ok: true, id });
});

app.post("/aufgaben/:id/erledigt", async (c) => {
  const id = Number(c.req.param("id"));
  const db = getDb();
  const aufgabe = await db.query.agentAufgaben.findFirst({ where: eq(agentAufgaben.id, id) });
  if (!aufgabe) return c.json({ fehler: "Aufgabe nicht gefunden." }, 404);
  await db
    .update(agentAufgaben)
    .set({ erledigt: !aufgabe.erledigt, erledigtAm: aufgabe.erledigt ? null : new Date() })
    .where(eq(agentAufgaben.id, id));
  await audit("aufgabe_erledigt_gewechselt", { id, erledigt: !aufgabe.erledigt });
  return c.json({ ok: true, erledigt: !aufgabe.erledigt });
});

// ── Schreiben ──────────────────────────────────────────────────────────────
app.post("/kunde", async (c) => {
  const body = await bodyLesen(c);
  const name = String(body.name ?? "").trim();
  if (!name) return c.json({ fehler: "name fehlt." }, 400);
  const db = getDb();
  const [{ id }] = await db
    .insert(customers)
    .values({
      name,
      zusatz: body.zusatz ? String(body.zusatz) : null,
      strasse: String(body.strasse ?? "—"),
      plz: String(body.plz ?? "—"),
      ort: String(body.ort ?? "—"),
      land: body.land ? String(body.land) : "Deutschland",
      email: body.email ? String(body.email) : null,
    })
    .$returningId();
  await audit("kunde_angelegt", { id, name });
  return c.json({ ok: true, id, name });
});

app.post("/rechnung-entwurf", async (c) => {
  const body = await bodyLesen(c);
  const db = getDb();

  // Kunde: per ID oder per Namen (Fuzzy)
  let kunde: typeof customers.$inferSelect | undefined;
  if (body.kundenId) {
    kunde = await db.query.customers.findFirst({ where: eq(customers.id, Number(body.kundenId)) });
  } else if (body.kunde) {
    const alle = await db.select().from(customers);
    const t = besterTreffer(alle, String(body.kunde), (k) => k.name);
    kunde = t?.treffer;
  }
  if (!kunde) return c.json({ fehler: "Kunde nicht gefunden (kundenId oder kunde als Name angeben)." }, 404);

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return c.json({ fehler: "items fehlt: [{bezeichnung, menge?, einzelpreis, ustSatz?}]" }, 400);
  const positionen = items.map((it: Record<string, unknown>, i: number) => ({
    position: i + 1,
    bezeichnung: String(it.bezeichnung ?? "").slice(0, 500),
    beschreibung: it.beschreibung ? String(it.beschreibung) : null,
    menge: String(it.menge ?? "1"),
    einheit: String(it.einheit ?? "Stück"),
    einzelpreis: String(it.einzelpreis ?? "0"),
    ustSatz: [19, 7, 0].includes(Number(it.ustSatz)) ? Number(it.ustSatz) : 19,
  }));
  if (positionen.some((p: { bezeichnung: string }) => !p.bezeichnung)) return c.json({ fehler: "Jede Position braucht eine bezeichnung." }, 400);

  const settings = await db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) });
  const zielTage = kunde.zahlungszielTage ?? settings?.standardZahlungsziel ?? 14;
  const heuteD = new Date();
  const faellig = new Date(heuteD.getTime() + zielTage * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const standardBank = await db.query.bankAccounts.findFirst({ where: (b, { eq: e }) => e(b.istStandard, true) });

  const totals = computeTotals(positionen);
  const [{ id }] = await db
    .insert(invoices)
    .values({
      customerId: kunde.id,
      rechnungsdatum: fmt(heuteD),
      faelligkeitsdatum: fmt(faellig),
      bankAccountId: standardBank?.id ?? null,
      kundeName: kunde.name,
      kundeZusatz: kunde.zusatz,
      kundeStrasse: kunde.strasse,
      kundePlz: kunde.plz,
      kundeOrt: kunde.ort,
      kundeLand: kunde.land,
      pdfNotiz: body.pdfNotiz ? String(body.pdfNotiz) : null,
      bemerkung: "Erstellt per Agent-API (Kimi Claw) — bitte prüfen.",
      netto: centToDecimal(totals.nettoCent),
      ust: centToDecimal(totals.ustCent),
      brutto: centToDecimal(totals.bruttoCent),
    })
    .$returningId();
  await db.insert(invoiceItems).values(
    positionen.map((p) => ({
      invoiceId: id,
      position: p.position,
      bezeichnung: p.bezeichnung,
      beschreibung: p.beschreibung,
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      ustSatz: p.ustSatz,
    })),
  );
  await audit("rechnung_entwurf", { id, kunde: kunde.name, positionen: positionen.length, brutto: centToDecimal(totals.bruttoCent) });
  return c.json({ ok: true, id, kunde: kunde.name, brutto: centToDecimal(totals.bruttoCent), hinweis: "Entwurf angelegt — Freigabe erfolgt durch einen Menschen (oder Vollautomatik in Einstellungen)." });
});

app.post("/rechnung/:id/versenden", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await bodyLesen(c);
  const db = getDb();
  const r = await db.query.invoices.findFirst({ where: eq(invoices.id, id), with: { items: true, bankAccount: true } });
  if (!r) return c.json({ fehler: "Rechnung nicht gefunden." }, 404);
  if (r.status === "entwurf") return c.json({ fehler: "Rechnung ist noch Entwurf — erst finalisieren (bewusst nur per Hand oder späterer Freigabe-Stufe)." }, 409);

  const kundeRow = await db.query.customers.findFirst({ where: eq(customers.id, r.customerId) });
  const empfaenger = String(body.empfaenger ?? kundeRow?.email ?? "").trim();
  if (!empfaenger) return c.json({ fehler: "Keine Empfänger-Adresse (empfaenger angeben oder beim Kunden hinterlegen)." }, 400);

  // Granulare Autonomie (1.14.0): vollautomatik ODER Token-Freigabeliste
  const erlaubnis = await versandErlaubt(c, [empfaenger]);
  if (!erlaubnis.ok) {
    return c.json(
      {
        fehler: "Versand gesperrt: weder Stufe „vollautomatik“ noch Token-Freigabeliste deckt den Empfänger ab. Alternative: GET /rechnung/:id/pdf + Versand durch einen Menschen.",
      },
      403,
    );
  }

  const { ladeRechnungsBeleg } = await import("./pdfBelege");
  const { renderBelegPdf } = await import("./pdf");
  const { ladeSmtp } = await import("./lib/smtp");
  const { ladeDesign, ladeFirmaLive } = await import("./pdfBelege");
  const { mailLog } = await import("@db/schema");

  const { beleg, dateiname } = await ladeRechnungsBeleg(id);
  const pdf = await renderBelegPdf(beleg, await ladeDesign());
  const betreff = String(body.betreff ?? `Rechnung ${r.nummer ?? id}`);
  const text = String(body.text ?? `Anbei Ihre Rechnung ${r.nummer ?? id} als PDF.`);
  const { transporter, absender } = await ladeSmtp();

  let erfolg = true;
  let fehler: string | null = null;
  try {
    await transporter.sendMail({
      from: `"${absender}" <${(await ladeFirmaLive()).email ?? absender}>`,
      to: empfaenger,
      subject: betreff,
      text,
      attachments: [{ filename: `Rechnung ${dateiname}.pdf`, content: pdf, contentType: "application/pdf" }],
    });
  } catch (e) {
    erfolg = false;
    fehler = e instanceof Error ? e.message : String(e);
  }
  await db.insert(mailLog).values({ belegArt: "invoice", belegId: id, empfaenger, betreff, erfolg, fehler });
  await audit("rechnung_versendet", { id, empfaenger, erfolg, fehler });
  if (!erfolg) return c.json({ fehler: `Versand fehlgeschlagen: ${fehler}` }, 502);
  return c.json({ ok: true, empfaenger });
});

// ══════════════════════════════════════════════════════════════════════════
// ── PaWaWi-Domäne (1.13.0): Patienten, Therapiepläne, Termine, Rezepte ─────
// Pseudonymisierung an der API-Grenze: Die KI arbeitet mit P-Nummern,
// Jahrgang und Ort. Klarnamen, volle Adressen, E-Mails und Geburtsdaten
// bleiben im System (Einstellungen → Agent-API, Standard: an).
// ══════════════════════════════════════════════════════════════════════════

async function pseudonymAn(): Promise<boolean> {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
    columns: { agentPseudonym: true },
  });
  return s?.agentPseudonym ?? true;
}

type Kunde = typeof customers.$inferSelect;

/** Patient in der Agent-Ansicht: pseudonymisiert ODER voll (je nach Schalter). */
function patientMaske(k: Kunde, pseudo: boolean) {
  if (!pseudo) {
    return {
      id: k.id, pseudonym: k.synonym, name: k.name, geburtsdatum: k.geburtsdatum,
      strasse: k.strasse, plz: k.plz, ort: k.ort, email: k.email, telefon: k.telefon,
      patientenNr: k.patientenNr, krankenkasse: k.krankenkasse, tags: k.tags,
    };
  }
  // Strenger Modus (Gesundheitsdaten): kein Name, keine vollständige Adresse,
  // nur Jahrgang statt Geburtsdatum, keine Kontaktdaten.
  return {
    id: k.id,
    pseudonym: k.synonym,
    jahrgang: k.geburtsdatum ? Number(String(k.geburtsdatum).slice(0, 4)) : null,
    ort: k.ort,
    tags: k.tags,
  };
}

// ── Patienten: suchen, lesen, anlegen (mit Dubletten-Prüfung) ──────────────
app.get("/patienten", async (c) => {
  const pseudo = await pseudonymAn();
  const q = (c.req.query("q") ?? "").trim();
  const limit = Math.max(1, Math.min(100, Number(c.req.query("limit") ?? "50")));
  const db = getDb();
  const rows = q
    ? await db.select().from(customers).where(like(customers.name, `%${q}%`)).limit(limit)
    : await db.select().from(customers).orderBy(asc(customers.name)).limit(limit);
  return c.json({
    anzahl: rows.length,
    pseudonymisiert: pseudo,
    patienten: rows.map((k) => patientMaske(k, pseudo)),
  });
});

app.get("/patient/nach-name/:name", async (c) => {
  const pseudo = await pseudonymAn();
  const name = decodeURIComponent(c.req.param("name") ?? "").trim();
  if (name.length < 2) return c.json({ fehler: "Name zu kurz (min. 2 Zeichen)." }, 400);
  const alle = await getDb().select().from(customers);
  const { fuzzyScore } = await import("@contracts/fuzzy");
  const kandidaten = alle
    .map((k) => ({ k, roh: fuzzyScore(k.name, name) }))
    .filter((x): x is { k: Kunde; roh: number } => x.roh !== null && x.roh >= 40)
    .sort((a, b) => b.roh - a.roh)
    .slice(0, 5)
    .map((x) => ({ k: x.k, score: Math.min(1, Math.round((x.roh / 100) * 100) / 100) }));
  return c.json({
    anzahl: kandidaten.length,
    kandidaten: kandidaten.map((x) => ({ ...patientMaske(x.k, pseudo), score: Math.round(x.score * 100) / 100 })),
  });
});

app.get("/patient/:id", async (c) => {
  const pseudo = await pseudonymAn();
  const id = Number(c.req.param("id"));
  const k = await getDb().query.customers.findFirst({ where: eq(customers.id, id) });
  if (!k) return c.json({ fehler: "Patient nicht gefunden." }, 404);
  return c.json(patientMaske(k, pseudo));
});

app.post("/patient", async (c) => {
  const body = await bodyLesen(c);
  const name = String(body.name ?? "").trim();
  if (!name) return c.json({ fehler: "name fehlt (Format: „Nachname, Vorname“)." }, 400);
  const geb = body.geburtsdatum ? String(body.geburtsdatum).slice(0, 10) : null;
  if (geb && !/^\d{4}-\d{2}-\d{2}$/.test(geb)) {
    return c.json({ fehler: "geburtsdatum im Format JJJJ-MM-TT angeben." }, 400);
  }
  const db = getDb();

  // Dubletten-Prüfung: gleicher Name (case-insensitiv) + gleiches Geburtsdatum
  const namensTreffer = await db.select().from(customers).where(like(customers.name, name));
  const dublette = namensTreffer.find(
    (k) => k.name.toLowerCase() === name.toLowerCase() && (!geb || k.geburtsdatum === geb),
  );
  if (dublette) {
    return c.json({
      ok: false, fehler: "Patient existiert bereits (Name + Geburtsdatum).",
      vorhanden: { id: dublette.id, pseudonym: dublette.synonym },
    }, 409);
  }

  const id = await db.transaction(async (tx) => {
    const patientenNr = await naechstePatientenNr(tx);
    const [{ id: neuId }] = await tx
      .insert(customers)
      .values({
        name,
        geburtsdatum: geb,
        patientenNr,
        strasse: String(body.strasse ?? "—"),
        plz: String(body.plz ?? "—"),
        ort: String(body.ort ?? "—"),
        land: body.land ? String(body.land) : "Deutschland",
        email: body.email ? String(body.email) : null,
        telefon: body.telefon ? String(body.telefon) : null,
        krankenkasse: body.krankenkasse ? String(body.krankenkasse) : null,
      })
      .$returningId();
    await tx.update(customers).set({ synonym: `P-${String(neuId).padStart(4, "0")}` }).where(eq(customers.id, neuId));
    return neuId;
  });
  await audit("patient_angelegt", { id });
  return c.json({ ok: true, id, pseudonym: `P-${String(id).padStart(4, "0")}`, hinweis: "Patient angelegt — Stammdaten bitte in der Akte vervollständigen/prüfen." });
});

// ── Therapiepläne: lesen + Entwurf anlegen ─────────────────────────────────
app.get("/therapieplaene", async (c) => {
  const pseudo = await pseudonymAn();
  const db = getDb();
  const bed = [];
  if (c.req.query("patientId")) bed.push(eq(therapyPlans.patientId, Number(c.req.query("patientId"))));
  if (c.req.query("status")) bed.push(eq(therapyPlans.status, c.req.query("status") as "geplant"));
  bed.push(isNull(therapyPlans.geloeschtAm));
  const plaene = await db.query.therapyPlans.findMany({
    where: bed.length ? and(...bed) : undefined,
    orderBy: [desc(therapyPlans.createdAt)],
    with: { patient: { columns: { id: true, name: true, synonym: true, geburtsdatum: true, ort: true } } },
    limit: 100,
  });
  const zaehler = await db.select({ planId: planEntries.planId, n: planEntries.id }).from(planEntries);
  const anzahlJe = new Map<number, number>();
  for (const z of zaehler) anzahlJe.set(z.planId, (anzahlJe.get(z.planId) ?? 0) + 1);
  return c.json({
    anzahl: plaene.length,
    plaene: plaene.map((p) => ({
      id: p.id,
      patient: p.patient
        ? pseudo
          ? { id: p.patient.id, pseudonym: p.patient.synonym, jahrgang: p.patient.geburtsdatum ? Number(String(p.patient.geburtsdatum).slice(0, 4)) : null, ort: p.patient.ort }
          : { id: p.patient.id, name: p.patient.name, pseudonym: p.patient.synonym }
        : null,
      titel: p.titel,
      vonDatum: p.vonDatum,
      bisDatum: p.bisDatum,
      status: p.status,
      anzahlEintraege: anzahlJe.get(p.id) ?? 0,
    })),
  });
});

app.get("/therapieplan/:id", async (c) => {
  const pseudo = await pseudonymAn();
  const id = Number(c.req.param("id"));
  const p = await getDb().query.therapyPlans.findFirst({
    where: eq(therapyPlans.id, id),
    with: {
      patient: { columns: { id: true, name: true, synonym: true, geburtsdatum: true, ort: true } },
      entries: { orderBy: [asc(planEntries.datum), asc(planEntries.zeitVon), asc(planEntries.reihenfolge)] },
    },
  });
  if (!p) return c.json({ fehler: "Therapieplan nicht gefunden." }, 404);
  return c.json({
    id: p.id,
    patient: p.patient
      ? pseudo
        ? { id: p.patient.id, pseudonym: p.patient.synonym, jahrgang: p.patient.geburtsdatum ? Number(String(p.patient.geburtsdatum).slice(0, 4)) : null, ort: p.patient.ort }
        : { id: p.patient.id, name: p.patient.name, pseudonym: p.patient.synonym }
      : null,
    titel: p.titel,
    vonDatum: p.vonDatum,
    bisDatum: p.bisDatum,
    status: p.status,
    diagnoseZiele: p.diagnoseZiele,
    eintraege: p.entries.map((e) => ({
      id: e.id, datum: e.datum, zeitVon: e.zeitVon, zeitBis: e.zeitBis,
      leistungId: e.leistungId, leistung: e.leistungText,
      menge: Number(e.menge), raum: e.raum, status: e.status,
    })),
  });
});

const DATUM_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;

app.post("/therapieplan-entwurf", async (c) => {
  const body = await bodyLesen(c);
  const db = getDb();

  // Patient: per ID oder per Namen (Fuzzy)
  let patient: Kunde | undefined;
  if (body.patientId) {
    patient = await db.query.customers.findFirst({ where: eq(customers.id, Number(body.patientId)) });
  } else if (body.patient) {
    const alle = await db.select().from(customers);
    patient = besterTreffer(alle, String(body.patient), (k) => k.name)?.treffer;
  }
  if (!patient) {
    return c.json({ fehler: "Patient nicht gefunden (patientId oder patient als Name; ggf. vorher POST /patient)." }, 404);
  }

  const vonDatum = String(body.vonDatum ?? "");
  const bisDatum = String(body.bisDatum ?? "");
  if (!DATUM_ISO.test(vonDatum) || !DATUM_ISO.test(bisDatum)) {
    return c.json({ fehler: "vonDatum und bisDatum im Format JJJJ-MM-TT nötig." }, 400);
  }
  if (bisDatum < vonDatum) return c.json({ fehler: "bisDatum liegt vor vonDatum." }, 400);

  const eintraege = Array.isArray(body.eintraege) ? body.eintraege : [];
  if (eintraege.length === 0 || eintraege.length > 500) {
    return c.json({ fehler: "eintraege fehlt: [{datum, zeitVon?, leistungText | leistungId, menge?}] (1–500)." }, 400);
  }
  const katalog = new Map((await db.select().from(products)).map((p) => [p.id, p]));
  const sauber: {
    datum: string; zeitVon: string | null; zeitBis: string | null;
    leistungId: number | null; leistungText: string | null; menge: string; raum: string | null;
  }[] = [];
  for (const [i, e] of eintraege.entries()) {
    const r = e as Record<string, unknown>;
    const datum = String(r.datum ?? "");
    if (!DATUM_ISO.test(datum)) return c.json({ fehler: `Eintrag ${i + 1}: datum im Format JJJJ-MM-TT nötig.` }, 400);
    if (datum < vonDatum || datum > bisDatum) return c.json({ fehler: `Eintrag ${i + 1}: datum außerhalb des Plan-Zeitraums.` }, 400);
    const zeitVon = r.zeitVon ? String(r.zeitVon) : null;
    const zeitBis = r.zeitBis ? String(r.zeitBis) : null;
    if (zeitVon && !ZEIT.test(zeitVon)) return c.json({ fehler: `Eintrag ${i + 1}: zeitVon als SS:MM.` }, 400);
    if (zeitBis && !ZEIT.test(zeitBis)) return c.json({ fehler: `Eintrag ${i + 1}: zeitBis als SS:MM.` }, 400);
    let leistungId: number | null = null;
    let leistungText: string | null = r.leistungText ? String(r.leistungText).slice(0, 255) : null;
    if (r.leistungId) {
      const prod = katalog.get(Number(r.leistungId));
      if (!prod) return c.json({ fehler: `Eintrag ${i + 1}: leistungId ${r.leistungId} nicht im Katalog (GET /leistungskatalog).` }, 404);
      leistungId = prod.id;
      if (!leistungText) leistungText = prod.name;
    }
    if (!leistungText && !leistungId) {
      return c.json({ fehler: `Eintrag ${i + 1}: leistungText oder leistungId nötig.` }, 400);
    }
    sauber.push({
      datum, zeitVon, zeitBis, leistungId, leistungText,
      menge: String(r.menge ?? "1"), raum: r.raum ? String(r.raum).slice(0, 100) : null,
    });
  }

  const planId = await db.transaction(async (tx) => {
    const [{ id: neuId }] = await tx
      .insert(therapyPlans)
      .values({
        patientId: patient!.id,
        titel: body.titel ? String(body.titel).slice(0, 255) : `Therapieplan ${vonDatum} – ${bisDatum}`,
        vonDatum,
        bisDatum,
        diagnoseZiele: body.diagnoseZiele ? String(body.diagnoseZiele).slice(0, 4000) : null,
        status: "geplant",
        notizen: "Erstellt per Agent-API (Kimi Claw) — bitte prüfen und aktivieren.",
      })
      .$returningId();
    // Reihenfolge je Tag in der übergebenen Reihenfolge nummerieren
    const zaehlerJeTag = new Map<string, number>();
    await tx.insert(planEntries).values(
      sauber.map((e) => {
        const n = (zaehlerJeTag.get(e.datum) ?? 0) + 1;
        zaehlerJeTag.set(e.datum, n);
        return { ...e, planId: neuId, reihenfolge: n };
      }),
    );
    return neuId;
  });
  await audit("therapieplan_entwurf", { planId, patientId: patient.id, eintraege: sauber.length });
  return c.json({
    ok: true,
    id: planId,
    patient: { id: patient.id, pseudonym: patient.synonym },
    eintraege: sauber.length,
    hinweis: "Plan als „geplant“ angelegt — die Praxis prüft und aktiviert ihn (Status bleibt bewusst beim Menschen).",
  });
});

// ── Termine (Kalender = Plan-Einträge mit Datum/Zeit) ──────────────────────
app.get("/termine", async (c) => {
  const pseudo = await pseudonymAn();
  const von = c.req.query("von") ?? heute();
  const bis = c.req.query("bis") ?? von;
  const patientId = c.req.query("patientId") ? Number(c.req.query("patientId")) : null;
  const db = getDb();
  const bed = [gte(planEntries.datum, von), lte(planEntries.datum, bis)];
  const rows = await db
    .select({ e: planEntries, plan: therapyPlans })
    .from(planEntries)
    .innerJoin(therapyPlans, eq(planEntries.planId, therapyPlans.id))
    .where(and(...bed))
    .orderBy(asc(planEntries.datum), asc(planEntries.zeitVon))
    .limit(500);
  const patienten = new Map<number, Kunde>();
  for (const k of await db.select().from(customers)) patienten.set(k.id, k);
  return c.json({
    von, bis,
    anzahl: rows.length,
    termine: rows
      .filter((r) => (patientId ? r.plan.patientId === patientId : true))
      .filter((r) => !r.plan.geloeschtAm)
      .map((r) => {
        const k = patienten.get(r.plan.patientId);
        return {
          eintragId: r.e.id,
          planId: r.plan.id,
          datum: r.e.datum,
          zeitVon: r.e.zeitVon,
          zeitBis: r.e.zeitBis,
          leistung: r.e.leistungText,
          raum: r.e.raum,
          status: r.e.status,
          patient: k ? patientMaske(k, pseudo) : null,
        };
      }),
  });
});

// ── Rezepte/Atteste: nur Metadaten (Inhalte bleiben lokal) ─────────────────
app.get("/rezepte", async (c) => {
  const pseudo = await pseudonymAn();
  const db = getDb();
  const patientId = c.req.query("patientId") ? Number(c.req.query("patientId")) : null;
  const rows = await db.query.rezepte.findMany({
    where: patientId ? eq(rezepte.patientId, patientId) : undefined,
    orderBy: [desc(rezepte.createdAt)],
    limit: 100,
  });
  const patienten = new Map<number, Kunde>();
  for (const k of await db.select().from(customers)) patienten.set(k.id, k);
  return c.json({
    anzahl: rows.length,
    rezepte: rows.map((r) => ({
      id: r.id,
      typ: r.typ,
      erstelltAm: r.createdAt,
      patient: r.patientId ? patientMaske(patienten.get(r.patientId)!, pseudo) : null,
      hinweis: "Nur Metadaten — PDF-Inhalte verlassen den Server nicht (Gesundheitsdaten).",
    })),
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ── Agent-API v3 (1.14.0, ReWaWi-Sync v1.17): Transparenz, Briefing, ───────
// ── Kunden-Suite, Rechnungs-Aktionen, Webhooks ─────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

// ── Transparenz: vollständiges Aktions-Log ─────────────────────────────────
app.get("/audit-log", async (c) => {
  const von = c.req.query("von");
  const bis = c.req.query("bis");
  const aktion = c.req.query("aktion");
  const limit = Math.max(1, Math.min(500, Number(c.req.query("limit") ?? "100")));
  const bed = [];
  if (von) bed.push(gte(agentLog.createdAt, new Date(`${von}T00:00:00`)));
  if (bis) bed.push(lte(agentLog.createdAt, new Date(`${bis}T23:59:59`)));
  if (aktion) bed.push(eq(agentLog.aktion, aktion));
  const rows = await getDb().query.agentLog.findMany({
    where: bed.length ? and(...bed) : undefined,
    orderBy: [desc(agentLog.createdAt)],
    limit,
  });
  return c.json({ anzahl: rows.length, eintraege: rows });
});

// ── Morgen-Briefing: ein Call für den Tagesstart ───────────────────────────
app.get("/uebersicht/heute", async (c) => {
  const db = getDb();
  const h = heute();
  const pseudo = await pseudonymAn();
  const { bankTransaktionen } = await import("@db/schema");
  const { sql } = await import("drizzle-orm");

  const termineHeute = await db
    .select({ e: planEntries, plan: therapyPlans })
    .from(planEntries)
    .innerJoin(therapyPlans, eq(planEntries.planId, therapyPlans.id))
    .where(and(eq(planEntries.datum, h), isNull(therapyPlans.geloeschtAm)))
    .orderBy(asc(planEntries.zeitVon));

  const [offenBank] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(bankTransaktionen)
    .where(and(eq(bankTransaktionen.status, "offen"), sql`${bankTransaktionen.invoiceId} IS NULL`, sql`${bankTransaktionen.incomingInvoiceId} IS NULL`));

  const aufgabenOffen = await db.select().from(agentAufgaben).where(eq(agentAufgaben.erledigt, false));

  const finale = await db.select().from(invoices).where(eq(invoices.status, "finalisiert"));
  const ueberfaellig = finale
    .filter((r) => Number(r.brutto) - Number(r.bezahltBetrag) > 0.004 && r.faelligkeitsdatum < h)
    .map((r) => ({ rechnungId: r.id, nummer: r.nummer, kundenId: r.customerId, offen: Number(r.brutto) - Number(r.bezahltBetrag), faelligkeitsdatum: r.faelligkeitsdatum }));

  const patienten = new Map<number, Kunde>();
  for (const k of await db.select().from(customers)) patienten.set(k.id, k);

  return c.json({
    datum: h,
    termineHeute: termineHeute.map((r) => ({
      eintragId: r.e.id, planId: r.plan.id, zeitVon: r.e.zeitVon, zeitBis: r.e.zeitBis,
      leistung: r.e.leistungText, raum: r.e.raum, status: r.e.status,
      patient: patienten.get(r.plan.patientId) ? patientMaske(patienten.get(r.plan.patientId)!, pseudo) : null,
    })),
    ueberfaelligeRechnungen: ueberfaellig,
    bankOffenOhneZuordnung: Number(offenBank?.n ?? 0),
    aufgabenOffen: aufgabenOffen.map((a) => ({ id: a.id, text: a.text, prioritaet: a.prioritaet, faelligAm: a.faelligAm })),
  });
});

// ── Zahlungsziele: was ist wann fällig (Mahnungen, offene Rechnungen, Eingang)
app.get("/zahlungsziele", async (c) => {
  const db = getDb();
  const von = c.req.query("von") ?? "2000-01-01";
  const bis = c.req.query("bis") ?? "2100-01-01";
  const h = heute();
  const eintraege: { art: string; datum: string; betrag: number; referenz: string; ueberfaellig: boolean }[] = [];

  const finale = await db.select().from(invoices).where(eq(invoices.status, "finalisiert"));
  for (const r of finale) {
    const offen = Number(r.brutto) - Number(r.bezahltBetrag);
    if (offen > 0.004 && r.faelligkeitsdatum >= von && r.faelligkeitsdatum <= bis) {
      eintraege.push({ art: "ausgangsrechnung", datum: r.faelligkeitsdatum, betrag: offen, referenz: r.nummer ?? `#${r.id}`, ueberfaellig: r.faelligkeitsdatum < h });
    }
  }
  const { incomingInvoices } = await import("@db/schema");
  const eingehend = await db.select().from(incomingInvoices);
  for (const r of eingehend) {
    if (r.bezahltAm) continue;
    const f = r.faelligkeitsdatum ?? r.rechnungsdatum;
    if (f >= von && f <= bis) {
      eintraege.push({ art: "eingangsrechnung", datum: f, betrag: Number(r.brutto), referenz: `${r.lieferantName} ${r.nummer}`, ueberfaellig: f < h });
    }
  }
  const mahnungen = await db.select().from(reminders);
  for (const m of mahnungen) {
    if (m.zahlungsfrist >= von && m.zahlungsfrist <= bis) {
      eintraege.push({ art: "mahnung", datum: m.zahlungsfrist, betrag: Number(m.offenBetrag), referenz: `Stufe ${m.stufe} (Rechnung #${m.invoiceId})`, ueberfaellig: m.zahlungsfrist < h });
    }
  }
  eintraege.sort((a, b) => (a.datum < b.datum ? -1 : 1));
  return c.json({ von, bis, anzahl: eintraege.length, eintraege });
});

// ── Kunden-Suite (ReWaWi-Parität; für Akten-Zwecke /patient* bevorzugen) ────
app.get("/kunde/:id", async (c) => {
  const pseudo = await pseudonymAn();
  const id = Number(c.req.param("id"));
  const k = await getDb().query.customers.findFirst({ where: eq(customers.id, id) });
  if (!k) return c.json({ fehler: "Kunde nicht gefunden." }, 404);
  return c.json(patientMaske(k, pseudo));
});

app.put("/kunde/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await bodyLesen(c);
  const db = getDb();
  const k = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  if (!k) return c.json({ fehler: "Kunde nicht gefunden." }, 404);
  const felder = ["name", "zusatz", "strasse", "plz", "ort", "land", "email", "telefon", "krankenkasse", "geburtsdatum", "tags"] as const;
  const setze: Record<string, unknown> = {};
  for (const f of felder) if (body[f] !== undefined) setze[f] = body[f] === null ? null : String(body[f]);
  if (Object.keys(setze).length === 0) return c.json({ fehler: `Keine Felder zum Aktualisieren (erlaubt: ${felder.join(", ")}).` }, 400);
  await db.update(customers).set(setze).where(eq(customers.id, id));
  await audit("kunde_aktualisiert", { id, felder: Object.keys(setze) });
  return c.json({ ok: true, id, aktualisiert: Object.keys(setze) });
});

app.get("/kunde/nach-email/:email", async (c) => {
  const pseudo = await pseudonymAn();
  const email = decodeURIComponent(c.req.param("email") ?? "").toLowerCase().trim();
  if (!email.includes("@")) return c.json({ fehler: "E-Mail-Adresse angeben." }, 400);
  const alle = await getDb().select().from(customers);
  const treffer = alle.find((k) => k.email?.toLowerCase().trim() === email);
  if (!treffer) return c.json({ gefunden: false });
  return c.json({ gefunden: true, ...patientMaske(treffer, pseudo) });
});

app.get("/kunde/:id/rechnungen", async (c) => {
  const id = Number(c.req.param("id"));
  const rows = await getDb().query.invoices.findMany({
    where: eq(invoices.customerId, id),
    orderBy: [desc(invoices.rechnungsdatum)],
  });
  return c.json({
    kundenId: id,
    anzahl: rows.length,
    rechnungen: rows.map((r) => ({
      id: r.id, nummer: r.nummer, status: r.status, datum: r.rechnungsdatum,
      brutto: Number(r.brutto), bezahlt: Number(r.bezahltBetrag),
      offen: Number(r.brutto) - Number(r.bezahltBetrag),
    })),
  });
});

// ── Rechnungs-Aktionen: PDF, Zahlung, Storno ───────────────────────────────
app.get("/rechnung/:id/pdf", async (c) => {
  const id = Number(c.req.param("id"));
  const r = await getDb().query.invoices.findFirst({ where: eq(invoices.id, id) });
  if (!r) return c.json({ fehler: "Rechnung nicht gefunden." }, 404);
  if (r.status === "entwurf") return c.json({ fehler: "Entwürfe haben noch kein GoBD-PDF (erst finalisieren)." }, 409);
  const { ladeRechnungsBeleg, ladeDesign } = await import("./pdfBelege");
  const { renderBelegPdf } = await import("./pdf");
  const { beleg, dateiname } = await ladeRechnungsBeleg(id);
  const pdf = await renderBelegPdf(beleg, await ladeDesign());
  return c.json({ ok: true, dateiname: `Rechnung-${dateiname}.pdf`, base64: pdf.toString("base64"), mime: "application/pdf" });
});

app.post("/rechnung/:id/zahlung", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await bodyLesen(c);
  const db = getDb();
  const r = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
  if (!r) return c.json({ fehler: "Rechnung nicht gefunden." }, 404);
  if (r.status === "entwurf") return c.json({ fehler: "Entwurf muss zuerst finalisiert werden." }, 409);
  const datum = body.datum && /^\d{4}-\d{2}-\d{2}$/.test(String(body.datum)) ? String(body.datum) : heute();
  const betrag = body.betrag !== undefined ? String(Number(body.betrag).toFixed(2)) : r.brutto;
  await db
    .update(invoices)
    .set({ bezahltBetrag: betrag, bezahltAm: datum })
    .where(eq(invoices.id, id));
  await audit("rechnung_zahlung", { id, nummer: r.nummer, betrag, datum });
  return c.json({ ok: true, id, nummer: r.nummer, bezahltBetrag: betrag, bezahltAm: datum, hinweis: "Manuell gebucht — für den Bankabgleich zusätzlich POST /bankbuchung/:id/zuordnen nutzen." });
});

app.post("/rechnung/:id/stornieren", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await bodyLesen(c);
  const db = getDb();
  const r = await db.query.invoices.findFirst({ where: eq(invoices.id, id), with: { items: true } });
  if (!r) return c.json({ fehler: "Rechnung nicht gefunden." }, 404);
  if (r.status === "entwurf") return c.json({ fehler: "Entwürfe löschen statt stornieren (DELETE /entwurf/:id)." }, 409);
  if (r.status === "storniert") return c.json({ fehler: "Rechnung ist bereits storniert." }, 409);
  const { creditNotes, creditNoteItems } = await import("@db/schema");
  const { nextNumber, formatCreditNoteNumber } = await import("./queries/invoicing");

  const nummer = await db.transaction(async (tx) => {
    // Gutschrift-Entwurf mit allen Positionen (Vollstorno)
    const [{ id: gId }] = await tx
      .insert(creditNotes)
      .values({
        invoiceId: r.id,
        datum: heute(),
        grund: body.grund ? String(body.grund).slice(0, 500) : "Storno per Agent-API (Kimi Claw)",
        kundeName: r.kundeName,
        kundeZusatz: r.kundeZusatz,
        kundeStrasse: r.kundeStrasse,
        kundePlz: r.kundePlz,
        kundeOrt: r.kundeOrt,
        kundeLand: r.kundeLand,
        netto: r.netto, ust: r.ust, brutto: r.brutto,
      })
      .$returningId();
    await tx.insert(creditNoteItems).values(
      r.items.map((it) => ({
        creditNoteId: gId,
        position: it.position,
        bezeichnung: it.bezeichnung,
        beschreibung: it.beschreibung,
        menge: it.menge,
        einheit: it.einheit,
        einzelpreis: it.einzelpreis,
        ustSatz: it.ustSatz,
      })),
    );
    // Finalisieren (ST-Nummer + Firmen-Snapshot) + Vollstorno-Buchung
    const settings = await tx.query.companySettings.findFirst({ where: eq(companySettings.id, 1) });
    const firmenSnapshot = JSON.stringify({
      name: settings?.name, strasse: settings?.strasse, plz: settings?.plz, ort: settings?.ort,
      land: settings?.land, handelsregister: settings?.handelsregister, steuernummer: settings?.steuernummer,
      ustIdNr: settings?.ustIdNr, email: settings?.email, telefon: settings?.telefon,
      webseite: settings?.webseite, fussText: settings?.fussText,
    });
    const n = await nextNumber(tx, "credit_note", 0);
    const nr = formatCreditNoteNumber(n);
    await tx
      .update(creditNotes)
      .set({ nummer: nr, status: "finalisiert", finalizedAt: new Date(), firmenSnapshot })
      .where(eq(creditNotes.id, gId));
    await tx.update(invoices).set({ status: "storniert" }).where(eq(invoices.id, r.id));
    return nr;
  });
  await audit("rechnung_storniert", { id, nummer: r.nummer, gutschrift: nummer });
  return c.json({ ok: true, rechnung: r.nummer, gutschrift: nummer, hinweis: "Vollstorno gebucht — GoBD-Gutschrift finalisiert." });
});

// ── Webhooks verwalten ─────────────────────────────────────────────────────
app.get("/webhooks", async (c) => {
  const { webhooks } = await import("@db/schema");
  return c.json({ webhooks: await getDb().select().from(webhooks) });
});

app.post("/webhooks", async (c) => {
  const body = await bodyLesen(c);
  const ereignis = String(body.ereignis ?? "").trim();
  const url = String(body.url ?? "").trim();
  if (!["bankbuchung.neu"].includes(ereignis)) {
    return c.json({ fehler: "ereignis unbekannt — derzeit: bankbuchung.neu (mail.neu folgt mit dem Mail-Modul)." }, 400);
  }
  if (!/^https?:\/\//.test(url)) return c.json({ fehler: "url muss mit http(s):// beginnen." }, 400);
  const { webhooks } = await import("@db/schema");
  const [{ id }] = await getDb().insert(webhooks).values({ ereignis, url }).$returningId();
  await audit("webhook_registriert", { id, ereignis, url });
  return c.json({ ok: true, id });
});

app.delete("/webhooks/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { webhooks } = await import("@db/schema");
  const w = await getDb().query.webhooks.findFirst({ where: eq(webhooks.id, id) });
  if (!w) return c.json({ fehler: "Webhook nicht gefunden." }, 404);
  await getDb().delete(webhooks).where(eq(webhooks.id, id));
  await audit("webhook_geloescht", { id, ereignis: w.ereignis });
  return c.json({ ok: true });
});

export default app;
