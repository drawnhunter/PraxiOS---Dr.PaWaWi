import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { blobHerunterladen } from "@/lib/downloads";
import { ENTRY_STATUS, type EntryStatus } from "@contracts/constants";
import { cn } from "@/lib/utils";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SerienAssistent from "@/components/SerienAssistent";
import { LeistungCombobox } from "@/components/LeistungCombobox";
import { PlanStatusBadge } from "./Plans";
import {
  datumZuKw,
  heuteIso,
  kwZuDatum,
  tageAddieren,
  uhrzeitBereich,
} from "./Kalender";
import { CalendarPlus, Check, Copy, Download, GripVertical, Plus, RefreshCw, Trash2 } from "lucide-react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type PlanDetailDaten = RouterOutputs["plaene"]["byId"];
type PlanEintrag = PlanDetailDaten["entries"][number];

const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr"];

/** Punkt-Farbe je Eintragsstatus im Wochenraster. */
function statusPunktKlasse(status: EntryStatus): string {
  switch (status) {
    case "stattgefunden":
      return "bg-primary";
    case "abgesagt":
      return "bg-amber-500";
    case "ausgefallen":
      return "bg-red-500";
    default:
      return "bg-neutral-300";
  }
}

/** Nutzereingabe Menge („1,5“) → API-Format („1.5“, max. 1 Dezimalstelle). */
function parseMenge(input: string): string {
  const n = Number(input.trim().replace(",", "."));
  if (Number.isNaN(n) || n <= 0) return "1";
  return String(Math.round(n * 10) / 10);
}

interface EintragForm {
  id: number | null;
  datum: string;
  menge: string;
  leistungAuswahl: string; // „keine“ | „freitext“ | Leistungs-ID
  leistungFreitext: string;
  therapeutId: string; // „keiner“ | Benutzer-ID
  zeitVon: string;
  zeitBis: string;
  raum: string;
  status: EntryStatus;
  bemerkung: string;
}

