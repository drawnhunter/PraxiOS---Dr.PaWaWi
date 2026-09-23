import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminQuery,
  authedQuery,
  createRouter,
} from "./middleware";
import { getDb } from "./queries/connection";
import { verschluesseln } from "./lib/secrets";
import { patientenNrVorschau } from "./lib/patientenNr";
import crypto from "node:crypto";
import { companySettings, numberSequences } from "@db/schema";
import { eq, and } from "drizzle-orm";

const settingsInput = z.object({
  name: z.string().min(1),
  strasse: z.string().min(1),
  plz: z.string().min(1),
  ort: z.string().min(1),
  land: z.string().default("Deutschland"),
  handelsregister: z.string().nullable().optional(),
  steuernummer: z.string().nullable().optional(),
  ustIdNr: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  telefon: z.string().nullable().optional(),
  webseite: z.string().nullable().optional(),
  arztNr: z.string().max(20).nullable().optional(),
  betriebsstaettenNr: z.string().max(20).nullable().optional(),
  fachrichtung: z.string().max(120).nullable().optional(),
  oeffentlicheUrl: z.string().max(255).nullable().optional(),
  jitsiBaseUrl: z.string().max(255).nullable().optional(),
  jitsiAppId: z.string().max(60).nullable().optional(),
  jitsiAppSecret: z.string().max(255).nullable().optional(),
  standardZahlungsziel: z.number().int().min(0).max(120),
  fussText: z.string().nullable().optional(),
  datevBeraternummer: z.string().nullable().optional(),
  datevMandantennummer: z.string().nullable().optional(),
  datevKontenrahmen: z.enum(["SKR03", "SKR04"]).default("SKR03"),
  erloeskonto19: z.string().default("8400"),
  erloeskonto7: z.string().default("8300"),
  erloeskonto0: z.string().default("8120"),
  debitorStartnummer: z.number().int().min(1).default(10000),
  kreditorStartnummer: z.number().int().min(1).default(70000),
  aufwandskontoDefault: z.string().max(10).nullable().optional(),
  // Company Control (ReWaWi v1.6): registrierte Kennnummern
  eori: z.string().max(30).nullable().optional(),
  betriebsnummer: z.string().max(30).nullable().optional(),
  bgMitgliedsnummer: z.string().max(50).nullable().optional(),
  ihk: z.string().max(60).nullable().optional(),
  glaeubigerId: z.string().max(30).nullable().optional(),
  waehrung: z.string().max(10).optional(),
  // Patientennummern-Nummernkreis (1.7.0)
  patientenNrStart: z.number().int().min(1).optional(),
  patientenNrPrefixAktiv: z.boolean().optional(),
  patientenNrPrefix: z.string().trim().min(1).max(20).optional(),
  akzentfarbe: z
    .enum(["petrol", "neutral", "blau", "gruen", "bernstein", "violett", "rot"])
    .default("petrol"),
  pdfLayout: z.enum(["klassisch", "modern", "kompakt"]).default("klassisch"),
  // SMTP (E-Mail-Versand); smtpPasswort wird nur gesetzt, wenn nicht leer
  smtpHost: z.string().nullable().optional(),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpUser: z.string().nullable().optional(),
  smtpAbsender: z.string().nullable().optional(),
  signatur: z.string().max(2000).nullable().optional(),
  smtpPasswort: z.string().max(200).optional(),
  erinnerungAktiv: z.boolean().optional(),
  erinnerungTageVorher: z.number().int().min(1).max(7).optional(),
});

