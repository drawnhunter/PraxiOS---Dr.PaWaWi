import * as cookie from "cookie";
import { z } from "zod";
import { eq, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { RECHTE, Session, type Recht } from "@contracts/constants";
import { gruppen, users } from "@db/schema";
import { getSessionCookieOptions } from "./lib/cookies";
import {
  adminQuery,
  authedQuery,
  createRouter,
  publicQuery,
} from "./middleware";
import { signSessionToken } from "./kimi/session";
import { hashPassword, verifyPassword } from "./lib/password";
import { getDb } from "./queries/connection";
import type { TrpcContext } from "./context";

const CLIENT_ID = "local";

const benutzernameInput = z
  .string()
  .trim()
  .min(3, "Mindestens 3 Zeichen")
  .max(50)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Nur Buchstaben, Zahlen, Punkt, Bindestrich und Unterstrich",
  );
const passwortInput = z.string().min(8, "Mindestens 8 Zeichen").max(200);

async function setzeSessionCookie(ctx: TrpcContext, unionId: string) {
  const token = await signSessionToken({ unionId, clientId: CLIENT_ID });
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: 60 * 60 * 24 * 365,
    }),
  );
}

async function hatPasswortKonten(): Promise<boolean> {
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(isNotNull(users.passwordHash))
    .limit(1);
  return rows.length > 0;
}

