import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { gruppiereNachPatient } from "@/lib/kalenderGruppe";
import { ENTRY_STATUS, type EntryStatus } from "@contracts/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarSync, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCopy } from "lucide-react";

// ── ISO-8601-Kalenderwochen-Hilfsfunktionen ─────────────────────────────────
// Montag-basiert, reine String-/UTC-Rechnung (keine Zeitzonen-Falle).
// Spiegelbild der Backend-Logik in api/lib/kalender.ts — bewusst lokal
// dupliziert, damit das Frontend ohne Server-Import auskommt.

/** Liefert das Datum („JJJJ-MM-TT“) eines Wochentags in einer ISO-KW. wochentag: 1 = Mo … 7 = So. */
export function kwZuDatum(jahr: number, kw: number, wochentag: number): string {
  // 4. Januar liegt immer in KW 1 (ISO-8601)
  const vierterJanuar = new Date(Date.UTC(jahr, 0, 4));
  const tagDerWoche = vierterJanuar.getUTCDay() === 0 ? 7 : vierterJanuar.getUTCDay();
  const montagKw1 = new Date(vierterJanuar);
  montagKw1.setUTCDate(vierterJanuar.getUTCDate() - (tagDerWoche - 1));
  const ziel = new Date(montagKw1);
  ziel.setUTCDate(montagKw1.getUTCDate() + (kw - 1) * 7 + (wochentag - 1));
  return ziel.toISOString().slice(0, 10);
}

/** ISO-Kalenderwoche + zugehöriges Jahr eines Datums („JJJJ-MM-TT“). */
export function datumZuKw(datumIso: string): { jahr: number; kw: number } {
  const d = new Date(datumIso + "T00:00:00Z");
  const tag = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Auf Donnerstag der Woche verschieben — dessen Jahr ist das KW-Jahr
  d.setUTCDate(d.getUTCDate() + (4 - tag));
  const jahr = d.getUTCFullYear();
  const jahresanfang = new Date(Date.UTC(jahr, 0, 1));
  const kw = Math.ceil(((d.getTime() - jahresanfang.getTime()) / 86400000 + 1) / 7);
  return { jahr, kw };
}

/** Heutiges Datum als „JJJJ-MM-TT“ (lokale Zeit). */
export function heuteIso(): string {
  const jetzt = new Date();
  const j = jetzt.getFullYear();
  const m = String(jetzt.getMonth() + 1).padStart(2, "0");
  const t = String(jetzt.getDate()).padStart(2, "0");
  return `${j}-${m}-${t}`;
}

