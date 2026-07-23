import { getDb } from "./connection";
import { numberSequences } from "@db/schema";
import { eq, and } from "drizzle-orm";

export {
  computeTotals,
  centToDecimal,
  type TotalsInput,
  type Totals,
} from "@contracts/invoicing";

// ── Nummernkreise (GoBD: lückenlos, atomar, nur aufsteigend) ───────────────

/** Vergibt die nächste Nummer atomar. Muss in einer Transaktion laufen. */
export async function nextNumber(
  tx: Pick<Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], "select" | "insert" | "update">,
  typ: string,
  jahr: number,
): Promise<number> {
  // Zeile sicherstellen (Startwert ggf. aus bestehender Sequence)
  await tx
    .insert(numberSequences)
    .values({ typ, jahr, letzteNummer: 0 })
    .onDuplicateKeyUpdate({ set: { typ } });

  const [row] = await tx
    .select()
    .from(numberSequences)
    .where(and(eq(numberSequences.typ, typ), eq(numberSequences.jahr, jahr)))
    .for("update");

  const naechste = row.letzteNummer + 1;
  await tx
    .update(numberSequences)
    .set({ letzteNummer: naechste })
    .where(eq(numberSequences.id, row.id));
  return naechste;
}

// ReWaKi: Dr. Kühnel's Nummernschema, z. B. „RK 06 2026"
export function formatInvoiceNumber(jahr: number, n: number): string {
  return `RK ${String(n).padStart(2, "0")} ${jahr}`;
}

export function formatCreditNoteNumber(n: number): string {
  return `ST/${String(n).padStart(4, "0")}`;
}
