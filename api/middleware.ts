import { ErrorMessages, RECHTE, type Recht } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { eq } from "drizzle-orm";
import { gruppen } from "@db/schema";
import { getDb } from "./queries/connection";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
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