/** n Tage zu einem ISO-Datum addieren (negativ = abziehen). */
export function tageAddieren(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Typen aus dem Router ────────────────────────────────────────────────────
type RouterOutputs = inferRouterOutputs<AppRouter>;
export type KalenderEintrag =
  RouterOutputs["kalender"]["woche"]["tage"][number]["eintraege"][number];

const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr"];

export function uhrzeitBereich(e: { zeitVon: string | null; zeitBis: string | null }): string {
  if (e.zeitVon && e.zeitBis) return `${e.zeitVon}–${e.zeitBis}`;
  return e.zeitVon ?? e.zeitBis ?? "";
}

/** Karten-Stil je Eintragsstatus (stattgefunden dezent, abgesagt orange, ausgefallen rot). */
export function statusKartenKlasse(status: EntryStatus): string {
  switch (status) {
    case "stattgefunden":
      return "opacity-70";
    case "abgesagt":
      return "border-amber-300 bg-amber-50";
    case "ausgefallen":
      return "border-red-300 bg-red-50";
    default:
      return "";
  }
}

export function statusTextKlasse(status: EntryStatus): string {
  switch (status) {
    case "abgesagt":
      return "line-through decoration-amber-600";
    case "ausgefallen":
      return "line-through decoration-red-600";
    default:
      return "";
  }
}

/** Einzelne Termin-Karte (wird auch im Dashboard wiederverwendet). */
export function TerminKarte({
  eintrag,
  onClick,
}: {
  eintrag: KalenderEintrag;
  onClick?: () => void;
}) {
  const e = eintrag.entry;
  const farbe = eintrag.therapeutFarbe ?? "#a3a3a3";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md border border-neutral-200 border-l-4 bg-white p-2 text-left text-xs shadow-sm transition-colors hover:bg-neutral-50",
        statusKartenKlasse(e.status),
      )}
      style={{ borderLeftColor: farbe }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium tabular-nums text-neutral-700">
          {uhrzeitBereich(e) || "–"}
        </span>
        {e.status === "stattgefunden" && (
          <Check className="h-3.5 w-3.5 text-primary" aria-label="Stattgefunden" />
        )}
        {(e.status === "abgesagt" || e.status === "ausgefallen") && (
          <span
            className={cn(
              "text-[10px] font-medium",
              e.status === "abgesagt" ? "text-amber-700" : "text-red-700",
            )}
          >
            {ENTRY_STATUS[e.status]}
          </span>
        )}
      </div>
      <div className={cn("mt-0.5 font-medium text-neutral-900", statusTextKlasse(e.status))}>
        <Link
          to={`/patienten/${eintrag.patientId}`}
          className="hover:underline"
          onClick={(ev) => ev.stopPropagation()}
        >
          {eintrag.patientName}
        </Link>
      </div>
      <div className={cn("text-neutral-600", statusTextKlasse(e.status))}>
        {e.leistungText ?? "–"}
        {e.menge && Number(e.menge) !== 1 ? ` × ${String(e.menge).replace(".", ",")}` : ""}
      </div>
      <div className="mt-0.5 text-neutral-400">
        {[eintrag.therapeutName, e.raum].filter(Boolean).join(" · ") || " "}
      </div>
    </button>
  );
}

