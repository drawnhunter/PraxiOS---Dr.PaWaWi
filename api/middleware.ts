import { ErrorMessages, RECHTE, type Recht } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { eq } from "drizzle-orm";
import { gruppen } from "@db/schema";
import { getDb } from "./queries/connection";
import type { TrpcContext } from "./context";

/** Erkennt DB-Treiberfehler (DrizzleQueryError / MySQL ER_*). Nur diese
 *  werden maskiert — fachliche Fehler (throw new Error/TRPCError mit
 *  verständlicher Meldung) gehen unverändert zum Client. */
export function istTreiberFehler(err: unknown): boolean {
  const e = err as { name?: string; sqlMessage?: string; code?: string; cause?: unknown };
  if (!e || typeof e !== "object") return false;
  if (e.name === "DrizzleQueryError") return true;
  if (typeof e.sqlMessage === "string") return true;
  if (typeof e.code === "string" && (e.code.startsWith("ER_") || e.code === "ECONNREFUSED" || e.code === "PROTOCOL_CONNECTION_LOST")) return true;
  if (e.cause) return istTreiberFehler(e.cause);
  return false;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Sicherheit (Handover-Baustelle): NIE Query-Text + Params an den Client —
    // bei DB-Ausfällen landeten sonst Tabellen-/Spaltennamen und Werte (z. B.
    // Benutzernamen) im Browser. Volle Details bleiben im Server-Log.
    if (istTreiberFehler(error.cause ?? error)) {
      console.error("[db-treiberfehler]", error.cause ?? error);
      return {
        ...shape,
        message:
          "Datenbank momentan nicht erreichbar oder Abfrage fehlgeschlagen — bitte erneut versuchen. Details stehen im Server-Log.",
      };
    }
    return shape;
  },
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

function requireRole(role: string) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== role) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const authedQuery = t.procedure.use(requireAuth);
export const adminQuery = authedQuery.use(requireRole("admin"));

// ── PraxiOS: Bereichs-Rechte (Gruppen-System) ───────────────────────────────
// admin (Leitung/Arzt) darf alles; andere brauchen das Recht in ihrer Gruppe.
export function rechtQuery(flag: Recht) {
  return authedQuery.use(async ({ ctx, next }) => {
    if (ctx.user.role === "admin") return next();
    if (!ctx.user.gruppeId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Kein Recht für Bereich „${RECHTE[flag]}“ — bitte einer Gruppe zuweisen (Leitung).`,
      });
    }
    const gruppe = await getDb().query.gruppen.findFirst({
      where: eq(gruppen.id, ctx.user.gruppeId),
    });
    const rechte: string[] = gruppe ? JSON.parse(gruppe.rechte) : [];
    if (!rechte.includes(flag)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Kein Recht für Bereich „${RECHTE[flag]}“ (Gruppe „${gruppe?.name ?? "—"}“).`,
      });
    }
    return next();
  });
}
