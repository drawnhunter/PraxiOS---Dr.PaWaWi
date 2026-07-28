// ── PraxiOS: Kuratierte GOÄ-Basisbibliothek (Praxis-Mapping) ───────────────
// EIGENES Praxiswissen: Ziffern-Referenzen (Fakten, aus der Rechtsverordnung,
// gemeinfrei) + praxiserprobte Analog-Entscheidungen und Anwendungshinweise.
// KEIN amtlicher Katalogtext, keine BÄK-Redaktionsinhalte.
// Quelle: Abrechnungspraxis (integrative Medizin / IMTZ, RK-Belege).

export interface GoaeEintrag {
  ziffer: string;
  kurztext: string; // eigene Kurzbeschreibung
  hinweis: string; // praktischer Hinweis (Analog, Abgrenzung, Bündel)
}

export const GOAE_BIBLIOTHEK: GoaeEintrag[] = [
  // ── Beratung / Untersuchung ──
  { ziffer: "1", kurztext: "Beratung — eingehend, Problembezogen", hinweis: "Basis-Beratung; gegenüber 3/5 abgrenzen (Zeit/Schwierigkeit)" },
  { ziffer: "3", kurztext: "Beratung — ausführlich, schwierig", hinweis: "Bei komplexen Verläufen, mehreren Erkrankungen, erschwerter Anamnese" },
  { ziffer: "5", kurztext: "Beratung — sehr schwierig, zeitaufwändig", hinweis: "Höchststufe Beratung; Begründung im Belegtext dokumentieren" },
  { ziffer: "34", kurztext: "Auswertung von Befunden, Therapieplanung", hinweis: "Unsere Standard-Ziffer für Vorbefund-Auswertung + Plan (vgl. RK-Beleg: 220 €)" },
  { ziffer: "75", kurztext: "Untersuchung — einfach", hinweis: "Orientierende Untersuchung, unkompliziert" },
  { ziffer: "85", kurztext: "Untersuchung — ausführlich", hinweis: "Mit eingehender Dokumentation/Brief (Abschlussuntersuchung kombiniert mit 75)" },
  // ── Behandlungen aus der Praxis ──
  { ziffer: "272", kurztext: "Tägliche Infusionstherapie, je Tag", hinweis: "Standard je Behandlungstag (RK: 250 €); nicht für reine Infusion ohne ärztl. Behandlung" },
  { ziffer: "285", kurztext: "Eigenbluttherapie (Behandlung)", hinweis: "Ozon-Eigenblut groß/klein; zusammen mit 286A (Aderlass) abrechenbar" },
  { ziffer: "286A", kurztext: "Aderlass / Blutentnahme", hinweis: "Erginzungsziffer zu 285; allein für venöse Blutentnahme" },
  { ziffer: "532", kurztext: "Wärmebehandlung, Ganzkörper", hinweis: "mGKHT (moderate Ganzkörperhyperthermie) rechnen wir analog (entspr.) ab" },
  { ziffer: "285/286A", kurztext: "Ozon-Eigenblut groß (Aderlass + Reinfusion)", hinweis: "Kombinationsangabe im Beleg: entspr. 285/286A (RK: 350 €)" },
  // ── Weitere relevante Allgemeinmedizin-Ziffern ──
  { ziffer: "6", kurztext: "Vorsorge/Screening (Erweiterung)", hinweis: "Bei strukturierter Vorsorge-Untersuchung" },
  { ziffer: "7", kurztext: "Beratung — auch per Videosprechstunde", hinweis: "Videosprechstunde als Beratung abrechenbar (ggf. § 2 beachten)" },
  { ziffer: "8", kurztext: "Einfache körperliche Untersuchung", hinweis: "Routine, apparativ unaufwändig" },
  { ziffer: "15", kurztext: "Technische Grundausstattung (Zuschlag)", hinweis: "Material-/Gerätegrundkosten bei bestimmten Leistungen — nur wenn zulässig" },
  { ziffer: "20", kurztext: "Erweiterte körperliche Untersuchung", hinweis: "Mehr Aufwand als 8, noch keine 75" },
  { ziffer: "23", kurztext: "Zuschlag ärztlicher Notdienst", hinweis: "Bei Behandlung außerhalb der üblichen Sprechzeiten" },
  { ziffer: "25", kurztext: "Notfall-/Schmerzzuschlag", hinweis: "Unangekündigter dringender Fall" },
  { ziffer: "60", kurztext: "EKG, Standard", hinweis: "Ruhe-EKG; mit 61 (Belastung) nicht doppelt" },
  { ziffer: "61", kurztext: "EKG unter Belastung", hinweis: "Belastungs-EKG statt 60" },
  { ziffer: "70", kurztext: "Kleine chirurgische Maßnahme", hinweis: "Ambulante kleine Eingriffe, Wundversorgung" },
  { ziffer: "80", kurztext: "Stationäre Aufnahme/Gespräch (Vorbereitung)", hinweis: "Bei stationärem Setting (falls zutreffend)" },
  { ziffer: "87", kurztext: "Arztbrief (Erstellung)", hinweis: "Bei gesondertem Brief mit Befund/Therapieempfehlung (oft mit 75/85 kombiniert)" },
  { ziffer: "88", kurztext: "Bewertung/Gutachten", hinweis: "Formelle Begutachtung mit Dokumentation" },
  { ziffer: "90", kurztext: "Testung/Untersuchungsserie (Verlauf)", hinweis: "Kontrollierte Verlaufsuntersuchung über Zeitraum" },
  { ziffer: "345", kurztext: "Ultraschall, einzelne Region", hinweis: "Bei sonografischer Kontrolle; pro Region, nicht pro Sitzung pauschal" },
  // ── § 2 GOÄ (freie Vereinbarung) ──
  { ziffer: "§ 2", kurztext: "Honorarvereinbarung (Heil- und Kostenplan)", hinweis: "Für HHH, Apherese, Protokolle ohne direkte Ziffer — immer mit schriftlicher Vereinbarung § 2 Abs. 1+2; Beleg-Fußnote nicht vergessen" },
];

/** Vorschläge für das Produktformular: passt ein Produktname zu einer Ziffer? */
export function goaeVorschlaege(suche: string): GoaeEintrag[] {
  const q = suche.toLowerCase().trim();
  if (!q) return GOAE_BIBLIOTHEK;
  return GOAE_BIBLIOTHEK.filter(
    (e) =>
      e.kurztext.toLowerCase().includes(q) ||
      e.hinweis.toLowerCase().includes(q) ||
      e.ziffer.includes(q),
  );
}