export default function Kalender() {
  const heute = heuteIso();
  const startKw = datumZuKw(heute);
  const [jahr, setJahr] = useState(startKw.jahr);
  const [kw, setKw] = useState(startKw.kw);

  const [ausgewaehlt, setAusgewaehlt] = useState<KalenderEintrag | null>(null);
  const [status, setStatus] = useState<EntryStatus>("geplant");
  const [bemerkung, setBemerkung] = useState("");
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(new Set());
  const [aboOffen, setAboOffen] = useState(false);
  const [aboUrl, setAboUrl] = useState("");
  const [aboKopiert, setAboKopiert] = useState(false);
  const toggleAufklappen = (key: string) =>
    setAufgeklappt((alt) => {
      const neu = new Set(alt);
      if (neu.has(key)) neu.delete(key);
      else neu.add(key);
      return neu;
    });

  const utils = trpc.useUtils();
  const woche = trpc.kalender.woche.useQuery({ jahr, kw });
  // Therapeuten-Liste (für alle eingeloggten Nutzer, ohne sensible Felder)
  const benutzer = trpc.auth.therapeuten.useQuery();

  const aktualisieren = trpc.plaene.updateEntry.useMutation({
    onSuccess: () => {
      utils.kalender.woche.invalidate();
      setAusgewaehlt(null);
    },
  });

  const montag = kwZuDatum(jahr, kw, 1);
  const freitag = kwZuDatum(jahr, kw, 5);

  const wocheWechseln = (richtung: number) => {
    const ziel = datumZuKw(tageAddieren(montag, richtung * 7));
    setJahr(ziel.jahr);
    setKw(ziel.kw);
  };

  const oeffneEintrag = (eintrag: KalenderEintrag) => {
    setAusgewaehlt(eintrag);
    setStatus(eintrag.entry.status);
    setBemerkung(eintrag.entry.bemerkung ?? "");
  };

  const legende = (benutzer.data ?? []).filter((b) => b.kalenderFarbe);

  return (
    <div>
      {/* ── Kopf mit KW-Navigation ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Kalender</h1>
          <Button variant="outline" size="sm" onClick={() => setAboOffen(true)}>
            <CalendarSync className="mr-1.5 h-4 w-4" /> Abonnieren
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => wocheWechseln(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setJahr(startKw.jahr);
              setKw(startKw.kw);
            }}
          >
            Heute
          </Button>
          <Button variant="outline" size="sm" onClick={() => wocheWechseln(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium text-neutral-700">
            KW {kw} · {datum(montag).slice(0, 6)}–{datum(freitag)}
          </span>
        </div>
      </div>

      {/* ── Wochenraster Mo–Fr ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {(woche.data?.tage ?? []).map((tag, i) => {
          const istHeute = tag.datum === heute;
          const sortiert = [...tag.eintraege].sort((a, b) =>
            (a.entry.zeitVon ?? "99:99").localeCompare(b.entry.zeitVon ?? "99:99"),
          );
          return (
            <div
              key={tag.datum}
              className={cn(
                "rounded-lg border bg-white",
                istHeute ? "border-primary" : "border-neutral-200",
              )}
            >
              <div
                className={cn(
                  "rounded-t-lg border-b px-3 py-2 text-sm",
                  istHeute
                    ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                    : "border-neutral-200 bg-neutral-50 font-medium text-neutral-700",
                )}
              >
                {WOCHENTAGE_KURZ[i]}{" "}
                <span className="tabular-nums">{datum(tag.datum)}</span>
              </div>
              <div className="space-y-1.5 p-2">
                {sortiert.length === 0 && (
                  <p className="px-1 py-2 text-xs text-neutral-300">Keine Termine</p>
                )}
                {gruppiereNachPatient(sortiert).map((gruppe) => {
                  const key = `${tag.datum}|${gruppe.patientId}`;
                  const offen = aufgeklappt.has(key);
                  return (
                    <div key={key} className="rounded-md border border-neutral-200 bg-white">
                      <button
                        type="button"
                        onClick={() => toggleAufklappen(key)}
                        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs hover:bg-neutral-50"
                      >
                        <span className="flex items-center gap-1.5 font-medium text-neutral-900">
                          {offen ? (
                            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                          )}
                          <Link
                            to={`/patienten/${gruppe.patientId}`}
                            className="hover:underline"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            {gruppe.patientName}
                          </Link>
                        </span>
                        <span className="flex items-center gap-2 text-neutral-500">
                          {gruppe.zeitspanne && (
                            <span className="tabular-nums">{gruppe.zeitspanne}</span>
                          )}
                          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] tabular-nums">
                            {gruppe.eintraege.length}
                          </span>
                        </span>
                      </button>
                      {offen && (
                        <div className="space-y-1.5 border-t border-neutral-100 p-2">
                          {gruppe.eintraege.map((eintrag) => (
                            <TerminKarte
                              key={eintrag.entry.id}
                              eintrag={eintrag}
                              onClick={() => oeffneEintrag(eintrag)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {woche.isLoading && <p className="mt-4 text-sm text-neutral-500">Lade Woche …</p>}

      {/* ── Legende: Therapeuten-Farben ── */}
      {legende.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-xs text-neutral-600">
          <span className="font-medium text-neutral-500">Therapeuten:</span>
          {legende.map((b) => (
            <span key={b.id} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: b.kalenderFarbe ?? "#a3a3a3" }}
              />
              {b.name ?? b.username}
            </span>
          ))}
        </div>
      )}

      {/* ── Abo-Dialog (ICS-Feed) ── */}
      <Dialog open={aboOffen} onOpenChange={setAboOffen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kalender abonnieren (ICS)</DialogTitle>
          </DialogHeader>
          <AboInhalt
            aboUrl={aboUrl}
            setAboUrl={setAboUrl}
            kopiert={aboKopiert}
            onKopieren={async () => {
              await navigator.clipboard.writeText(aboUrl);
              setAboKopiert(true);
              setTimeout(() => setAboKopiert(false), 2000);
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAboOffen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Eintrag-Dialog: Details + Status setzen ── */}
      <Dialog open={ausgewaehlt !== null} onOpenChange={(o) => !o && setAusgewaehlt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Termin</DialogTitle>
          </DialogHeader>
          {ausgewaehlt && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-neutral-50 p-3">
                <div className="font-medium text-neutral-900">
                  {ausgewaehlt.patientName}
                </div>
                <div className="mt-1 text-neutral-600">
                  {datum(ausgewaehlt.entry.datum)}
                  {uhrzeitBereich(ausgewaehlt.entry) &&
                    ` · ${uhrzeitBereich(ausgewaehlt.entry)}`}
                </div>
                <div className="text-neutral-600">
                  {ausgewaehlt.entry.leistungText ?? "–"}
                  {ausgewaehlt.planTitel ? ` · ${ausgewaehlt.planTitel}` : ""}
                </div>
                <div className="text-neutral-500">
                  {[ausgewaehlt.therapeutName, ausgewaehlt.entry.raum]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as EntryStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(ENTRY_STATUS) as EntryStatus[]
                    ).map((s) => (
                      <SelectItem key={s} value={s}>
                        {ENTRY_STATUS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bemerkung</Label>
                <Textarea
                  rows={3}
                  value={bemerkung}
                  onChange={(e) => setBemerkung(e.target.value)}
                  placeholder="optional"
                />
              </div>
              {aktualisieren.error && (
                <p className="text-sm text-red-600">{aktualisieren.error.message}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAusgewaehlt(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={aktualisieren.isPending}
              onClick={() =>
                ausgewaehlt &&
                aktualisieren.mutate({
                  id: ausgewaehlt.entry.id,
                  data: { status, bemerkung: bemerkung || null },
                })
              }
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Abo-Dialog-Inhalt: Feed-URL laden/erzeugen + kopieren. */
function AboInhalt({
  aboUrl,
  setAboUrl,
  kopiert,
  onKopieren,
}: {
  aboUrl: string;
  setAboUrl: (u: string) => void;
  kopiert: boolean;
  onKopieren: () => void;
}) {
  const utils = trpc.useUtils();
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);
  const neuToken = trpc.kalender.feedTokenNeu.useMutation({
    onSuccess: (r) => {
      setAboUrl(`${window.location.origin}${r.pfad}`);
      setLaedt(false);
    },
    onError: (e) => {
      setFehler(e.message);
      setLaedt(false);
    },
  });

  useEffect(() => {
    utils.kalender.feedUrl
      .fetch()
      .then((r) => setAboUrl(`${window.location.origin}${r.pfad}`))
      .catch((e) => setFehler(e.message))
      .finally(() => setLaedt(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const neuErzeugen = () => {
    setLaedt(true);
    neuToken.mutate();
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-neutral-600">
        Diese URL in Google Kalender („Weitere Kalender → Über URL“) oder Outlook
        („Kalender hinzufügen → Aus dem Internet abonnieren“) eintragen. Zeigt
        Termine von 2 Wochen zurück bis 12 Wochen voraus.
      </p>
      {laedt ? (
        <p className="text-neutral-400">Lade Feed-URL …</p>
      ) : fehler ? (
        <p className="text-red-600">{fehler}</p>
      ) : (
        <div className="flex items-center gap-2">
          <code className="max-w-full flex-1 overflow-x-auto rounded bg-neutral-50 px-2 py-2 font-mono text-xs">
            {aboUrl}
          </code>
          <Button variant="outline" size="sm" onClick={onKopieren}>
            <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
            {kopiert ? "Kopiert!" : "Kopieren"}
          </Button>
        </div>
      )}
      <p className="text-xs text-neutral-400">
        Der Link enthält ein gemeinsames Geheimnis — nur an Personen weitergeben,
        die den Kalender sehen dürfen. Bei Verlust/Missbrauch:{" "}
        <button type="button" className="underline" onClick={neuErzeugen}>
          neuen Link erzeugen
        </button>{" "}
        (alter wird ungültig).
      </p>
    </div>
  );
}
