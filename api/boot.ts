import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { mkdirSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { authenticateRequest } from "./kimi/auth";
import { getDb } from "./queries/connection";
import { companySettings, customers, documents, therapyPlans } from "@db/schema";
import { eq } from "drizzle-orm";
import { schreibeTimeline } from "./lib/timeline";

const app = new Hono<{ Bindings: HttpBindings }>();

// Upload-Verzeichnis sicher anlegen
mkdirSync(env.uploadDir, { recursive: true });

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// ── Dokument-Upload/-Download (Dateien; Metadaten via tRPC „dokumente") ────
const ERLAUBTE_DATEITYPEN: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
};

app.post("/api/dokumente", async (c) => {
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Nicht angemeldet." }, 401);
  }

  const form = await c.req.parseBody();
  const datei = form["datei"];
  if (!(datei instanceof File)) {
    return c.json({ error: "Feld „datei“ fehlt." }, 400);
  }
  const patientId = Number(form["patientId"]);
  if (!Number.isInteger(patientId) || patientId <= 0) {
    return c.json({ error: "Ungültige patientId." }, 400);
  }
  const kategorie = String(form["kategorie"] ?? "sonstiges");
  if (
    !["befund", "arztbrief", "rezept", "einverstaendnis", "sonstiges"].includes(kategorie)
  ) {
    return c.json({ error: "Ungültige Kategorie." }, 400);
  }
  const planIdRaw = form["planId"];
  const planId =
    planIdRaw !== undefined && planIdRaw !== "" && planIdRaw !== null
      ? Number(planIdRaw)
      : null;
  if (planId !== null && (!Number.isInteger(planId) || planId <= 0)) {
    return c.json({ error: "Ungültige planId." }, 400);
  }
  const notiz = form["notiz"] ? String(form["notiz"]).slice(0, 500) : null;

  const db = getDb();
  const patient = await db.query.customers.findFirst({
    where: eq(customers.id, patientId),
    columns: { id: true },
  });
  if (!patient) {
    return c.json({ error: "Patient nicht gefunden." }, 404);
  }
  if (planId !== null) {
    const plan = await db.query.therapyPlans.findFirst({
      where: eq(therapyPlans.id, planId),
      columns: { id: true, patientId: true },
    });
    if (!plan || plan.patientId !== patientId) {
      return c.json({ error: "Therapieplan gehört nicht zu diesem Patienten." }, 400);
    }
  }

  const originalName = datei.name || "datei";
  const ext = (originalName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ERLAUBTE_DATEITYPEN[ext]) {
    return c.json(
      { error: "Dateityp nicht erlaubt (nur PDF und Bilder)." },
      400,
    );
  }

  const dateinameIntern = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const relativerPfad = `${patientId}/${dateinameIntern}`;
  mkdirSync(path.join(env.uploadDir, String(patientId)), { recursive: true });
  await writeFile(
    path.join(env.uploadDir, relativerPfad),
    Buffer.from(await datei.arrayBuffer()),
  );

  const [{ id }] = await db
    .insert(documents)
    .values({
      patientId,
      planId,
      kategorie: kategorie as
        | "befund"
        | "arztbrief"
        | "rezept"
        | "einverstaendnis"
        | "sonstiges",
      dateiname: originalName.slice(0, 255),
      dateipfad: relativerPfad,
      mimeType: datei.type || ERLAUBTE_DATEITYPEN[ext],
      groesse: datei.size,
      notiz,
      uploadedBy: user.id,
    })
    .$returningId();

  await schreibeTimeline({
    patientId,
    typ: "dokument",
    titel: `Dokument hochgeladen: ${originalName}`,
    createdBy: user.id,
  });

  const doc = await db.query.documents.findFirst({ where: eq(documents.id, id) });
  return c.json(doc, 201);
});

