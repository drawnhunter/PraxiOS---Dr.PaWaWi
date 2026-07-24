import { getDb } from "../api/queries/connection";
import { numberSequences, products } from "./schema";
import { count } from "drizzle-orm";
import { LEISTUNGSKATALOG } from "./leistungskatalog";

/** Nummernkreise anlegen (idempotent). */
export async function seedNummernkreise() {
  const db = getDb();
  const jahr = new Date().getFullYear();
  await db
    .insert(numberSequences)
    .values([
      { typ: "invoice", jahr, letzteNummer: 0 },
      { typ: "credit_note", jahr: 0, letzteNummer: 0 },
      { typ: "offer", jahr, letzteNummer: 0 },
    ])
    .onDuplicateKeyUpdate({ set: { letzteNummer: 0 } });
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

// Direktaufruf: npx tsx db/seed.ts
if (process.argv[1]?.endsWith("seed.ts")) {
  (async () => {
    console.log("Seeding database...");
    await seedNummernkreise();
    const n = await seedLeistungskatalog();
    console.log(`Done. Leistungskatalog: ${n} neue Einträge.`);
    process.exit(0);
  })();
}
