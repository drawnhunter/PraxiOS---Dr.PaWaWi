// ── PraxiOS: Privat-Rezepte & Atteste (Tab in der Patientenakte) ───────────
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { pdfHerunterladen } from "@/lib/downloads";
import { REZEPT_TYP_LABEL } from "@contracts/rezepte";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, Plus, Trash2 } from "lucide-react";

interface MedZeile {
  name: string;
  staerke: string;
  menge: string;
  dosierung: string;
  pzn: string;
}

function isoNachDe(iso: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : undefined;
}

export function RezepteSection({ patientId }: { patientId: number }) {
  const utils = trpc.useUtils();
  const liste = trpc.rezepte.liste.useQuery({ patientId });
  const [dialog, setDialog] = useState<"rezept" | "attest" | null>(null);
  const [loescheId, setLoescheId] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // Katalog-Vorschläge für Verordnungen (eigene Produktliste, z. B. Infusionen)
  const produkte = trpc.products.list.useQuery(undefined, { enabled: dialog === "rezept" });

  // Rezept-Formular
  const [meds, setMeds] = useState<MedZeile[]>([{ name: "", staerke: "", menge: "", dosierung: "", pzn: "" }]);
  const [hinweis, setHinweis] = useState("");

  // Attest-Formular
  const [art, setArt] = useState<"krankschreibung" | "attest">("krankschreibung");
  const [auVon, setAuVon] = useState("");
  const [auBis, setAuBis] = useState("");
  const [attestText, setAttestText] = useState("");
  // v1.8.0: Feststellung + Ort + Diagnose/ICD
  const heuteIso = () => new Date().toISOString().slice(0, 10);
  const [festDatum, setFestDatum] = useState(heuteIso());
  const [erstbescheinigung, setErstbescheinigung] = useState(true);
  const [ortWahl, setOrtWahl] = useState("Praxis");
  const [ortFrei, setOrtFrei] = useState("");
  const [diagAusweisen, setDiagAusweisen] = useState(false);
  // v1.16.0: AU-Formular (Muster-1b-Gehalt)
  const [ausfertigung, setAusfertigung] = useState<"arbeitgeber" | "krankenkasse">("arbeitgeber");
  const [auFlags, setAuFlags] = useState({
    arbeitsunfall: false,
    durchgangsarzt: false,
    sonstigerUnfall: false,
    versorgungsleiden: false,
    reha: false,
    wiedereingliederung: false,
  });
  const [krankengeld, setKrankengeld] = useState<"" | "7woche" | "endbescheinigung">("");
  const [icdSucheText, setIcdSucheText] = useState("");
  const [icdGewaehlt, setIcdGewaehlt] = useState<{ code: string; text: string }[]>([]);
  const icdTreffer = trpc.rezepte.icdSuche.useQuery(
    { q: icdSucheText.trim() },
    { enabled: icdSucheText.trim().length >= 2 },
  );

  const erstellen = trpc.rezepte.erstellen.useMutation({
    onSuccess: () => {
      setFehler(null);
      setDialog(null);
      setMeds([{ name: "", staerke: "", menge: "", dosierung: "", pzn: "" }]);
      setHinweis("");
      setAttestText("");
      setAuVon("");
      setAuBis("");
      setFestDatum(heuteIso());
      setErstbescheinigung(true);
      setOrtWahl("Praxis");
      setOrtFrei("");
      setDiagAusweisen(false);
      setIcdGewaehlt([]);
      setIcdSucheText("");
      setAusfertigung("arbeitgeber");
      setAuFlags({ arbeitsunfall: false, durchgangsarzt: false, sonstigerUnfall: false, versorgungsleiden: false, reha: false, wiedereingliederung: false });
      setKrankengeld("");
      utils.rezepte.liste.invalidate({ patientId });
      utils.customers.get.invalidate({ id: patientId });
    },
    onError: (e) => setFehler(e.message),
  });

  const loeschen = trpc.rezepte.loeschen.useMutation({
    onSuccess: () => {
      setLoescheId(null);
      utils.rezepte.liste.invalidate({ patientId });
    },
  });

  const pdf = async (id: number, format: "a5" | "a4" = "a5") => {
    const r = await utils.rezepte.pdf.fetch({ id, format });
    pdfHerunterladen(r);
  };

  const rezeptAbsenden = () => {
    const medikamente = meds
      .filter((m) => m.name.trim())
      .map((m) => ({
        name: m.name.trim(),
        staerke: m.staerke.trim() || undefined,
        menge: m.menge.trim() || undefined,
        dosierung: m.dosierung.trim() || undefined,
        pzn: m.pzn.trim() || undefined,
      }));
    if (medikamente.length === 0) {
      setFehler("Mindestens ein Medikament angeben.");
      return;
    }
    erstellen.mutate({
      typ: "rezept",
      patientId,
      inhalt: { medikamente, hinweis: hinweis.trim() || undefined },
    });
  };

  const attestAbsenden = () => {
    erstellen.mutate({
      typ: "attest",
      patientId,
      inhalt: {
        art,
        auVon: art === "krankschreibung" ? isoNachDe(auVon) : undefined,
        auBis: art === "krankschreibung" ? isoNachDe(auBis) : undefined,
        text: attestText.trim(),
        feststellungsdatum: isoNachDe(festDatum),
        erstbescheinigung,
        feststellungsOrt: ortWahl === "anderer Ort" ? ortFrei.trim() || "Praxis" : ortWahl,
        diagnoseAusweisen: diagAusweisen,
        icdCodes: diagAusweisen && icdGewaehlt.length > 0 ? icdGewaehlt : undefined,
        // AU-Formular v2 (nur bei Krankschreibung relevant)
        ausfertigung: art === "krankschreibung" ? ausfertigung : undefined,
        arbeitsunfall: art === "krankschreibung" && auFlags.arbeitsunfall ? true : undefined,
        durchgangsarzt: art === "krankschreibung" && auFlags.durchgangsarzt ? true : undefined,
        sonstigerUnfall: art === "krankschreibung" && auFlags.sonstigerUnfall ? true : undefined,
        versorgungsleiden: art === "krankschreibung" && ausfertigung === "krankenkasse" && auFlags.versorgungsleiden ? true : undefined,
        reha: art === "krankschreibung" && ausfertigung === "krankenkasse" && auFlags.reha ? true : undefined,
        wiedereingliederung: art === "krankschreibung" && ausfertigung === "krankenkasse" && auFlags.wiedereingliederung ? true : undefined,
        krankengeld: art === "krankschreibung" && ausfertigung === "krankenkasse" && krankengeld ? krankengeld : undefined,
      },
    });
  };

  const setMed = (i: number, feld: keyof MedZeile, wert: string) =>
    setMeds(meds.map((m, j) => (j === i ? { ...m, [feld]: wert } : m)));

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-neutral-700">Rezepte &amp; Atteste</h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            Privatrezepte und Bescheinigungen erstellen — mit der hinterlegten
            Unterschrift (Einstellungen) auf dem PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setFehler(null); setDialog("rezept"); }}>
            <Plus className="mr-1 h-4 w-4" /> Privatrezept
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setFehler(null); setDialog("attest"); }}>
            <Plus className="mr-1 h-4 w-4" /> Attest / AU
          </Button>
        </div>
      </div>

      {(liste.data ?? []).length === 0 ? (
        <p className="text-sm text-neutral-400">Noch keine Rezepte oder Atteste erstellt.</p>
      ) : (
        <div className="divide-y divide-neutral-100">
          {(liste.data ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex items-center gap-3">
                <Badge variant="outline">{REZEPT_TYP_LABEL[r.typ]}</Badge>
                <div>
                  <div className="text-sm">
                    {new Date(r.createdAt).toLocaleDateString("de-DE")}
                    {r.ersteller?.name ? ` · ${r.ersteller.name}` : ""}
                  </div>
                  <div className="max-w-md truncate text-xs text-neutral-400">
                    {r.typ === "rezept"
                      ? (JSON.parse(r.inhalt) as { medikamente: { name: string }[] })
                          .medikamente.map((m) => m.name)
                          .join(", ")
                      : (JSON.parse(r.inhalt) as { art: string; text: string }).art ===
                          "krankschreibung"
                        ? "Arbeitsunfähigkeitsbescheinigung"
                        : "Ärztliches Attest"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <FileDown className="mr-1 h-4 w-4" /> PDF
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => pdf(r.id, "a5")}>
                      A5 — Rezeptpapier (Standard)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => pdf(r.id, "a4")}>
                      A4 — klassisches Blatt
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => setLoescheId(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Rezept-Dialog ── */}
      <Dialog open={dialog === "rezept"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Privatrezept erstellen</DialogTitle>
          </DialogHeader>
          <datalist id="med-vorschlaege">
            {(produkte.data ?? []).map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <div className="space-y-4">
            {meds.map((m, i) => (
              <div key={i} className="rounded-lg border border-neutral-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">
                    Verordnung {i + 1}
                  </span>
                  {meds.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-red-600"
                      onClick={() => setMeds(meds.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Label>Medikament / Wirkstoff *</Label>
                    <Input
                      list="med-vorschlaege"
                      placeholder="frei eingeben oder Katalog-Vorschlag wählen"
                      value={m.name}
                      onChange={(e) => setMed(i, "name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Stärke</Label>
                    <Input
                      placeholder="z. B. 600 mg"
                      value={m.staerke}
                      onChange={(e) => setMed(i, "staerke", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Menge / Packung</Label>
                    <Input
                      placeholder="z. B. 20 Tbl. / N1"
                      value={m.menge}
                      onChange={(e) => setMed(i, "menge", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>PZN (optional)</Label>
                    <Input
                      placeholder="z. B. 03029843"
                      value={m.pzn}
                      onChange={(e) => setMed(i, "pzn", e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Dosierung</Label>
                    <Input
                      placeholder="z. B. 3× täglich 1 Tablette"
                      value={m.dosierung}
                      onChange={(e) => setMed(i, "dosierung", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMeds([...meds, { name: "", staerke: "", menge: "", dosierung: "", pzn: "" }])}
              disabled={meds.length >= 10}
            >
              <Plus className="mr-1 h-4 w-4" /> Weitere Verordnung
            </Button>
            <div>
              <Label>Hinweis (optional)</Label>
              <Textarea rows={2} value={hinweis} onChange={(e) => setHinweis(e.target.value)} />
            </div>
            {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button onClick={rezeptAbsenden} disabled={erstellen.isPending}>
              {erstellen.isPending ? "Erstelle …" : "PDF erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Attest-Dialog ── */}
      <Dialog open={dialog === "attest"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attest / Krankschreibung erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Art</Label>
              <Select value={art} onValueChange={(v) => setArt(v as typeof art)}>
                <SelectTrigger className="w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="krankschreibung">Arbeitsunfähigkeitsbescheinigung</SelectItem>
                  <SelectItem value="attest">Ärztliches Attest (frei)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {art === "krankschreibung" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Arbeitsunfähig ab</Label>
                  <Input type="date" value={auVon} onChange={(e) => setAuVon(e.target.value)} />
                </div>
                <div>
                  <Label>… bis einschließlich</Label>
                  <Input type="date" value={auBis} onChange={(e) => setAuBis(e.target.value)} />
                </div>
              </div>
            )}

            {/* ── AU-Formular v2: Ausfertigung + Markierungen (1.16.0) ── */}
            {art === "krankschreibung" && (
              <div className="rounded-md border border-neutral-200 p-3">
                <Label>Ausfertigung</Label>
                <div className="mt-1 flex gap-1 rounded-md bg-neutral-100 p-0.5 text-xs">
                  {(["arbeitgeber", "krankenkasse"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAusfertigung(a)}
                      className={`flex-1 rounded px-2 py-1.5 transition-colors ${
                        ausfertigung === a ? "bg-white font-medium shadow-sm" : "text-neutral-500"
                      }`}
                    >
                      {a === "arbeitgeber" ? "Arbeitgeber (ohne Diagnose)" : "Krankenkasse (mit ICD)"}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                  {(
                    [
                      ["arbeitsunfall", "Arbeitsunfall / Berufskrankheit"],
                      ["durchgangsarzt", "dem Durchgangsarzt zugewiesen"],
                      ["sonstigerUnfall", "sonstiger Unfall / Unfallfolgen"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#0F766E]"
                        checked={auFlags[key]}
                        onChange={(e) => setAuFlags({ ...auFlags, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {ausfertigung === "krankenkasse" && (
                  <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                    <div className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                      {(
                        [
                          ["versorgungsleiden", "Versorgungsleiden (z. B. BVG)"],
                          ["reha", "Reha erforderlich"],
                          ["wiedereingliederung", "stufenweise Wiedereingliederung"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#0F766E]"
                            checked={auFlags[key]}
                            onChange={(e) => setAuFlags({ ...auFlags, [key]: e.target.checked })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div>
                      <Label className="text-xs">Krankengeld-Markierung (optional)</Label>
                      <Select value={krankengeld} onValueChange={(v) => setKrankengeld(v as typeof krankengeld)}>
                        <SelectTrigger className="w-72">
                          <SelectValue placeholder="keine" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7woche">ab 7. AU-Woche / sonstiger Krankengeldfall</SelectItem>
                          <SelectItem value="endbescheinigung">Endbescheinigung</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Feststellung: Datum, Erst/Folge, Ort ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Festgestellt am</Label>
                <Input type="date" value={festDatum} onChange={(e) => setFestDatum(e.target.value)} />
              </div>
              {art === "krankschreibung" ? (
                <div>
                  <Label>Bescheinigung</Label>
                  <div className="flex gap-1 rounded-md bg-neutral-100 p-0.5 text-xs">
                    {([true, false] as const).map((erst) => (
                      <button
                        key={String(erst)}
                        type="button"
                        onClick={() => setErstbescheinigung(erst)}
                        className={`flex-1 rounded px-2 py-1.5 transition-colors ${
                          erstbescheinigung === erst ? "bg-white font-medium shadow-sm" : "text-neutral-500"
                        }`}
                      >
                        {erst ? "Erstbescheinigung" : "Folgebescheinigung"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Ort der Feststellung</Label>
                  <Select value={ortWahl} onValueChange={setOrtWahl}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Praxis">Praxis</SelectItem>
                      <SelectItem value="Hausbesuch">Hausbesuch</SelectItem>
                      <SelectItem value="Videosprechstunde">Videosprechstunde</SelectItem>
                      <SelectItem value="anderer Ort">Anderer Ort …</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {art === "krankschreibung" && (
              <div>
                <Label>Ort der Feststellung</Label>
                <Select value={ortWahl} onValueChange={setOrtWahl}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Praxis">Praxis</SelectItem>
                    <SelectItem value="Hausbesuch">Hausbesuch</SelectItem>
                    <SelectItem value="Videosprechstunde">Videosprechstunde</SelectItem>
                    <SelectItem value="anderer Ort">Anderer Ort …</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {ortWahl === "anderer Ort" && (
              <div>
                <Label>Ort (Freitext)</Label>
                <Input
                  placeholder="z. B. Praxis am Wohnort des Arztes, unterwegs …"
                  value={ortFrei}
                  onChange={(e) => setOrtFrei(e.target.value)}
                />
              </div>
            )}

            {/* ── Diagnose / ICD-10 (optional — Arbeitgeber-Exemplar-Regel) ── */}
            <div className="rounded-md border border-neutral-200 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#0F766E]"
                  checked={diagAusweisen}
                  onChange={(e) => setDiagAusweisen(e.target.checked)}
                />
                Diagnose mit ICD-10-Code auf dem Attest ausweisen
              </label>
              {!diagAusweisen && (
                <p className="mt-1 text-xs text-neutral-400">
                  Standard: keine Diagnose auf dem Attest (Arbeitgeber-Exemplar-Regel).
                </p>
              )}
              {diagAusweisen && (
                <div className="mt-2 space-y-2">
                  {icdGewaehlt.map((c) => (
                    <div
                      key={c.code}
                      className="flex items-center justify-between gap-2 rounded bg-teal-50 px-2 py-1 text-xs"
                    >
                      <span>
                        <span className="font-mono font-semibold">{c.code}</span> — {c.text}
                      </span>
                      <button
                        type="button"
                        className="text-red-500"
                        onClick={() => setIcdGewaehlt(icdGewaehlt.filter((x) => x.code !== c.code))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <Input
                    placeholder="ICD-Code oder Krankheit suchen (z. B. J06 oder Durchfall) …"
                    value={icdSucheText}
                    onChange={(e) => setIcdSucheText(e.target.value)}
                  />
                  {(icdTreffer.data ?? []).length > 0 && (
                    <div className="max-h-44 overflow-y-auto rounded border border-neutral-200">
                      {(icdTreffer.data ?? []).map((t) => (
                        <button
                          key={t.code}
                          type="button"
                          disabled={icdGewaehlt.some((x) => x.code === t.code)}
                          onClick={() => {
                            setIcdGewaehlt([...icdGewaehlt, t]);
                            setIcdSucheText("");
                          }}
                          className="flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs hover:bg-teal-50 disabled:opacity-40"
                        >
                          <span className="shrink-0 font-mono font-semibold">{t.code}</span>
                          <span>{t.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {icdSucheText.trim().length >= 2 && icdTreffer.data && icdTreffer.data.length === 0 && (
                    <p className="text-xs text-neutral-400">Kein Treffer im ICD-10-GM-Katalog.</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>
                {art === "krankschreibung" ? "Zusatztext (optional)" : "Bescheinigungstext"}
              </Label>
              <Textarea
                rows={4}
                placeholder={
                  art === "krankschreibung"
                    ? "z. B. Hinweise zur Wiedereingliederung …"
                    : "z. B. … ist zur Teilnahme an … uneingeschränkt geeignet."
                }
                value={attestText}
                onChange={(e) => setAttestText(e.target.value)}
              />
            </div>
            {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button onClick={attestAbsenden} disabled={erstellen.isPending}>
              {erstellen.isPending ? "Erstelle …" : "PDF erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Löschen bestätigen ── */}
      <AlertDialog open={loescheId !== null} onOpenChange={(o) => !o && setLoescheId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das PDF wird aus der Akte entfernt. Die Löschung wird im
              Löschprotokoll festgehalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => loescheId && loeschen.mutate({ id: loescheId })}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
