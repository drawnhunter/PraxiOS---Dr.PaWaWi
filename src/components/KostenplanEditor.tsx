// ── PraxiOS: Kostenplan-Editor (1.27.0) — Dialog mit Typ-Wahl ──────────────
// Beginn: zwei Buttons — „Kostenplan" (schlicht) | „Heil- und Kostenplan (HKP)"
// (HKP: ICD-Diagnosen + pathophysiologische Begründung oben).
import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FilePlus2, Trash2, X } from "lucide-react";

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
  art: "kostenplan" | "hkp";
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
const leerForm = (art: PlanForm["art"]): PlanForm => ({
  art,
  patientId: null, patientName: "",
  titel: art === "hkp" ? "Heil- und Kostenplan" : "Kostenplan",
  zeitraumVon: "", zeitraumBis: "", diagnosen: [], begruendung: "", klartextNote: "",
  positionen: [{ ...leerePosition }],
});

export function KostenplanEditorDialog({
  offen,
  onSchliessen,
  onGespeichert,
}: {
  offen: "neu" | number | null; // "neu" oder Plan-ID (bearbeiten)
  onSchliessen: () => void;
  onGespeichert: (neueId: number | null) => void;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<PlanForm>(leerForm("kostenplan"));
  const [suche, setSuche] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [icdSucheText, setIcdSucheText] = useState("");

  const patienten = trpc.customers.list.useQuery(
    { suche: suche.trim() || undefined },
    { enabled: offen !== null && form.patientId === null },
  );
  const produkte = trpc.products.list.useQuery(undefined, { enabled: offen !== null });
  const icdTreffer = trpc.rezepte.icdSuche.useQuery(
    { q: icdSucheText.trim() },
    { enabled: form.art === "hkp" && icdSucheText.trim().length >= 2 },
  );

  // Beim Öffnen zum Bearbeiten: Plan laden
  useEffect(() => {
    if (typeof offen === "number") {
      utils.kostenplaene.byId.fetch({ id: offen }).then((p) => {
        const diagnosen = p.diagnosenJson ? JSON.parse(p.diagnosenJson) : [];
        setForm({
          art: diagnosen.length > 0 || p.begruendung ? "hkp" : "kostenplan",
          patientId: p.patientId,
          patientName: p.patient?.name ?? "",
          titel: p.titel,
          zeitraumVon: p.zeitraumVon ?? "",
          zeitraumBis: p.zeitraumBis ?? "",
          diagnosen,
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
      }).catch((e) => setFehler(e instanceof Error ? e.message : String(e)));
    } else if (offen === "neu") {
      setForm(leerForm("kostenplan"));
      setFehler(null);
      setSuche("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  const erstellen = trpc.kostenplaene.erstellen.useMutation({
    onSuccess: (r) => onGespeichert(r.id),
    onError: (e) => setFehler(e.message),
  });
  const aktualisieren = trpc.kostenplaene.aktualisieren.useMutation({
    onSuccess: () => onGespeichert(typeof offen === "number" ? offen : null),
    onError: (e) => setFehler(e.message),
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
      titel: form.titel.trim() || (form.art === "hkp" ? "Heil- und Kostenplan" : "Kostenplan"),
      zeitraumVon: form.zeitraumVon || null,
      zeitraumBis: form.zeitraumBis || null,
      diagnosen: form.art === "hkp"
        ? form.diagnosen.map((d) => ({ code: d.code, text: d.text, kurzbegruendung: d.kurzbegruendung.trim() || undefined }))
        : [],
      begruendung: form.art === "hkp" ? form.begruendung.trim() : "",
      klartextNote: form.klartextNote.trim(),
      positionen,
    };
    if (offen === "neu") erstellen.mutate(payload);
    else if (typeof offen === "number") aktualisieren.mutate({ id: offen, ...payload });
  };

  return (
    <Dialog open={offen !== null} onOpenChange={(o) => !o && onSchliessen()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{offen === "neu" ? "Kostenplan erstellen" : "Kostenplan bearbeiten (Entwurf)"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Typ-Wahl (Bus #179): zwei Buttons zu Beginn */}
          <div className="flex gap-1 rounded-md bg-neutral-100 p-0.5 text-sm">
            {(
              [
                ["kostenplan", "Kostenplan"],
                ["hkp", "Heil- und Kostenplan (HKP)"],
              ] as const
            ).map(([a, label]) => (
              <button
                key={a}
                type="button"
                disabled={typeof offen === "number"}
                onClick={() => setForm({ ...form, art: a, titel: a === "hkp" ? "Heil- und Kostenplan" : "Kostenplan" })}
                className={`flex-1 rounded px-2 py-1.5 transition-colors ${
                  form.art === a ? "bg-white font-medium shadow-sm" : "text-neutral-500"
                } ${typeof offen === "number" ? "opacity-60" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
          {typeof offen === "number" && (
            <p className="text-xs text-neutral-400">Der Typ eines bestehenden Plans ist nicht wechselbar.</p>
          )}

          {/* Patient */}
          <div>
            <Label>Patient *</Label>
            {form.patientId ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="font-medium">{form.patientName}</span>
                {offen === "neu" && (
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

          {/* HKP-Sektionen: nur bei Typ HKP */}
          {form.art === "hkp" && (
            <>
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
            </>
          )}

          <div>
            <Label>KV-/Klärungs-Textbaustein (unten auf dem Dokument, optional)</Label>
            <Textarea rows={2} value={form.klartextNote} onChange={(e) => setForm({ ...form, klartextNote: e.target.value })} />
            <p className="mt-1 text-xs text-neutral-400">
              Am Ende steht immer die feste GOÄ/BGB-Fußnote — hier kommt nur dazu, was der Fall braucht.
            </p>
          </div>

          {/* Positionen */}
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
          <Button variant="outline" onClick={onSchliessen}>Abbrechen</Button>
          <Button onClick={absenden} disabled={erstellen.isPending || aktualisieren.isPending}>
            {erstellen.isPending || aktualisieren.isPending ? "Speichere …" : offen === "neu" ? "Entwurf anlegen" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
