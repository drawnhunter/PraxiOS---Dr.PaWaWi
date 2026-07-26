import { getDb } from "../api/queries/connection";
import { gruppen, numberSequences, products } from "./schema";
import { count } from "drizzle-orm";
import { LEISTUNGSKATALOG } from "./leistungskatalog";
import { STANDARD_GRUPPEN } from "../contracts/constants";
import { eq } from "drizzle-orm";

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
