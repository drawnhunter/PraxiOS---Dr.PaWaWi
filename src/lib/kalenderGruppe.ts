// Gruppierung der Kalender-Tageseinträge nach Patient (reine Logik, testbar).
import type { KalenderEintrag } from "@/pages/Kalender";

export interface PatientGruppe {
  patientId: number;
  patientName: string;
  eintraege: KalenderEintrag[];
  /** „HH:MM–HH:MM“ (früheste/letzte Zeit) oder null, wenn keine Zeiten gepflegt */
  zeitspanne: string | null;
}

export function gruppiereNachPatient(eintraege: KalenderEintrag[]): PatientGruppe[] {
  const map = new Map<number, PatientGruppe>();
  for (const e of eintraege) {
    if (!map.has(e.patientId)) {
      map.set(e.patientId, {
        patientId: e.patientId,
        patientName: e.patientName,
        eintraege: [],
        zeitspanne: null,
      });
    }
    map.get(e.patientId)!.eintraege.push(e);
  }
  for (const g of map.values()) {
    const von = g.eintraege.map((e) => e.entry.zeitVon).filter((z): z is string => !!z).sort()[0];
    const bis = g.eintraege.map((e) => e.entry.zeitBis).filter((z): z is string => !!z).sort();
    const bisLetzte = bis[bis.length - 1];
    g.zeitspanne = von && bisLetzte ? `${von}–${bisLetzte}` : (von ?? null);
  }
  return [...map.values()];
}
