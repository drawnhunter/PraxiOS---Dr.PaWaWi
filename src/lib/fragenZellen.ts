// Navigation im Zellen-Editor (Ankreuz-Fragen): reine Logik, testbar.
export type PfeilTaste = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Enter";

/** Ziel-Index bei Tastendruck im Raster (spalten = 1|2, anzahl = Zellen gesamt). */
export function naechsterIndex(
  aktuell: number,
  taste: PfeilTaste,
  spalten: 1 | 2,
  anzahl: number,
): number {
  switch (taste) {
    case "ArrowRight":
    case "Enter":
      return Math.min(aktuell + 1, anzahl - 1);
    case "ArrowLeft":
      return Math.max(aktuell - 1, 0);
    case "ArrowDown":
      return Math.min(aktuell + spalten, anzahl - 1);
    case "ArrowUp":
      return Math.max(aktuell - spalten, 0);
  }
}

/** Enter in der letzten Zelle legt eine neue Frage-Zelle an. */
export function istLetzteZelle(aktuell: number, anzahl: number): boolean {
  return aktuell === anzahl - 1;
}
