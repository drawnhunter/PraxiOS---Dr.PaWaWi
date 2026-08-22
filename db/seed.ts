import { getDb } from "../api/queries/connection";
import { gruppen, numberSequences, products } from "./schema";
import { count, sql } from "drizzle-orm";
import { LEISTUNGSKATALOG } from "./leistungskatalog";
import { STANDARD_GRUPPEN } from "../contracts/constants";
import { eq } from "drizzle-orm";

/** Nummernkreise anlegen (idempotent). Bestehende Zählerstände bleiben
 *  unangetastet — niemals zurücksetzen (GoBD)! */
export async function seedNummernkreise() {
  const db = getDb();
  const jahr = new Date().getFullYear();
  const kreise = [
    { typ: "invoice", jahr, letzteNummer: 0 },
    { typ: "credit_note", jahr: 0, letzteNummer: 0 },
    { typ: "offer", jahr, letzteNummer: 0 },
    { typ: "patient", jahr: 0, letzteNummer: 0 },
  ];
  for (const k of kreise) {
    await db
      .insert(numberSequences)
      .values(k)
      // No-op bei bestehender Zeile — Zählerstand NIE anfassen (Bug 1.7.1:
      // letzteNummer: 0 hat bei jedem Boot den Kreis zurückgesetzt →
      // ER_DUP_ENTRY bei der nächsten Finalisierung)
      .onDuplicateKeyUpdate({ set: { typ: k.typ } });
  }

  // Selbstheilung: Zähler nie hinter den real vergebenen Nummern zurücklassen
  // (deckt auch Bestände ab, die vom alten Reset-Bug betroffen waren).
  await db.execute(
    sql`UPDATE number_sequences ns
        SET letzte_nummer = GREATEST(
          ns.letzte_nummer,
          COALESCE((
            SELECT MAX(CAST(SUBSTRING(i.nummer, 4, 2) AS UNSIGNED))
            FROM invoices i
            WHERE i.nummer LIKE CONCAT('RK % ', ${jahr})
          ), 0)
        )
        WHERE ns.typ = 'invoice' AND ns.jahr = ${jahr}`,
  );
}

/**
 * Leistungskatalog seeden (79 Einträge, Stand Preisliste EK&VK 2026) —
 * nur wenn der Katalog noch leer ist. Idempotent: läuft bei jedem Start,
 * greift aber nur bei leerer Tabelle.
 */
export async function seedLeistungskatalog(): Promise<number> {
  const db = getDb();
  const [vorhanden] = await db.select({ n: count() }).from(products);
  if (vorhanden.n > 0) return 0;
  await db.insert(products).values(LEISTUNGSKATALOG);
  return LEISTUNGSKATALOG.length;
}

/** Standard-Rechte-Gruppen anlegen (idempotent, fehlen sie). */
export async function seedGruppen(): Promise<number> {
  const db = getDb();
  let neu = 0;
  for (const g of STANDARD_GRUPPEN) {
    const vorhanden = await db.query.gruppen.findFirst({
      where: eq(gruppen.name, g.name),
    });
    if (!vorhanden) {
      await db.insert(gruppen).values({ name: g.name, rechte: JSON.stringify(g.rechte) });
      neu++;
    }
  }
  return neu;
}

// Direktaufruf: npx tsx db/seed.ts
if (process.argv[1]?.endsWith("seed.ts")) {
  (async () => {
    console.log("Seeding database...");
    await seedNummernkreise();
    const n = await seedLeistungskatalog();
    const g = await seedGruppen();
    console.log(`Done. Leistungskatalog: ${n}, Gruppen: ${g}.`);
    process.exit(0);
  })();
}