export default function PlanDetail() {
  const { id } = useParams();
  const planId = Number(id);

  const utils = trpc.useUtils();
  // Auto-Refresh alle 15 s (Mehrbenutzer-Betrieb) + manueller Refresh-Button
  const plan = trpc.plaene.byId.useQuery(
    { id: planId },
    { refetchInterval: 15000, refetchIntervalInBackground: false },
  );
  const leistungen = trpc.leistungen.list.useQuery({});
  // Therapeuten-Liste (für alle eingeloggten Nutzer, ohne sensible Felder)
  const benutzer = trpc.auth.therapeuten.useQuery();

  const [eintragForm, setEintragForm] = useState<EintragForm | null>(null);
  const [serienOffen, setSerienOffen] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [exportFehler, setExportFehler] = useState("");
  const [exportLaeuft, setExportLaeuft] = useState(false);

  const invalidate = () => {
    utils.plaene.byId.invalidate({ id: planId });
    utils.plaene.list.invalidate();
    utils.kalender.woche.invalidate();
  };

  const setStatus = trpc.plaene.setStatus.useMutation({ onSuccess: invalidate });
  const rechnungErstellen = trpc.plaene.rechnungErstellen.useMutation({
    onSuccess: (r) => {
      if (r.nichtUebernommen.length > 0) {
        zeigeErfolg(
          `Entwurf erstellt — ${r.nichtUebernommen.length} Position(en) nicht übernommen (im Entwurf ergänzen).`,
        );
      }
      navigate(`/rechnungen/${r.invoiceId}`);
    },
  });
  const dupliziereEintrag = trpc.plaene.duplicateEntry.useMutation({
    onSuccess: () => {
      invalidate();
      zeigeErfolg("Eintrag dupliziert.");
    },
  });
  const tagStatus = trpc.plaene.tagStatus.useMutation({
    onSuccess: () => {
      invalidate();
      zeigeErfolg("Tag als stattgefunden markiert.");
    },
  });
  const dupliziereTag = trpc.plaene.duplicateDay.useMutation({
    onSuccess: (r) => {
      invalidate();
      setTagDuplikat(null);
      zeigeErfolg(`${r.anzahl} Einträge dupliziert.`);
    },
  });
  const navigate = useNavigate();
  const [tagDuplikat, setTagDuplikat] = useState<string | null>(null);
  const [duplikatZiel, setDuplikatZiel] = useState("");
  const [duplikatModus, setDuplikatModus] = useState<"kopieren" | "verschieben">("kopieren");
  // Markieren (Block-Aktionen)
  const [markiert, setMarkiert] = useState<Set<number>>(new Set());
  // dnd-kit: Maus = sofort ab 6px; Touch = 200 ms halten (kurzes Wischen
  // bleibt Scrollen). Listeners hängen NUR am Griff — nicht an der Karte.
  const sensoren = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const handleDragEnd = (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over) return;
    const eintragId = Number(String(active.id).replace("eintrag-", ""));
    const tag = String(over.id).replace("tag-", "");
    if (!Number.isInteger(eintragId) || eintragId <= 0) return;
    const eintrag = (plan.data?.entries ?? []).find((x) => x.id === eintragId);
    if (!eintrag || eintrag.datum === tag) return;
    speichernAlt.mutate(
      { id: eintragId, data: { datum: tag } },
      { onSuccess: () => zeigeErfolg(`Verschoben auf ${datum(tag)}.`) },
    );
  };
  const [bulkDialog, setBulkDialog] = useState<null | "duplizieren" | "verschieben">(null);
  const [bulkZiel, setBulkZiel] = useState("");

  const toggleMark = (id: number) =>
    setMarkiert((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });

  const planLoeschen = trpc.plaene.loeschen.useMutation({
    onSuccess: () => navigate("/plaene"),
  });
  const planWiederherstellen = trpc.plaene.wiederherstellen.useMutation({
    onSuccess: invalidate,
  });
  const bulk = trpc.plaene.bulk.useMutation({
    onSuccess: (r, vars) => {
      invalidate();
      setMarkiert(new Set());
      setBulkDialog(null);
      setBulkZiel("");
      zeigeErfolg(
        vars.aktion === "loeschen"
          ? `${r.anzahl} Einträge gelöscht.`
          : vars.aktion === "verschieben"
            ? `${r.anzahl} Einträge verschoben.`
            : `${r.anzahl} Einträge dupliziert.`,
      );
    },
  });
  const dokumentieren = trpc.plaene.dokumentieren.useMutation({ onSuccess: invalidate });
  const speichernNeu = trpc.plaene.addEntry.useMutation({
    onSuccess: () => {
      invalidate();
      setEintragForm(null);
    },
  });
  const speichernAlt = trpc.plaene.updateEntry.useMutation({
    onSuccess: () => {
      invalidate();
      setEintragForm(null);
    },
  });
  const loeschen = trpc.plaene.removeEntry.useMutation({
    onSuccess: () => {
      invalidate();
      setEintragForm(null);
    },
  });

  // ── Wochenraster: alle Kalenderwochen des Plan-Zeitraums ────────────────
  const wochen = useMemo(() => {
    if (!plan.data) return [];
    const { vonDatum, bisDatum } = plan.data;
    const startKw = datumZuKw(vonDatum);
    let montag = kwZuDatum(startKw.jahr, startKw.kw, 1);
    const liste: { jahr: number; kw: number; tage: string[] }[] = [];
    while (montag <= bisDatum) {
      const { jahr, kw } = datumZuKw(montag);
      liste.push({
        jahr,
        kw,
        tage: [1, 2, 3, 4, 5].map((wt) => kwZuDatum(jahr, kw, wt)),
      });
      montag = tageAddieren(montag, 7);
    }
    return liste;
  }, [plan.data]);

  const eintraegeNachDatum = useMemo(() => {
    const map = new Map<string, PlanEintrag[]>();
    for (const e of plan.data?.entries ?? []) {
      if (!map.has(e.datum)) map.set(e.datum, []);
      map.get(e.datum)!.push(e);
    }
    return map;
  }, [plan.data]);

  // Therapeuten-Optionen: Benutzerliste, sonst eindeutige Therapeuten der Einträge
  const therapeuten = useMemo(() => {
    if (benutzer.data && benutzer.data.length > 0) {
      return benutzer.data.map((b) => ({ id: b.id, name: b.name ?? b.username ?? "" }));
    }
    const map = new Map<number, string>();
    for (const e of plan.data?.entries ?? []) {
      if (e.therapeut) map.set(e.therapeut.id, e.therapeut.name ?? "");
    }
    return [...map.entries()].map(([tid, name]) => ({ id: tid, name }));
  }, [benutzer.data, plan.data]);

  // Leistungen nach Kategorie gruppieren (für die Combobox-Optionen)
  const leistungsOptionen = useMemo(
    () =>
      (leistungen.data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        kategorie: l.kategorie,
      })),
    [leistungen.data],
  );

  if (plan.isLoading) return <p className="text-sm text-neutral-500">Lade …</p>;
  if (!plan.data)
    return <p className="text-sm text-neutral-500">Therapieplan nicht gefunden.</p>;

  const p = plan.data;
  const titel = p.titel ?? `Therapieplan KW ${datumZuKw(p.vonDatum).kw}`;

  const oeffneNeu = (tag: string) => {
    setEintragForm({
      id: null,
      datum: tag,
      menge: "1",
      leistungAuswahl: "keine",
      leistungFreitext: "",
      therapeutId: "keiner",
      zeitVon: "",
      zeitBis: "",
      raum: "",
      status: "geplant",
      bemerkung: "",
    });
  };

  const oeffneBearbeiten = (e: PlanEintrag) => {
    setEintragForm({
      id: e.id,
      datum: e.datum,
      menge: e.menge.replace(".", ","),
      leistungAuswahl: e.leistungId
        ? String(e.leistungId)
        : e.leistungText
          ? "freitext"
          : "keine",
      leistungFreitext: e.leistungId ? "" : (e.leistungText ?? ""),
      therapeutId: e.therapeutId ? String(e.therapeutId) : "keiner",
      zeitVon: e.zeitVon ?? "",
      zeitBis: e.zeitBis ?? "",
      raum: e.raum ?? "",
      status: e.status,
      bemerkung: e.bemerkung ?? "",
    });
  };

  const eintragAbsenden = () => {
    if (!eintragForm) return;
    const gewaehlt = (leistungen.data ?? []).find(
      (l) => String(l.id) === eintragForm.leistungAuswahl,
    );
    const daten = {
      datum: eintragForm.datum,
      menge: parseMenge(eintragForm.menge),
      leistungId: gewaehlt ? gewaehlt.id : null,
      leistungText: gewaehlt
        ? gewaehlt.name
        : eintragForm.leistungAuswahl === "freitext"
          ? eintragForm.leistungFreitext || null
          : null,
      therapeutId:
        eintragForm.therapeutId === "keiner" ? null : Number(eintragForm.therapeutId),
      zeitVon: eintragForm.zeitVon || null,
      zeitBis: eintragForm.zeitBis || null,
      raum: eintragForm.raum || null,
      status: eintragForm.status,
      bemerkung: eintragForm.bemerkung || null,
    };
    if (eintragForm.id) {
      speichernAlt.mutate({ id: eintragForm.id, data: daten });
    } else {
      speichernNeu.mutate({ planId, ...daten });
    }
  };

  const exportieren = async () => {
    setExportFehler("");
    setExportLaeuft(true);
    try {
      const r = await utils.plaene.exportDrReWaWi.fetch({ id: planId });
      blobHerunterladen(
        r.dateiname,
        new Blob([r.csv], { type: "text/csv;charset=utf-8" }),
      );
    } catch (e) {
      setExportFehler(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setExportLaeuft(false);
    }
  };

  const zeigeErfolg = (text: string) => {
    setMeldung(text);
    setTimeout(() => setMeldung(""), 5000);
  };

  const eintragFehler = speichernNeu.error ?? speichernAlt.error ?? loeschen.error;
  const aktionFehler =
    rechnungErstellen.error ?? dupliziereEintrag.error ?? dupliziereTag.error ?? bulk.error;
  const heute = heuteIso();

  return (
    <div className="space-y-6">
      {/* ── Kopf ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{titel}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            <Link to={`/patienten/${p.patientId}`} className="text-primary hover:underline">
              {p.patient.name}
            </Link>{" "}
            · <span className="tabular-nums">{datum(p.vonDatum)}–{datum(p.bisDatum)}</span>{" "}
            · <PlanStatusBadge status={p.status} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            title="Neu laden (Mehrbenutzer-Sync, alle 15 s automatisch)"
            onClick={() => plan.refetch()}
            disabled={plan.isRefetching}
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", plan.isRefetching && "animate-spin")} />
            Aktualisieren
          </Button>
          {p.status === "geplant" && (
            <Button onClick={() => setStatus.mutate({ id: planId, status: "aktiv" })}>
              Aktivieren
            </Button>
          )}
          {p.status === "aktiv" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>Woche dokumentieren</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Plan als dokumentiert markieren?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Der Plan wird als dokumentiert markiert. Bitte prüfen Sie vorher,
                    ob alle Termine der Woche erfasst sind.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => dokumentieren.mutate({ id: planId })}>
                    Dokumentieren
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {p.status === "dokumentiert" && (
            <Button
              onClick={() => rechnungErstellen.mutate({ id: planId })}
              disabled={rechnungErstellen.isPending}
            >
              {rechnungErstellen.isPending ? "Erstelle …" : "Rechnung erstellen"}
            </Button>
          )}
          {p.status === "dokumentiert" && (
            <Button
              variant="outline"
              onClick={() => setStatus.mutate({ id: planId, status: "abgerechnet" })}
            >
              Als abgerechnet markieren
            </Button>
          )}
          {(p.status === "dokumentiert" || p.status === "abgerechnet") && (
            <Button variant="outline" onClick={exportieren} disabled={exportLaeuft}>
              <Download className="mr-1.5 h-4 w-4" />
              {exportLaeuft ? "Exportiere …" : "Dr.ReWaWi-Export (CSV)"}
            </Button>
          )}
          <Button variant="outline" onClick={() => setSerienOffen(true)}>
            <CalendarPlus className="mr-1.5 h-4 w-4" /> Serien-Termine
          </Button>
          {p.status !== "abgerechnet" && !p.geloeschtAm && (
            <Button
              variant="outline"
              className="text-red-600"
              onClick={() => {
                if (window.confirm("Plan in den Papierkorb legen? (48 h wiederherstellbar)")) {
                  planLoeschen.mutate({ id: planId });
                }
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Löschen
            </Button>
          )}
        </div>
      </div>
      {p.geloeschtAm && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            Im Papierkorb seit {new Date(p.geloeschtAm).toLocaleString("de-DE")} —
            innerhalb von 48 h wiederherstellbar.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => planWiederherstellen.mutate({ id: planId })}
          >
            Wiederherstellen
          </Button>
        </div>
      )}
      {(p.status === "dokumentiert" || p.status === "abgerechnet") && (
        <p className="-mt-4 text-xs text-neutral-400">
          Der CSV-Export enthält nur stattgefundene Leistungen.
        </p>
      )}
      {exportFehler && <p className="text-sm text-red-600">{exportFehler}</p>}
      {aktionFehler && <p className="text-sm text-red-600">{aktionFehler.message}</p>}
      {meldung && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{meldung}</p>
      )}

      {/* ── Fachliche Angaben ── */}
      {(p.diagnoseZiele || p.notizen || p.rechnungsempfaengerAbweichend) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {p.diagnoseZiele && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-medium text-neutral-700">Diagnose / Ziele</h2>
              <p className="whitespace-pre-wrap text-sm text-neutral-600">{p.diagnoseZiele}</p>
            </section>
          )}
          {p.notizen && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-medium text-neutral-700">Notizen</h2>
              <p className="whitespace-pre-wrap text-sm text-neutral-600">{p.notizen}</p>
            </section>
          )}
          {p.rechnungsempfaengerAbweichend && p.abweichenderEmpfaenger && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-medium text-neutral-700">
                Abweichender Rechnungsempfänger
              </h2>
              <p className="whitespace-pre-wrap text-sm text-neutral-600">
                {p.abweichenderEmpfaenger}
              </p>
            </section>
          )}
        </div>
      )}

      {/* ── Wochenraster ── */}
      <DndContext sensors={sensoren} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {wochen.map((w) => (
          <section
            key={`${w.jahr}-${w.kw}`}
            className="overflow-x-auto rounded-lg border border-neutral-200 bg-white"
          >
            <h2 className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700">
              KW {w.kw}
            </h2>
            <div className="grid min-w-[700px] grid-cols-5">
              {w.tage.map((tag, i) => {
                const imZeitraum = tag >= p.vonDatum && tag <= p.bisDatum;
                const tagesEintraege = eintraegeNachDatum.get(tag) ?? [];
                return (
                  <div
                    key={tag}
                    className={cn(
                      "border-r border-neutral-100 last:border-r-0",
                      !imZeitraum && "bg-neutral-50/60",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between border-b border-neutral-100 px-2 py-1.5 text-xs",
                        tag === heute
                          ? "font-semibold text-primary"
                          : "text-neutral-500",
                      )}
                    >
                      <span>
                        {WOCHENTAGE_KURZ[i]}{" "}
                        <span className="tabular-nums">{datum(tag)}</span>
                      </span>
                      {tagesEintraege.length > 0 && imZeitraum && (
                        <button
                          type="button"
                          title="Alle Einträge des Tages als stattgefunden markieren"
                          onClick={() => tagStatus.mutate({ planId, datum: tag, status: "stattgefunden" })}
                          className="rounded p-0.5 text-neutral-300 hover:bg-neutral-100 hover:text-primary"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      {tagesEintraege.length > 0 && imZeitraum && (
                        <button
                          type="button"
                          title="Alle Einträge dieses Tages duplizieren"
                          onClick={() => {
                            setTagDuplikat(tag);
                            setDuplikatZiel("");
                          }}
                          className="rounded p-0.5 text-neutral-300 hover:bg-neutral-100 hover:text-primary"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <TagDropZone tag={tag}>
                      {tagesEintraege.map((e) => (
                        <EintragsKarte
                          key={e.id}
                          e={e}
                          markiert={markiert.has(e.id)}
                          onToggleMark={() => toggleMark(e.id)}
                          onEdit={() => oeffneBearbeiten(e)}
                          onDuplicate={() => dupliziereEintrag.mutate({ id: e.id })}
                          onDelete={() => {
                            if (window.confirm("Eintrag wirklich löschen?")) {
                              loeschen.mutate({ id: e.id });
                            }
                          }}
                          onStatus={(status) =>
                            speichernAlt.mutate({ id: e.id, data: { status } })
                          }
                        />
                      ))}
                      {imZeitraum && (
                        <button
                          type="button"
                          onClick={() => oeffneNeu(tag)}
                          className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-neutral-200 py-1 text-[11px] text-neutral-400 hover:border-primary/40 hover:text-primary"
                        >
                          <Plus className="h-3 w-3" /> Eintrag
                        </button>
                      )}
                    </TagDropZone>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      </DndContext>

      {/* ── Block-Aktionsleiste (markierte Einträge) ── */}
      {markiert.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium tabular-nums">{markiert.size} markiert</span>
          <Button size="sm" variant="outline" onClick={() => setBulkDialog("duplizieren")}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Duplizieren
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkDialog("verschieben")}>
            <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Verschieben
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600"
            onClick={() => {
              if (window.confirm(`${markiert.size} markierte Einträge wirklich löschen?`)) {
                bulk.mutate({ ids: [...markiert], aktion: "loeschen" });
              }
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Löschen
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMarkiert(new Set())}>
            Aufheben
          </Button>
        </div>
      )}

      {/* ── Block-Duplizieren/Verschieben-Dialog ── */}
      <Dialog open={bulkDialog !== null} onOpenChange={(o) => !o && setBulkDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {markiert.size} Einträge {bulkDialog === "verschieben" ? "verschieben" : "duplizieren"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-600">
            {bulkDialog === "verschieben"
              ? "Die Einträge wechseln auf das Zieldatum — Uhrzeit, Therapeut und Raum bleiben erhalten."
              : "Zieldatum leer lassen = am selben Tag duplizieren (Kopien starten als „geplant“)."}
          </p>
          <div>
            <Label>
              Zieldatum {bulkDialog === "verschieben" ? "*" : "(optional)"}
            </Label>
            <Input
              type="date"
              value={bulkZiel}
              min={p.vonDatum}
              max={p.bisDatum}
              onChange={(e) => setBulkZiel(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={bulk.isPending || (bulkDialog === "verschieben" && !bulkZiel)}
              onClick={() =>
                bulk.mutate({
                  ids: [...markiert],
                  aktion: bulkDialog === "verschieben" ? "verschieben" : "duplizieren",
                  zielDatum: bulkZiel || undefined,
                })
              }
            >
              {bulk.isPending
                ? "Arbeite …"
                : bulkDialog === "verschieben"
                  ? "Verschieben"
                  : "Duplizieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Serien-Assistent ── */}
      <SerienAssistent
        planId={planId}
        open={serienOffen}
        onOpenChange={setSerienOffen}
        onSuccess={(anzahl) => zeigeErfolg(`${anzahl} Termine angelegt.`)}
      />

      {/* ── Tag-Duplikat-Dialog ── */}
      <Dialog open={tagDuplikat !== null} onOpenChange={(o) => !o && setTagDuplikat(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tag duplizieren</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-600">
            Alle Einträge vom {tagDuplikat ? datum(tagDuplikat) : ""} auf einen anderen
            Tag im Plan-Zeitraum übertragen (Kopien starten als „geplant“).
          </p>
          <div>
            <Label>Aktion</Label>
            <Select value={duplikatModus} onValueChange={(v) => setDuplikatModus(v as "kopieren" | "verschieben")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kopieren">Kopieren (Tag bleibt bestehen)</SelectItem>
                <SelectItem value="verschieben">Verschieben (Tag wird umgelegt)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zieldatum</Label>
            <Input
              type="date"
              value={duplikatZiel}
              min={p.vonDatum}
              max={p.bisDatum}
              onChange={(e) => setDuplikatZiel(e.target.value)}
            />
          </div>
          {dupliziereTag.error && (
            <p className="text-sm text-red-600">{dupliziereTag.error.message}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDuplikat(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={!duplikatZiel || dupliziereTag.isPending}
              onClick={() =>
                tagDuplikat &&
                dupliziereTag.mutate({
                  planId,
                  vonDatum: tagDuplikat,
                  nachDatum: duplikatZiel,
                  modus: duplikatModus,
                })
              }
            >
              {dupliziereTag.isPending
                ? "Übertrage …"
                : duplikatModus === "verschieben"
                  ? "Verschieben"
                  : "Kopieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Eintrag-Dialog (anlegen/bearbeiten) ── */}
      <Dialog
        open={eintragForm !== null}
        onOpenChange={(o) => !o && setEintragForm(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {eintragForm?.id ? "Eintrag bearbeiten" : "Neuer Eintrag"}
              {eintragForm && ` — ${datum(eintragForm.datum)}`}
            </DialogTitle>
          </DialogHeader>
          {eintragForm && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="col-span-2">
                <Label>Leistung</Label>
                <LeistungCombobox
                  leistungen={leistungsOptionen}
                  auswahl={eintragForm.leistungAuswahl}
                  freitext={eintragForm.leistungFreitext}
                  onAuswahl={(v) =>
                    setEintragForm({ ...eintragForm, leistungAuswahl: v })
                  }
                  onFreitext={(t) =>
                    setEintragForm({ ...eintragForm, leistungFreitext: t })
                  }
                />
              </div>
              {eintragForm.leistungAuswahl === "freitext" && (
                <div className="col-span-2">
                  <Label>Leistung (Freitext)</Label>
                  <Input
                    value={eintragForm.leistungFreitext}
                    onChange={(e) =>
                      setEintragForm({ ...eintragForm, leistungFreitext: e.target.value })
                    }
                  />
                </div>
              )}
              <div>
                <Label>Menge</Label>
                <Input
                  value={eintragForm.menge}
                  onChange={(e) =>
                    setEintragForm({ ...eintragForm, menge: e.target.value })
                  }
                  placeholder="1 bzw. 1,5"
                />
              </div>
              <div>
                <Label>Therapeut</Label>
                <Select
                  value={eintragForm.therapeutId}
                  onValueChange={(v) =>
                    setEintragForm({ ...eintragForm, therapeutId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keiner">Kein Therapeut</SelectItem>
                    {therapeuten.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Zeit von</Label>
                <Input
                  type="time"
                  value={eintragForm.zeitVon}
                  onChange={(e) =>
                    setEintragForm({ ...eintragForm, zeitVon: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Zeit bis</Label>
                <Input
                  type="time"
                  value={eintragForm.zeitBis}
                  onChange={(e) =>
                    setEintragForm({ ...eintragForm, zeitBis: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Raum</Label>
                <Input
                  value={eintragForm.raum}
                  onChange={(e) =>
                    setEintragForm({ ...eintragForm, raum: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={eintragForm.status}
                  onValueChange={(v) =>
                    setEintragForm({ ...eintragForm, status: v as EntryStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTRY_STATUS) as EntryStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {ENTRY_STATUS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Bemerkung</Label>
                <Textarea
                  rows={2}
                  value={eintragForm.bemerkung}
                  onChange={(e) =>
                    setEintragForm({ ...eintragForm, bemerkung: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          {eintragFehler && (
            <p className="text-sm text-red-600">{eintragFehler.message}</p>
          )}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div>
              {eintragForm?.id && (
                <Button
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => loeschen.mutate({ id: eintragForm.id! })}
                  disabled={loeschen.isPending}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Löschen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEintragForm(null)}>
                Abbrechen
              </Button>
              <Button
                onClick={eintragAbsenden}
                disabled={speichernNeu.isPending || speichernAlt.isPending}
              >
                Speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Drop-Zone pro Tag (dnd-kit) ───────────────────────────────────────────
function TagDropZone({ tag, children }: { tag: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tag-${tag}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-1 p-1.5 transition-colors",
        isOver && "rounded bg-primary/5 ring-1 ring-primary/30 ring-inset",
      )}
    >
      {children}
    </div>
  );
}

// ── Eintrags-Karte (Drag & Drop, Status-Klick, Markieren, Aktionen) ─────────
function EintragsKarte({
  e,
  markiert,
  onToggleMark,
  onEdit,
  onDuplicate,
  onDelete,
  onStatus,
}: {
  e: PlanEintrag;
  markiert: boolean;
  onToggleMark: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStatus: (s: EntryStatus) => void;
}) {
  const [statusOffen, setStatusOffen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `eintrag-${e.id}`,
    data: { id: e.id },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "w-full rounded border bg-white p-1.5 text-left text-xs transition-colors",
        isDragging && "z-30 shadow-lg",
        markiert
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
          : "border-neutral-200 hover:bg-neutral-50",
        e.status === "stattgefunden" && "opacity-70",
        (e.status === "abgesagt" || e.status === "ausgefallen") && "opacity-70",
      )}
    >
      <div className="flex items-stretch gap-1.5">
        {/* Links: Status-Punkt (klickbar), Drag-Griff (Mitte), Markieren-Checkbox */}
        <div className="flex shrink-0 flex-col items-center justify-between py-0.5">
          <Popover open={statusOffen} onOpenChange={setStatusOffen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={`${ENTRY_STATUS[e.status]} — klicken zum Ändern`}
                className="rounded-full p-0.5 hover:bg-neutral-100"
              >
                <span
                  className={cn("block h-3.5 w-3.5 rounded-full", statusPunktKlasse(e.status))}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="start">
              {(Object.keys(ENTRY_STATUS) as EntryStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onStatus(s);
                    setStatusOffen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-50",
                    e.status === s && "bg-neutral-50 font-semibold",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", statusPunktKlasse(s))} />
                  {ENTRY_STATUS[s]}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {/* Drag-Griff: NUR hier startet das Verschieben. touch-action:none
              verhindert Scrollen/Text-Markierung beim Halten auf dem Griff. */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            title="Zum Verschieben halten & ziehen"
            className="cursor-grab touch-none select-none rounded p-0.5 text-neutral-300 [-webkit-touch-callout:none] hover:bg-neutral-100 hover:text-neutral-500 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <input
            type="checkbox"
            checked={markiert}
            onChange={onToggleMark}
            onClick={(ev) => ev.stopPropagation()}
            title="Markieren (Block-Aktionen)"
            className="h-3.5 w-3.5 cursor-pointer accent-[#0F766E]"
          />
        </div>

        {/* Inhalt: Klick = bearbeiten */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onEdit}>
          <div
            className={cn(
              "font-medium text-neutral-800",
              (e.status === "abgesagt" || e.status === "ausgefallen") && "line-through",
            )}
          >
            {e.menge.replace(".", ",")} × {e.leistungText ?? e.leistung?.name ?? "Leistung"}
          </div>
          <div className="mt-0.5 text-neutral-500">
            {[e.therapeut?.name, uhrzeitBereich(e), e.raum].filter(Boolean).join(" · ")}
          </div>
        </div>

        {/* Rechts: Duplizieren (oben) + Löschen (unten, gespiegelt) */}
        <div className="flex shrink-0 flex-col items-center justify-between py-0.5">
          <button
            type="button"
            title="Eintrag duplizieren"
            onClick={(ev) => {
              ev.stopPropagation();
              onDuplicate();
            }}
            className="rounded p-0.5 text-neutral-300 hover:bg-neutral-100 hover:text-primary"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Eintrag löschen"
            onClick={(ev) => {
              ev.stopPropagation();
              onDelete();
            }}
            className="rounded p-0.5 text-neutral-300 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
