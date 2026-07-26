import { getDb } from "../queries/connection";
import { timelineEvents } from "@db/schema";
import { heuteIso } from "./kalender";

// Zentrale Hilfsfunktion fuer Timeline-Eintraege (Chronik eines Patienten).
export async function schreibeTimeline(e: {
  patientId: number;
  typ: "plan" | "termin" | "dokument" | "notiz" | "status";
  titel: string;
  beschreibung?: string | null;
  datum?: string; // JJJJ-MM-TT, Standard: heute
  createdBy?: number | null;
}): Promise<void> {
  await getDb()
    .insert(timelineEvents)
    .values({
      patientId: e.patientId,
      typ: e.typ,
      titel: e.titel,
      beschreibung: e.beschreibung ?? null,
      datum: e.datum ?? heuteIso(),
      createdBy: e.createdBy ?? null,
    });
}