export const authRouter = createRouter({
  // Oeffentlich: Sagt dem Login-Dialog, ob noch die Ersteinrichtung offen ist
  setupStatus: publicQuery.query(async () => ({
    needsSetup: !(await hatPasswortKonten()),
  })),

  // Ersteinrichtung: legt den ersten Admin an (nur moeglich, solange noch
  // kein Konto mit Passwort existiert)
  register: publicQuery
    .input(
      z.object({
        username: benutzernameInput,
        password: passwortInput,
        name: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (await hatPasswortKonten()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Die Ersteinrichtung ist bereits abgeschlossen. Bitte melde dich an.",
        });
      }
      const db = getDb();
      const vorhanden = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);
      if (vorhanden.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Benutzername ist bereits vergeben.",
        });
      }
      await db.insert(users).values({
        unionId: input.username,
        username: input.username,
        passwordHash: hashPassword(input.password),
        name: input.name || input.username,
        role: "admin",
        lastSignInAt: new Date(),
      });
      await setzeSessionCookie(ctx, input.username);
      return { success: true };
    }),

  login: publicQuery
    .input(z.object({ username: z.string().trim(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);
      const user = rows.at(0);
      if (
        !user?.passwordHash ||
        !verifyPassword(input.password, user.passwordHash)
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Benutzername oder Passwort falsch.",
        });
      }
      await db
        .update(users)
        .set({ lastSignInAt: new Date() })
        .where(eq(users.id, user.id));
      await setzeSessionCookie(ctx, user.unionId);
      return { success: true };
    }),

  // PraxiOS: Profil + aufgelöste Rechte (NIEMALS passwordHash ausliefern)
  me: authedQuery.query(async ({ ctx }) => {
    const { passwordHash: _hash, ...u } = ctx.user;
    if (u.role === "admin") {
      return { ...u, rechte: Object.keys(RECHTE) as Recht[], gruppeName: "Leitung/Arzt" };
    }
    if (!u.gruppeId) return { ...u, rechte: [] as Recht[], gruppeName: null };
    const g = await getDb().query.gruppen.findFirst({
      where: eq(gruppen.id, u.gruppeId),
    });
    return {
      ...u,
      rechte: g ? (JSON.parse(g.rechte) as Recht[]) : [],
      gruppeName: g?.name ?? null,
    };
  }),

  // Therapeuten-Auswahl für Kalender/Serien/Pläne — für ALLE eingeloggten
  // Nutzer, aber nur öffentliche Felder (kein Hash, keine E-Mail)
  therapeuten: authedQuery.query(async () => {
    return getDb()
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        kalenderFarbe: users.kalenderFarbe,
      })
      .from(users)
      .where(isNotNull(users.passwordHash));
  }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),

  // ── Benutzerverwaltung (nur Admin) ──────────────────────────────────────
  benutzer: adminQuery.query(async () => {
    const rows = await getDb()
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        kalenderFarbe: users.kalenderFarbe,
        gruppeId: users.gruppeId,
        lastSignInAt: users.lastSignInAt,
        hatPasswort: users.passwordHash,
      })
      .from(users);
    return rows.map((r) => ({ ...r, hatPasswort: !!r.hatPasswort }));
  }),

  benutzerAnlegen: adminQuery
    .input(
      z.object({
        username: benutzernameInput,
        password: passwortInput,
        name: z.string().trim().max(255).optional(),
        role: z.enum(["user", "admin"]).default("user"),
        // Therapeuten-Farbe im Kalender, z. B. "#0F766E"
        kalenderFarbe: z.string().trim().max(20).nullable().optional(),
        // Rechte-Gruppe (Med./Kaufm. Personal o. eigene Gruppe)
        gruppeId: z.number().int().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const vorhanden = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);
      if (vorhanden.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Benutzername ist bereits vergeben.",
        });
      }
      await db.insert(users).values({
        unionId: input.username,
        username: input.username,
        passwordHash: hashPassword(input.password),
        name: input.name || input.username,
        role: input.role,
        kalenderFarbe: input.kalenderFarbe ?? null,
        gruppeId: input.role === "admin" ? null : (input.gruppeId ?? null),
        lastSignInAt: new Date(),
      });
      return { success: true };
    }),

  // Rechte-Gruppe eines Benutzers setzen (Rollen-System)
  benutzerGruppe: adminQuery
    .input(
      z.object({
        userId: z.number().int(),
        gruppeId: z.number().int().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(users)
        .set({ gruppeId: input.gruppeId })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ── Gruppen-Verwaltung (Rollen-System) ────────────────────────────────────
  gruppenListe: authedQuery.query(async () => {
    const rows = await getDb().query.gruppen.findMany({
      with: { mitglieder: { columns: { id: true } } },
    });
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      rechte: JSON.parse(g.rechte) as Recht[],
      mitglieder: g.mitglieder.length,
    }));
  }),

  gruppeAnlegen: adminQuery
    .input(
      z.object({
        name: z.string().trim().min(2).max(100),
        rechte: z
          .array(z.enum(Object.keys(RECHTE) as [Recht, ...Recht[]]))
          .min(1, "Mindestens ein Recht wählen"),
      }),
    )
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb()
        .insert(gruppen)
        .values({ name: input.name, rechte: JSON.stringify(input.rechte) })
        .$returningId();
      return { id };
    }),

  gruppeLoeschen: adminQuery
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const mitglieder = await db.query.users.findMany({
        where: eq(users.gruppeId, input.id),
        columns: { id: true },
      });
      if (mitglieder.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Gruppe wird noch von ${mitglieder.length} Benutzer(n) genutzt — erst zuweisen.`,
        });
      }
      await db.delete(gruppen).where(eq(gruppen.id, input.id));
      return { ok: true };
    }),

  // Therapeuten-Farbe eines Benutzers setzen/ändern (Kalender)
  benutzerFarbe: adminQuery
    .input(
      z.object({
        userId: z.number().int(),
        kalenderFarbe: z.string().trim().max(20).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(users)
        .set({ kalenderFarbe: input.kalenderFarbe })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  benutzerPasswort: adminQuery
    .input(z.object({ id: z.number().int(), password: passwortInput }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(users)
        .set({ passwordHash: hashPassword(input.password) })
        .where(eq(users.id, input.id));
      return { success: true };
    }),

  benutzerLoeschen: adminQuery
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Du kannst dein eigenes Konto nicht löschen.",
        });
      }
      const db = getDb();
      const ziel = await db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);
      const zielUser = ziel.at(0);
      if (!zielUser) return { success: true };
      if (zielUser.role === "admin" && zielUser.passwordHash) {
        // Mindestens ein Admin mit Passwort muss bestehen bleiben
        const alle = await db.select().from(users);
        const passwortAdmins = alle.filter(
          (u) => u.role === "admin" && u.passwordHash,
        ).length;
        if (passwortAdmins <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Der letzte Admin mit Passwort kann nicht gelöscht werden.",
          });
        }
      }
      await db.delete(users).where(eq(users.id, input.id));
      return { success: true };
    }),
});
