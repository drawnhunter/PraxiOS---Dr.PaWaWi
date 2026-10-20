// ── PraxiOS: Kostenpläne / HKP — Register (1.26.0) ─────────────────────────
// Tabelle + Suche + Statusfilter; Zeile anklicken → Detail-Paneel mit allen
// Sektionen + Aktionen (analog Rechnungen-Register). Erstellen/Bearbeiten
// bleibt im Dialog.
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { pdfHerunterladen } from "@/lib/downloads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import {
  Copy,
  FileDown,
  FilePlus2,
  FileText,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

interface PosZeile {
  gruppe: string;
  leistungId: number | null;
  bezeichnung: string;
  beschreibung: string;
  menge: string;
  einheit: string;
  einzelpreis: string;
  ustSatz: number;
  goaeText: string;
}
interface DiagZeile { code: string; text: string; kurzbegruendung: string }
interface PlanForm {
  patientId: number | null;
  patientName: string;
  titel: string;
  zeitraumVon: string;
  zeitraumBis: string;
  diagnosen: DiagZeile[];
  begruendung: string;
  klartextNote: string;
  positionen: PosZeile[];
}

const leerePosition: PosZeile = { gruppe: "", leistungId: null, bezeichnung: "", beschreibung: "", menge: "1", einheit: "Stück", einzelpreis: "", ustSatz: 0, goaeText: "" };
const leerForm: PlanForm = {
  patientId: null, patientName: "", titel: "Heil- und Kostenplan",
  zeitraumVon: "", zeitraumBis: "", diagnosen: [], begruendung: "", klartextNote: "",
  positionen: [{ ...leerePosition }],
};

const geld = (v: number | string) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));

