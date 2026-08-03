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
import { FileDown, Plus, Trash2 } from "lucide-react";

interface MedZeile {
  name: string;
  staerke: string;
  menge: string;
  dosierung: string;
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

  // Rezept-Formular
  const [meds, setMeds] = useState<MedZeile[]>([{ name: "", staerke: "", menge: "", dosierung: "" }]);
  const [hinweis, setHinweis] = useState("");

  // Attest-Formular
  const [art, setArt] = useState<"krankschreibung" | "attest">("krankschreibung");
  const [auVon, setAuVon] = useState("");
  const [auBis, setAuBis] = useState("");
  const [attestText, setAttestText] = useState("");

  const erstellen = trpc.rezepte.erstellen.useMutation({
    onSuccess: () => {
      setFehler(null);
      setDialog(null);
      setMeds([{ name: "", staerke: "", menge: "", dosierung: "" }]);
      setHinweis("");
      setAttestText("");
      setAuVon("");
      setAuBis("");
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

  const pdf = async (id: number) => {
    const r = await utils.rezepte.pdf.fetch({ id });
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
                <Button variant="ghost" size="sm" onClick={() => pdf(r.id)}>
                  <FileDown className="mr-1 h-4 w-4" /> PDF
                </Button>
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
                    <Input value={m.name} onChange={(e) => setMed(i, "name", e.target.value)} />
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
              onClick={() => setMeds([...meds, { name: "", staerke: "", menge: "", dosierung: "" }])}
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