export const settingsRouter = createRouter({
  get: authedQuery.query(async () => {
    const row = await getDb().query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
    });
    if (!row) return null;
    // age_secret verlässt den Server nie (geheimer Schlüssel für den Austausch);
    // das Unterschriftsbild ist zu groß für den Routine-GET (nur Flag + eigenes Query)
    const { ageSecret: _geheim, smtpPasswortEnc: _smtp, signaturBild: _sig, ...oeffentlich } = row;
    return {
      ...oeffentlich,
      ageSecretVorhanden: !!row.ageSecret,
      smtpPasswortGesetzt: !!row.smtpPasswortEnc,
      signaturVorhanden: !!row.signaturBild,
    };
  }),

  // Unterschriftsbild (base64-Data-URL) für Rezepte/Atteste — nur Verwaltung
  signatur: adminQuery.query(async () => {
    const row = await getDb().query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
      columns: { signaturBild: true },
    });
    return { dataUrl: row?.signaturBild ?? null };
  }),

  signaturSetzen: adminQuery
    .input(
      z.object({
        // PNG/JPG als Data-URL, max. ~1,5 MB base64; null = entfernen
        dataUrl: z
          .string()
          .regex(/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/, "Nur PNG/JPG als Data-URL")
          .max(2_000_000, "Bild zu groß (max. ca. 1,5 MB)")
          .nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const row = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
        columns: { id: true },
      });
      if (!row) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bitte zuerst die Praxisdaten oben speichern.",
        });
      }
      await db
        .update(companySettings)
        .set({ signaturBild: input.dataUrl })
        .where(eq(companySettings.id, 1));
      return { ok: true };
    }),

  // PraxiOS: Einstellungen ändern = Verwaltung (admin/Leitung)
  update: adminQuery.input(settingsInput).mutation(async ({ input }) => {
    const { smtpPasswort, ...rest } = input;
    // SMTP-Passwort wird nur ersetzt, wenn ein neues eingegeben wurde —
    // und ausschließlich verschlüsselt abgelegt (AES-256-GCM, Key = APP_SECRET)
    const werte: Record<string, unknown> = { ...rest };
    if (smtpPasswort) werte.smtpPasswortEnc = verschluesseln(smtpPasswort);
    await getDb()
      .insert(companySettings)
      .values({ id: 1, ...werte } as never)
      .onDuplicateKeyUpdate({ set: werte as never });
    return { ok: true };
  }),

  /** Vorschau der nächsten Patientennummer (zählt nicht hoch). */
  patientenNrVorschau: authedQuery.query(async () => {
    return { vorschau: await patientenNrVorschau() };
  }),

  /** Backup-Erinnerung: Nutzer bestätigt „Backup erledigt" (Banner ruht 14 Tage). */
  backupErledigt: authedQuery.mutation(async () => {
    await getDb()
      .insert(companySettings)
      .values({ id: 1, backupZuletztAm: new Date() } as never)
      .onDuplicateKeyUpdate({ set: { backupZuletztAm: new Date() } as never });
    return { ok: true };
  }),

  icsStatus: authedQuery.query(async () => {
    const db = getDb();
    const row = await db.query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
    });
    if (row?.icsToken) return { token: row.icsToken };
    const token = crypto.randomBytes(24).toString("base64url");
    await db.update(companySettings).set({ icsToken: token }).where(eq(companySettings.id, 1));
    return { token };
  }),

  icsNeu: adminQuery.mutation(async () => {
    const token = crypto.randomBytes(24).toString("base64url");
    await getDb().update(companySettings).set({ icsToken: token }).where(eq(companySettings.id, 1));
    return { token };
  }),

  erinnerungPruefen: authedQuery.mutation(async () => {
    const { erinnerungJetztPruefen } = await import("./terminErinnerung");
    return erinnerungJetztPruefen();
  }),

  sequences: authedQuery.query(async () => {
    return getDb().select().from(numberSequences);
  }),

  /** Startwert des Nummernkreises korrigieren — nur aufwärts erlaubt (GoBD). */
  setSequenceStart: authedQuery
    .input(
      z.object({
        typ: z.enum(["invoice", "credit_note", "delivery_note", "purchase_order", "offer"]),
        jahr: z.number().int(),
        naechsteNummer: z.number().int().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(numberSequences)
        .where(
          and(
            eq(numberSequences.typ, input.typ),
            eq(numberSequences.jahr, input.jahr),
          ),
        );
      const gewuenschterStand = input.naechsteNummer - 1;
      if (row && gewuenschterStand < row.letzteNummer) {
        throw new Error(
          `Nummernkreis kann nicht zurückgesetzt werden (aktueller Stand: ${row.letzteNummer}).`,
        );
      }
      if (row) {
        await db
          .update(numberSequences)
          .set({ letzteNummer: gewuenschterStand })
          .where(eq(numberSequences.id, row.id));
      } else {
        await db
          .insert(numberSequences)
          .values({ typ: input.typ, jahr: input.jahr, letzteNummer: gewuenschterStand });
      }
      return { ok: true };
    }),

  // ── Agent-API (Kimi Claw) ──
  agentStatus: authedQuery.query(async () => {
    const { agentTokens, agentLog } = await import("@db/schema");
    const { desc } = await import("drizzle-orm");
    const db = getDb();
    const [tokens, log, einstellungen] = await Promise.all([
      db.query.agentTokens.findMany({ orderBy: [desc(agentTokens.createdAt)] }),
      db.query.agentLog.findMany({ orderBy: [desc(agentLog.createdAt)], limit: 20 }),
      db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) }),
    ]);
    return {
      autonomie: einstellungen?.agentAutonomie ?? "vorschlag",
      pseudonym: einstellungen?.agentPseudonym ?? true,
      tokens: tokens.map((t) => ({ id: t.id, name: t.name, aktiv: t.aktiv, letzteNutzung: t.letzteNutzung, createdAt: t.createdAt })),
      letzteAktionen: log,
    };
  }),

  agentTokenErstellen: adminQuery
    .input(z.object({ name: z.string().trim().min(2).max(100) }))
    .mutation(async ({ input }) => {
      const { agentTokens } = await import("@db/schema");
      const { erzeugeAgentToken, hashToken } = await import("./agentRouter");
      const klar = erzeugeAgentToken();
      const [{ id }] = await getDb()
        .insert(agentTokens)
        .values({ name: input.name, tokenHash: hashToken(klar) })
        .$returningId();
      return { id, name: input.name, token: klar };
    }),

  agentTokenUmschalten: adminQuery
    .input(z.object({ id: z.number(), aktiv: z.boolean() }))
    .mutation(async ({ input }) => {
      const { agentTokens } = await import("@db/schema");
      const { eq } = await import("drizzle-orm");
      await getDb().update(agentTokens).set({ aktiv: input.aktiv }).where(eq(agentTokens.id, input.id));
      return { ok: true };
    }),

  agentAutonomieSetzen: adminQuery
    .input(z.object({ stufe: z.enum(["vorschlag", "vollautomatik"]) }))
    .mutation(async ({ input }) => {
      await getDb()
        .insert(companySettings)
        .values({ id: 1, agentAutonomie: input.stufe } as never)
        .onDuplicateKeyUpdate({ set: { agentAutonomie: input.stufe } as never });
      return { ok: true };
    }),

  agentPseudonymSetzen: adminQuery
    .input(z.object({ aktiv: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb()
        .insert(companySettings)
        .values({ id: 1, agentPseudonym: input.aktiv } as never)
        .onDuplicateKeyUpdate({ set: { agentPseudonym: input.aktiv } as never });
      return { ok: true };
    }),

  // ── Update-Sektion (Einstellungen → Update) ──
  updateInfo: authedQuery.query(async () => {
    const { APP_VERSION } = await import("./lib/version");
    let neuestesTag: string | null = null;
    try {
      const res = await fetch(
        "https://api.github.com/repos/drawnhunter/PraxiOS---Dr.PaWaWi/tags?per_page=5",
        { signal: AbortSignal.timeout(6000), headers: { Accept: "application/vnd.github+json" } },
      );
      if (res.ok) {
        const tags = (await res.json()) as { name: string }[];
        neuestesTag = tags[0]?.name ?? null;
      }
    } catch { /* offline ok */ }
    return { aktuell: APP_VERSION, neuestesTag };
  }),

  updateAnfordern: adminQuery.mutation(async () => {
    const db = getDb();
    const s = await db.query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
      columns: { supportSchluessel: true },
    });
    if (!s?.supportSchluessel) {
      throw new Error("Kein Support-Schlüssel verbunden — zuerst unter Support verbinden.");
    }
    const url = (process.env.SUPPORT_HUB_URL || "https://support.praxios.dynv6.net").replace(/\/$/, "");
    try {
      const res = await fetch(`${url}/api/hub/update-anfordern`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schluessel: s.supportSchluessel }),
      });
      const text = await res.text();
      let daten: { ok?: boolean; fehler?: string } = {};
      try { daten = JSON.parse(text); } catch { /* HTML-Antwort (Hub-Version zu alt?) */ }
      if (res.status === 404) {
        throw new Error('Der Hub kennt „update-anfordern" noch nicht (Hub-Version aktualisieren — SupportHub-Chat hat den Auftrag).');
      }
      if (!res.ok || daten.ok === false) {
        throw new Error(daten.fehler || `Hub antwortet HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return { ok: true, hinweis: "Update angefordert — der Hub baut und deployt; Status auf der Instanz-Karte im Hub." };
    } catch (e) {
      if (e instanceof Error && e.message.includes("Hub")) throw e;
      throw new Error(`Hub nicht erreichbar: ${e instanceof Error ? e.message : e}`);
    }
  }),

  // ── Patienten-Portal ──
  portalStatus: authedQuery.query(async () => {
    const s = await getDb().query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
      columns: { portalAktiv: true, portalBereiche: true },
    });
    const standard = { termine: true, therapieplan: true, dokumente: true, atteste: true, daten: true, terminanfragen: true, onlineTermine: true };
    let bereiche = standard;
    if (s?.portalBereiche) {
      try {
        bereiche = { ...standard, ...(JSON.parse(s.portalBereiche) as Partial<typeof standard>) };
      } catch { /* Standard */ }
    }
    return { aktiv: s?.portalAktiv ?? true, bereiche };
  }),

  portalSetzen: adminQuery
    .input(
      z.object({
        aktiv: z.boolean().optional(),
        bereiche: z
          .object({
            termine: z.boolean(),
            therapieplan: z.boolean(),
            dokumente: z.boolean(),
            atteste: z.boolean(),
            daten: z.boolean(),
            terminanfragen: z.boolean(),
            onlineTermine: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const setze: Record<string, unknown> = {};
      if (input.aktiv !== undefined) setze.portalAktiv = input.aktiv;
      if (input.bereiche) setze.portalBereiche = JSON.stringify(input.bereiche);
      await getDb()
        .insert(companySettings)
        .values({ id: 1, ...setze } as never)
        .onDuplicateKeyUpdate({ set: setze as never });
      return { ok: true };
    }),

  // ── Modul-Konfiguration ──
  moduleUebersicht: authedQuery.query(async () => {
    const { MODUL_DEFS, ladeModulKonfig } = await import("./lib/module");
    const konfig = await ladeModulKonfig();
    return MODUL_DEFS.map((d) => ({ ...d, aktiv: konfig[d.id] !== false }));
  }),

  modulSetzen: adminQuery
    .input(z.object({ modul: z.string().min(2).max(40), aktiv: z.boolean() }))
    .mutation(async ({ input }) => {
      const { MODUL_DEFS, ladeModulKonfig, modulCacheLeeren } = await import("./lib/module");
      if (!MODUL_DEFS.some((d) => d.id === input.modul)) throw new Error("Unbekanntes Modul.");
      const konfig = await ladeModulKonfig();
      const neu = { ...konfig, [input.modul]: input.aktiv };
      await getDb()
        .insert(companySettings)
        .values({ id: 1, modulKonfig: JSON.stringify(neu) } as never)
        .onDuplicateKeyUpdate({ set: { modulKonfig: JSON.stringify(neu) } as never });
      modulCacheLeeren();
      return { ok: true };
    }),
});