export default function Kostenplaene() {
  const utils = trpc.useUtils();
  const liste = trpc.kostenplaene.liste.useQuery();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const detail = trpc.kostenplaene.byId.useQuery({ id: gewaehlt! }, { enabled: gewaehlt !== null });
  const [dialog, setDialog] = useState<"neu" | number | null>(null);
  const [form, setForm] = useState<PlanForm>(leerForm);
  const [suche, setSuche] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [loescheId, setLoescheId] = useState<number | null>(null);
  const [icdSucheText, setIcdSucheText] = useState("");

  const patienten = trpc.customers.list.useQuery(
    { suche: suche.trim() || undefined },
    { enabled: dialog !== null && form.patientId === null },
  );
  const produkte = trpc.products.list.useQuery(undefined, { enabled: dialog !== null });
  const icdTreffer = trpc.rezepte.icdSuche.useQuery(
    { q: icdSucheText.trim() },
    { enabled: icdSucheText.trim().length >= 2 },
  );

  const neuLaden = () => {
    utils.kostenplaene.liste.invalidate();
    if (gewaehlt) utils.kostenplaene.byId.invalidate({ id: gewaehlt });
  };
  const erstellen = trpc.kostenplaene.erstellen.useMutation({
    onSuccess: () => { setDialog(null); setForm(leerForm); setFehler(null); neuLaden(); },
    onError: (e) => setFehler(e.message),
  });
  const aktualisieren = trpc.kostenplaene.aktualisieren.useMutation({
    onSuccess: () => { setDialog(null); setForm(leerForm); setFehler(null); neuLaden(); },
    onError: (e) => setFehler(e.message),
  });
  const finalisieren = trpc.kostenplaene.finalisieren.useMutation({ onSuccess: neuLaden });
  const duplizieren = trpc.kostenplaene.duplizieren.useMutation({ onSuccess: neuLaden });
  const loeschen = trpc.kostenplaene.loeschen.useMutation({
    onSuccess: () => { setLoescheId(null); setGewaehlt(null); neuLaden(); },
  });

  const gefiltert = (liste.data ?? []).filter((p) => {
    if (statusFilter !== "alle" && p.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return (
      p.titel.toLowerCase().includes(t) ||
      (p.nummer ?? "").toLowerCase().includes(t) ||
      (p.patient?.name ?? "").toLowerCase().includes(t)
    );
  });

  const setPos = (i: number, feld: keyof PosZeile, wert: string | number | null) =>
    setForm({ ...form, positionen: form.positionen.map((p, j) => (j === i ? { ...p, [feld]: wert } : p)) });

  const produktWaehlen = (i: number, name: string) => {
    const p = (produkte.data ?? []).find((x) => x.name === name);
    setForm({
      ...form,
      positionen: form.positionen.map((x, j) =>
        j === i
          ? {
              ...x,
              bezeichnung: name,
              leistungId: p?.id ?? null,
              einzelpreis: p ? String(Number(p.preisNetto).toFixed(2)) : x.einzelpreis,
              einheit: p?.einheit ?? x.einheit,
              ustSatz: p?.ustSatz ?? x.ustSatz,
              goaeText: p?.goaeZiffer ? `analog GOÄ ${p.goaeZiffer}` : x.goaeText,
            }
          : x,
      ),
    });
  };

  const absenden = () => {
    setFehler(null);
    if (!form.patientId) return setFehler("Bitte einen Patienten wählen.");
    const positionen = form.positionen
      .filter((p) => p.bezeichnung.trim())
      .map((p) => ({
        gruppe: p.gruppe.trim() || undefined,
        leistungId: p.leistungId,
        bezeichnung: p.bezeichnung.trim(),
        beschreibung: p.beschreibung.trim() || undefined,
        menge: p.menge || "1",
        einheit: p.einheit || "Stück",
        einzelpreis: p.einzelpreis || "0",
        ustSatz: p.ustSatz,
        goaeText: p.goaeText.trim() || undefined,
      }));
    if (positionen.length === 0) return setFehler("Mindestens eine Position mit Bezeichnung.");
    const payload = {
      patientId: form.patientId,
      titel: form.titel.trim() || "Heil- und Kostenplan",
      zeitraumVon: form.zeitraumVon || null,
      zeitraumBis: form.zeitraumBis || null,
      diagnosen: form.diagnosen.map((d) => ({ code: d.code, text: d.text, kurzbegruendung: d.kurzbegruendung.trim() || undefined })),
      begruendung: form.begruendung.trim(),
      klartextNote: form.klartextNote.trim(),
      positionen,
    };
    if (dialog === "neu") erstellen.mutate(payload);
    else if (typeof dialog === "number") aktualisieren.mutate({ id: dialog, ...payload });
  };

  const herunterladen = async (id: number, art: "pdf" | "docx") => {
    const r = art === "pdf"
      ? await utils.kostenplaene.pdf.fetch({ id })
      : await utils.kostenplaene.docx.fetch({ id });
    pdfHerunterladen({ dateiname: r.dateiname, base64: r.base64 });
  };

  const ladenZumBearbeiten = async (id: number) => {
    const p = await utils.kostenplaene.byId.fetch({ id });
    setForm({
      patientId: p.patientId,
      patientName: p.patient?.name ?? "",
      titel: p.titel,
      zeitraumVon: p.zeitraumVon ?? "",
      zeitraumBis: p.zeitraumBis ?? "",
      diagnosen: p.diagnosenJson ? JSON.parse(p.diagnosenJson) : [],
      begruendung: p.begruendung ?? "",
      klartextNote: p.klartextNote ?? "",
      positionen: p.positionen.map((x) => ({
        gruppe: x.gruppe ?? "",
        leistungId: x.leistungId,
        bezeichnung: x.bezeichnung,
        beschreibung: x.beschreibung ?? "",
        menge: String(x.menge),
        einheit: x.einheit,
        einzelpreis: String(x.einzelpreis),
        ustSatz: x.ustSatz,
        goaeText: x.goaeText ?? "",
      })),
    });
    setFehler(null);
    setDialog(id);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <FileText className="h-5 w-5 text-amber-700" /> Kostenpläne (HKP)
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Heil- und Kostenpläne — Diagnosen, Begründung, gruppierte Kostenaufstellung.
            Ausgabe PDF/Word; finalisierte Pläne liegen in der Akte.
          </p>
        </div>
        <Button onClick={() => { setForm(leerForm); setFehler(null); setDialog("neu"); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Kostenplan erstellen
        </Button>
      </div>

      {/* Register-Leiste: Suche + Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nummer / Titel / Patient suchen …"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            <SelectItem value="entwurf">Entwurf</SelectItem>
            <SelectItem value="finalisiert">Finalisiert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,1.1fr)]">
        {/* ── Tabelle ── */}
        <div className="rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                <th className="px-3 py-2.5 font-medium">Nummer</th>
                <th className="px-3 py-2.5 font-medium">Titel</th>
                <th className="px-3 py-2.5 font-medium">Patient</th>
                <th className="px-3 py-2.5 font-medium">Summe</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-neutral-400">
                    {(liste.data ?? []).length === 0
                      ? "Noch keine Kostenpläne. Der erste fängt alles an."
                      : "Kein Treffer für Suche/Filter."}
                  </td>
                </tr>
              )}
              {gefiltert.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setGewaehlt(p.id)}
                  className={`cursor-pointer border-b border-neutral-50 transition-colors hover:bg-amber-50/60 ${
                    gewaehlt === p.id ? "bg-amber-50" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-neutral-500">
                    {p.nummer ?? `#${p.id}`}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{p.titel}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{p.patient?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums text-neutral-700">
                    {"summeBrutto" in p ? `${geld(String(p.summeBrutto))} €` : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={p.status === "finalisiert" ? "border-amber-300 text-amber-800" : ""}>
                      {p.status === "finalisiert" ? "final" : "Entwurf"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Detail-Paneel ── */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          {gewaehlt === null ? (
            <p className="py-10 text-center text-sm text-neutral-400">
              Zeile anklicken für Vorschau & Aktionen.
            </p>
          ) : detail.isLoading ? (
            <p className="text-sm text-neutral-500">Lade …</p>
          ) : detail.isError || !detail.data ? (
            <p className="text-sm text-red-600">{detail.error?.message ?? "Fehler"}</p>
          ) : (
            (() => {
              const p = detail.data;
              const diagnosen = p.diagnosenJson ? JSON.parse(p.diagnosenJson) : [];
              return (
                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base font-semibold">{p.titel}</h2>
                      <Badge variant="outline" className={p.status === "finalisiert" ? "border-amber-300 text-amber-800" : ""}>
                        {p.status === "finalisiert" ? `final ${p.nummer}` : "Entwurf"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-neutral-400">
                      {p.patient?.name} · {p.nummer ?? `Entwurf #${p.id}`} · erstellt {new Date(p.createdAt).toLocaleDateString("de-DE")}
                      {(p.zeitraumVon || p.zeitraumBis) && ` · Zeitraum ${datum(p.zeitraumVon)}–${datum(p.zeitraumBis)}`}
                    </div>
                  </div>

                  {diagnosen.length > 0 && (
                    <div>
                      <h3 className="mb-1 text-xs font-medium text-neutral-500">Diagnosen (ICD-10)</h3>
                      <div className="space-y-1">
                        {diagnosen.map((d: DiagZeile) => (
                          <div key={d.code} className="text-sm">
                            <span className="font-mono font-semibold">{d.code}</span> — {d.text}
                            {d.kurzbegruendung && <div className="text-xs italic text-neutral-400">{d.kurzbegruendung}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {p.begruendung && (
                    <div>
                      <h3 className="mb-1 text-xs font-medium text-neutral-500">Begründung</h3>
                      <p className="whitespace-pre-line text-sm text-neutral-700">{p.begruendung}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-1 text-xs font-medium text-neutral-500">
                      Positionen ({p.positionen.length})
                    </h3>
                    <div className="divide-y divide-neutral-100 rounded-md border border-neutral-100">
                      {p.positionen.map((x) => (
                        <div key={x.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                          <div className="min-w-0">
                            <span className="font-medium">{x.bezeichnung}</span>
                            {x.gruppe && <span className="ml-2 text-xs text-neutral-400">{x.gruppe}</span>}
                            {x.goaeText && <span className="ml-2 text-xs text-neutral-400">{x.goaeText}</span>}
                          </div>
                          <span className="shrink-0 tabular-nums text-neutral-600">
                            {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(Number(x.menge))} × {geld(x.einzelpreis)} €
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {p.klartextNote && (
                    <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">{p.klartextNote}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-3">
                    <Button variant="outline" size="sm" onClick={() => herunterladen(p.id, "pdf")}>
                      <FileDown className="mr-1 h-4 w-4" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => herunterladen(p.id, "docx")}>
                      <FileText className="mr-1 h-4 w-4" /> Word
                    </Button>
                    {p.status === "entwurf" ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => ladenZumBearbeiten(p.id)}>
                          <Pencil className="mr-1 h-4 w-4" /> Bearbeiten
                        </Button>
                        <Button
                          size="sm" className="bg-amber-700 hover:bg-amber-800"
                          onClick={() => window.confirm("Kostenplan finalisieren? Er wird unveränderbar, bekommt eine HKP-Nummer und liegt als PDF in der Akte.") && finalisieren.mutate({ id: p.id })}
                        >
                          <Lock className="mr-1 h-4 w-4" /> Finalisieren
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setLoescheId(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => duplizieren.mutate({ id: p.id })}>
                        <Copy className="mr-1 h-4 w-4" /> Als Vorlage duplizieren
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* ── Editor-Dialog (unverändert aus 1.25.0) ── */}
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === "neu" ? "Kostenplan erstellen" : "Kostenplan bearbeiten (Entwurf)"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient *</Label>
              {form.patientId ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-medium">{form.patientName}</span>
                  {dialog === "neu" && (
                    <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, patientId: null, patientName: "" })}>
                      <X className="mr-1 h-3.5 w-3.5" /> ändern
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Input autoFocus placeholder="Name eingeben …" value={suche} onChange={(e) => setSuche(e.target.value)} />
                  <div className="mt-1 max-h-40 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-100">
                    {(patienten.data ?? []).slice(0, 6).map((p) => (
                      <button key={p.id} className="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm hover:bg-amber-50"
                        onClick={() => { setForm({ ...form, patientId: p.id, patientName: p.name }); setSuche(""); }}>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-neutral-400">{p.plz} {p.ort}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label>Titel</Label>
                <Input value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} />
              </div>
              <div>
                <Label>Zeitraum von</Label>
                <Input type="date" value={form.zeitraumVon} onChange={(e) => setForm({ ...form, zeitraumVon: e.target.value })} />
              </div>
              <div>
                <Label>bis</Label>
                <Input type="date" value={form.zeitraumBis} onChange={(e) => setForm({ ...form, zeitraumBis: e.target.value })} />
              </div>
            </div>

            <div className="rounded-md border border-neutral-200 p-3">
              <h4 className="text-sm font-medium">Diagnosen (ICD-10) mit Kurzbegründung</h4>
              {form.diagnosen.map((d, i) => (
                <div key={i} className="mt-2 flex flex-wrap items-center gap-2 rounded bg-amber-50 px-2 py-1.5 text-xs">
                  <span className="font-mono font-semibold">{d.code}</span>
                  <span className="flex-1">{d.text}</span>
                  <Input
                    className="h-7 flex-[2] text-xs"
                    placeholder="Kurzbegründung (optional)"
                    value={d.kurzbegruendung}
                    onChange={(e) => setForm({ ...form, diagnosen: form.diagnosen.map((x, j) => (j === i ? { ...x, kurzbegruendung: e.target.value } : x)) })}
                  />
                  <button type="button" className="text-red-500" onClick={() => setForm({ ...form, diagnosen: form.diagnosen.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
              <Input
                className="mt-2"
                placeholder="ICD-Code oder Krankheit suchen …"
                value={icdSucheText}
                onChange={(e) => setIcdSucheText(e.target.value)}
              />
              {(icdTreffer.data ?? []).length > 0 && (
                <div className="mt-1 max-h-40 divide-y divide-neutral-100 overflow-y-auto rounded border border-neutral-200">
                  {(icdTreffer.data ?? []).map((t) => (
                    <button key={t.code} type="button"
                      disabled={form.diagnosen.some((x) => x.code === t.code)}
                      onClick={() => { setForm({ ...form, diagnosen: [...form.diagnosen, { code: t.code, text: t.text, kurzbegruendung: "" }] }); setIcdSucheText(""); }}
                      className="flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs hover:bg-amber-50 disabled:opacity-40">
                      <span className="shrink-0 font-mono font-semibold">{t.code}</span><span>{t.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Pathophysiologische Begründung</Label>
              <Textarea rows={4} placeholder="Freitext — warum dieser Plan für diesen Patienten …" value={form.begruendung} onChange={(e) => setForm({ ...form, begruendung: e.target.value })} />
            </div>
            <div>
              <Label>KV-/Klärungs-Textbaustein (unten auf dem Dokument, optional)</Label>
              <Textarea rows={2} value={form.klartextNote} onChange={(e) => setForm({ ...form, klartextNote: e.target.value })} />
            </div>

            <div className="rounded-md border border-neutral-200 p-3">
              <h4 className="mb-2 text-sm font-medium">Kostenaufstellung (in Gruppen)</h4>
              <datalist id="kp-vorschlaege">
                {(produkte.data ?? []).map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
              {form.positionen.map((p, i) => (
                <div key={i} className="mb-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-500">Position {i + 1}</span>
                    {form.positionen.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 text-red-600"
                        onClick={() => setForm({ ...form, positionen: form.positionen.filter((_, j) => j !== i) })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Gruppe</Label>
                      <Input placeholder="z. B. Infusionen KW 41" value={p.gruppe} onChange={(e) => setPos(i, "gruppe", e.target.value)} />
                    </div>
                    <div className="col-span-4">
                      <Label className="text-xs">Bezeichnung *</Label>
                      <Input list="kp-vorschlaege" placeholder="Freitext oder Katalog-Vorschlag"
                        value={p.bezeichnung}
                        onChange={(e) => { setPos(i, "bezeichnung", e.target.value); produktWaehlen(i, e.target.value); }} />
                    </div>
                    <div>
                      <Label className="text-xs">Menge</Label>
                      <Input value={p.menge} onChange={(e) => setPos(i, "menge", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Einheit</Label>
                      <Input value={p.einheit} onChange={(e) => setPos(i, "einheit", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Preis (€)</Label>
                      <Input value={p.einzelpreis} onChange={(e) => setPos(i, "einzelpreis", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">USt %</Label>
                      <Input type="number" value={p.ustSatz} onChange={(e) => setPos(i, "ustSatz", Number(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">GOÄ-Einordnung (optional)</Label>
                      <Input placeholder="z. B. analog GOÄ 755" value={p.goaeText} onChange={(e) => setPos(i, "goaeText", e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Beschreibung (optional)</Label>
                      <Input value={p.beschreibung} onChange={(e) => setPos(i, "beschreibung", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm"
                onClick={() => setForm({ ...form, positionen: [...form.positionen, { ...leerePosition }] })}
                disabled={form.positionen.length >= 80}>
                <FilePlus2 className="mr-1 h-4 w-4" /> Weitere Position
              </Button>
            </div>

            {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button onClick={absenden} disabled={erstellen.isPending || aktualisieren.isPending}>
              {erstellen.isPending || aktualisieren.isPending ? "Speichere …" : dialog === "neu" ? "Entwurf anlegen" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={loescheId !== null} onOpenChange={(o) => !o && setLoescheId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entwurf löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Kostenplan-Entwurf wird entfernt. Finalisierte Pläne sind nicht löschbar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => loescheId && loeschen.mutate({ id: loescheId })}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