app.get("/api/dokumente/:id/datei", async (c) => {
  try {
    await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Nicht angemeldet." }, 401);
  }
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: "Ungültige ID." }, 400);
  }
  const doc = await getDb().query.documents.findFirst({ where: eq(documents.id, id) });
  if (!doc) {
    return c.json({ error: "Dokument nicht gefunden." }, 404);
  }
  let daten: Buffer;
  try {
    daten = await readFile(path.join(env.uploadDir, doc.dateipfad));
  } catch {
    return c.json({ error: "Datei fehlt auf dem Server." }, 404);
  }
  return new Response(new Uint8Array(daten), {
    headers: {
      "Content-Type": doc.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.dateiname)}`,
      "Content-Length": String(daten.length),
      "X-Content-Type-Options": "nosniff",
    },
  });
});

// ── Zahlungsziele-ICS (Token-Auth) ─────────────────────────────────────────
app.get("/ics/zahlungsziele.ics", async (c) => {
  const token = c.req.query("token") ?? "";
  const db = getDb();
  const einst = await db.query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
  });
  if (!einst?.icsToken || einst.icsToken !== token) return c.text("Ungültiges Token.", 403);
  const { baueZahlungszieleIcs } = await import("./lib/ics");
  const ics = await baueZahlungszieleIcs();
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache" },
  });
});

// ── ICS-Kalender-Feed (Token-Auth, kein Login — für Google/Outlook-Abo) ────
// Agent-API (Kimi Claw): REST mit Bearer-Token, unabhängig von der Session
try {
  const { default: agentRouter } = await import("./agentRouter");
  app.route("/api/agent", agentRouter);
  console.log("[agent] API unter /api/agent aktiv (Bearer-Token in Einstellungen)");
} catch (e) {
  console.error("[agent] Router-Mount fehlgeschlagen:", e);
}

app.get("/api/ics/:token.ics", async (c) => {
  const token = c.req.param("token");
  const db = getDb();
  const s = await db.query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
  });
  if (!s?.kalenderToken || token !== s.kalenderToken) {
    return c.json({ error: "Ungültig." }, 401);
  }
  const heute = new Date();
  const von = new Date(heute);
  von.setDate(von.getDate() - 14);
  const bis = new Date(heute);
  bis.setDate(bis.getDate() + 84);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const { planEntries, therapyPlans, customers, users } = await import("@db/schema");
  const { and, asc, gte, lte, eq: eq2 } = await import("drizzle-orm");
  const rows = await db
    .select({
      entry: planEntries,
      planTitel: therapyPlans.titel,
      patientName: customers.name,
      therapeutName: users.name,
    })
    .from(planEntries)
    .innerJoin(therapyPlans, eq2(planEntries.planId, therapyPlans.id))
    .innerJoin(customers, eq2(therapyPlans.patientId, customers.id))
    .leftJoin(users, eq2(planEntries.therapeutId, users.id))
    .where(and(gte(planEntries.datum, fmt(von)), lte(planEntries.datum, fmt(bis))))
    .orderBy(asc(planEntries.datum));

  const { baueIcs } = await import("./lib/ics");
  const ics = baueIcs(
    rows.map((r) => ({
      id: r.entry.id,
      datum: r.entry.datum,
      zeitVon: r.entry.zeitVon,
      zeitBis: r.entry.zeitBis,
      patientName: r.patientName,
      leistungText: r.entry.leistungText,
      therapeutName: r.therapeutName,
      raum: r.entry.raum,
      bemerkung: r.entry.bemerkung,
      status: r.entry.status,
      planTitel: r.planTitel,
    })),
    s.name,
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
});

// Modul-Gate: deaktivierte Module antworten mit 403 (vor dem tRPC-Handler)
app.use("/api/trpc/*", async (c, next) => {
  const { modulFuerRouter, modulAktiv } = await import("./lib/module");
  const pfad = c.req.path.replace(/^\/api\/trpc\//, "").split("?")[0];
  // Batching: Pfade sind kommagetrennt (zeit.a,zeit.b)
  const routerNamen = [...new Set(pfad.split(",").map((x) => x.split(".")[0]))];
  for (const name of routerNamen) {
    const def = modulFuerRouter(name);
    if (def && !(await modulAktiv(def.id))) {
      return c.json(
        [{ error: { message: `Modul „${def.titel}" ist deaktiviert (Einstellungen → Module).`, code: -32403, data: { code: "FORBIDDEN", httpStatus: 403 } } }],
        403,
      );
    }
  }
  return next();
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  // Fehlende DB-Spalten aus aelteren Versionen automatisch nachziehen
  try {
    const { migriereFehlendeSpalten } = await import("./migrate");
    await migriereFehlendeSpalten();
    const { seedNummernkreise, seedLeistungskatalog, seedGruppen } = await import("../db/seed");
    await seedNummernkreise();
    const n = await seedLeistungskatalog();
    if (n > 0) console.log(`[seed] Leistungskatalog: ${n} Einträge`);
    const g = await seedGruppen();
    if (g > 0) console.log(`[seed] Gruppen: ${g} Standard-Gruppen`);
    const { seedKontierung } = await import("./kontierungRouter");
    await seedKontierung();

    // Terminerinnerungen (E-Mail, alle 30 min)
    const { starteErinnerungsScheduler } = await import("./terminErinnerung");
    starteErinnerungsScheduler();

    // SupportHub-Client (Pull-Modell, Auftrag Bus #18): Heartbeat + Befehle —
    // nur aktiv, wenn ein Support-Schlüssel verbunden ist (prüft er selbst)
    try {
      const { starteHubClient } = await import("./lib/hubClient");
      starteHubClient();
    } catch (e) {
      console.error("[hub] Client-Start fehlgeschlagen:", e);
    }
    try {
      const { starteImapDienst } = await import("./imapDienst");
      starteImapDienst();
    } catch (e) {
      console.error("[imap] Dienst-Start fehlgeschlagen:", e);
    }
  } catch (e) {
    console.error("[migrate/seed] fehlgeschlagen:", e);
  }

  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    // Produkt-Stempel ins Boot-Log (1.20.1): Hub/Logs erkennen die Reihe sofort
    import("./lib/version").then((v) => {
      console.log(`[stempel] ${v.APP_HERSTELLER} ${v.APP_PRODUKT_NAME} · produkt=${v.APP_PRODUKT} · v${v.APP_VERSION}`);
    }).catch(() => undefined);
    console.log(`Server running on http://localhost:${port}/`);
  });
}
