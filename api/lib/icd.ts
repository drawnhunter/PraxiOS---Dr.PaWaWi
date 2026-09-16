// ── PraxiOS: ICD-10-GM 2026 Katalog-Suche (lokal, amtlicher BfArM-Katalog) ──
// Quelle: BfArM ICD-10-GM 2026 (kostenfreier Download, Nutzungsvertrag BfArM).
// Enthalten sind nur kodierbare Endpunkte (abrechenbare Diagnosen).
import * as fs from "fs";
import * as path from "path";

export interface IcdEintrag {
  code: string;
  text: string;
}

let katalog: [string, string][] | null = null;
let norm: string[] | null = null;

function ladeKatalog(): [string, string][] {
  if (katalog) return katalog;
  const pfad = path.join(process.cwd(), "api", "assets", "icd10gm2026.json");
  const geladen = JSON.parse(fs.readFileSync(pfad, "utf8")) as [string, string][];
  katalog = geladen;
  norm = geladen.map(([, t]) => normalisieren(t));
  return geladen;
}

// Umgangssprachliche Begriffe → Katalog-Bezeichnung(en) — damit die Praxis
// mit Alltagsworten sucht, die ICD-10-GM anders nennt (deutsch).
const SYNONYME: Record<string, string[]> = {
  durchfall: ["diarrhoe", "gastroenteritis"],
  borreliose: ["lyme"],
  hexenschuss: ["lumbago", "kreuzschmerz"],
  grippalerInfekt: ["akute infektion der oberen atemwege"],
  erkaeltung: ["akute infektion der oberen atemwege", "nasenkatarrh"],
  bluthochdruck: ["hypertonie"],
  magenkatarrh: ["gastritis"],
  windpocken: ["varizellen"],
  guertelrose: ["zoster"],
  schnupfen: ["nasenkatarrh", "rhinitis"],
  ohrenschmerzen: ["otalgie"],
  rueckenschmerzen: ["kreuzschmerz", "lumbago"],
  kopfschmerzen: ["kopfschmerz"],
  fieberblasen: ["herpes labialis"],
  munddrossel: ["soor"],
  magendarm: ["gastroenteritis"],
  bauchschmerzen: ["abdominelle schmerzen", "abdomen"],
  halsschmerzen: ["pharyngitis", "tonsillitis"],
  husten: ["husten"],
  bronchitis: ["bronchitis"],
  nasennebenhoehlen: ["sinusitis"],
  mittelohr: ["otitis media"],
  harnwegsinfekt: ["harnwegsinfektion", "zystitis"],
  blasenentzuendung: ["zystitis"],
  nierensteine: ["nephrolithiasis"],
  kopfweh: ["kopfschmerz"],
  schwindel: ["schwindel", "vertigo"],
  blutarmut: ["anaemie"],
  zuckerkrankheit: ["diabetes mellitus"],
  schilddruese: ["schilddruese", "struma", "thyreoiditis"],
  depression: ["depressiv"],
  burnout: ["zustaende der erschoepfung", "erschöpfung"],
  angst: ["angststoerung", "phobisch"],
  schlafstoerung: ["insomnie", "schlaf"],
  allergie: ["allergisch", "allergie"],
  heuschnupfen: ["pollinose", "allergische rhinitis"],
  asthma: ["asthma bronchiale"],
  neurodermitis: ["atopische dermatitis", "endogenes ekzem"],
  schuppenflechte: ["psoriasis"],
  arthritis: ["arthritis"],
  rheumatismus: ["rheumatismus"],
  osteoporose: ["osteoporose"],
  bandscheibe: ["bandscheiben"],
  tennisarm: ["epikondylitis"],
  karpaltunnel: ["karpaltunnelsyndrom"],
  migraine: ["migraene"],
  tinnitus: ["tinnitus"],
  grauerStar: ["katarakt"],
  gruenerStar: ["glaukom"],
};

/** Umlaut-robust: ä→ae etc., damit „Durchfall" und „diarrhö" beides findet. */
function normalisieren(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Sucht im Katalog: Code-Präfix zuerst, dann Text-Treffer (alle Wörter müssen
 * vorkommen). Max. `limit` Treffer.
 */
export function icdSuche(suche: string, limit = 25): IcdEintrag[] {
  const katalog_ = ladeKatalog();
  const q = suche.trim();
  if (q.length < 2) return [];

  const qCode = q.toUpperCase().replace(/[^A-Z0-9.]/g, "");
  const woerter = normalisieren(q).split(/\s+/).filter(Boolean);
  // Pro Suchwort eine Liste zulässiger Varianten (Original + Synonyme)
  const varianten = woerter.map((w) => {
    const key = Object.keys(SYNONYME).find((k) => normalisieren(k) === w.replace(/[^a-z]/g, ""));
    const syn = key ? SYNONYME[key].map(normalisieren) : [];
    return [w, ...syn];
  });

  const codeTreffer: IcdEintrag[] = [];
  const exakt: IcdEintrag[] = []; // alle Wörter (oder Synonyme) treffen
  const teil: { e: IcdEintrag; score: number }[] = []; // nur ein Teil trifft
  for (let i = 0; i < katalog_.length; i++) {
    const [code, text] = katalog_[i];
    if (qCode.length >= 2 && code.startsWith(qCode)) {
      codeTreffer.push({ code, text });
      continue;
    }
    if (varianten.length === 0) continue;
    const trefferWorte = varianten.filter((gruppe) =>
      gruppe.some((v) => norm![i].includes(v)),
    ).length;
    if (trefferWorte === varianten.length) {
      exakt.push({ code, text });
    } else if (trefferWorte > 0 && varianten.length > 1) {
      // Toleranz-Fallback: einzelne Wörter reichen, je mehr desto weiter oben
      teil.push({ e: { code, text }, score: trefferWorte });
    }
    if (codeTreffer.length + exakt.length >= limit * 3) break;
  }
  // Toleranz-Fallback nur, wenn es KEINE exakten Treffer gibt — sonst bleibt
  // die Trefferliste streng (alle Suchwörter müssen vorkommen).
  if (codeTreffer.length === 0 && exakt.length === 0 && teil.length > 0) {
    teil.sort((a, b) => b.score - a.score);
    return teil.map((t) => t.e).slice(0, limit);
  }
  return [...codeTreffer, ...exakt].slice(0, limit);
}
