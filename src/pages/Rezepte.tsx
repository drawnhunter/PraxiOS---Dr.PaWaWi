// ── PraxiOS: Rezepte & Atteste (eigene Menü-Seite) ─────────────────────────
// Patient aussuchen → direkt Privatrezept oder Attest erstellen. Alternativ
// über die zuletzt erstellten Einträge wieder aufnehmen.
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { RezepteSection } from "@/components/RezepteSection";
import { REZEPT_TYP_LABEL } from "@contracts/rezepte";
import { pdfHerunterladen } from "@/lib/downloads";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileDown, FileSignature, Package, Plus, Trash2, X } from "lucide-react";

export default function Rezepte() {
  const [suche, setSuche] = useState("");
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientName, setPatientName] = useState<string>("");

  const treffer = trpc.customers.list.useQuery(
    { suche: suche.trim() || undefined },
    { enabled: patientId === null },
  );
  const letzte = trpc.rezepte.letzte.useQuery({ limit: 15 });

  const waehlen = (id: number, name: string) => {
    setPatientId(id);
    setPatientName(name);
    setSuche("");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Rezepte &amp; Atteste</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Patient aussuchen und direkt ein Privatrezept, eine Krankschreibung oder
          ein Attest erstellen — mit der hinterlegten Unterschrift auf dem PDF.
        </p>
      </div>

      {patientId === null ? (
        <div className="max-w-2xl">
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-medium text-neutral-700">
              1. Patient aussuchen
            </h2>
            <Input
              autoFocus
              placeholder="Name eingeben …"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
            <div className="mt-2 divide-y divide-neutral-100">
              {(treffer.data ?? []).slice(0, 8).map((k) => (
                <button
                  key={k.id}
                  className="flex w-full items-center justify-between px-2 py-2 text-left text-sm hover:bg-teal-50"
                  onClick={() => waehlen(k.id, k.name)}
                >
                  <span className="font-medium text-neutral-800">{k.name}</span>
                  <span className="text-xs text-neutral-400">
                    {k.plz} {k.ort}
                  </span>
                </button>
              ))}
              {suche.trim() && (treffer.data ?? []).length === 0 && (
                <p className="px-2 py-3 text-sm text-neutral-400">
                  Kein Patient gefunden — zuerst unter „Patienten" anlegen.
                </p>
              )}
              {!suche.trim() && (
                <p className="px-2 py-3 text-sm text-neutral-400">
                  Tippen, um im Patientenstamm zu suchen …
                </p>
              )}
            </div>
          </div>

          {(letzte.data ?? []).length > 0 && (
            <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-medium text-neutral-700">
                Zuletzt erstellt
              </h2>
              <div className="divide-y divide-neutral-100">
                {(letzte.data ?? []).map((r) => (
                  <button
                    key={r.id}
                    className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-teal-50"
                    onClick={() => r.patient && waehlen(r.patient.id, r.patient.name)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{REZEPT_TYP_LABEL[r.typ]}</Badge>
                      <span className="text-sm font-medium text-neutral-800">
                        {r.patient?.name ?? (r.typ === "praxisbedarf" ? "Zur Anwendung in der Praxis" : "—")}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-400">
                      {new Date(r.createdAt).toLocaleDateString("de-DE")}
                      {r.ersteller?.name ? ` · ${r.ersteller.name}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <FileSignature className="h-5 w-5 text-teal-700" />
            <span className="font-medium">{patientName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPatientId(null);
                setPatientName("");
              }}
            >
              <X className="mr-1 h-4 w-4" /> anderen Patienten wählen
            </Button>
          </div>
          <RezepteSection patientId={patientId} />
        </div>
      )}

      {/* ── Praxisbedarf: unabhängig vom gewählten Patienten immer erreichbar ── */}
      <PraxisbedarfSection />
    </div>
  );
}

// ── Praxisbedarf-Bestellung („zur Anwendung in der Praxis", 1.12.0) ─────────
// Bewusst OHNE Patient: die Bestellung geht an die Apotheke für den
// Praxisbedarf — kein Schein-Patient nötig.
interface BedarfZeile {
  name: string;
  staerke: string;
  menge: string;
  pzn: string;
}

function PraxisbedarfSection() {
  const utils = trpc.useUtils();
  const liste = trpc.rezepte.listePraxisbedarf.useQuery();
  const produkte = trpc.products.list.useQuery();
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeilen, setZeilen] = useState<BedarfZeile[]>([{ name: "", staerke: "", menge: "", pzn: "" }]);
  const [hinweis, setHinweis] = useState("");

  const erstellen = trpc.rezepte.erstellen.useMutation({
    onSuccess: () => {
      setOffen(false);
      setFehler(null);
      setZeilen([{ name: "", staerke: "", menge: "", pzn: "" }]);
      setHinweis("");
      utils.rezepte.listePraxisbedarf.invalidate();
      utils.rezepte.letzte.invalidate();
    },
    onError: (e) => setFehler(e.message),
  });
  const loeschen = trpc.rezepte.loeschen.useMutation({
    onSuccess: () => utils.rezepte.listePraxisbedarf.invalidate(),
  });

  const setZ = (i: number, feld: keyof BedarfZeile, wert: string) =>
    setZeilen(zeilen.map((z, j) => (j === i ? { ...z, [feld]: wert } : z)));

  const absenden = () => {
    const medikamente = zeilen
      .filter((z) => z.name.trim())
      .map((z) => ({
        name: z.name.trim(),
        staerke: z.staerke.trim() || undefined,
        menge: z.menge.trim() || undefined,
        pzn: z.pzn.trim() || undefined,
      }));
    if (medikamente.length === 0) {
      setFehler("Mindestens einen Artikel angeben.");
      return;
    }
    erstellen.mutate({
      typ: "praxisbedarf",
      inhalt: { medikamente, hinweis: hinweis.trim() || undefined },
    });
  };

  return (
    <div className="mt-8 max-w-2xl">
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              <Package className="h-4 w-4 text-teal-700" /> Praxisbedarf-Bestellung
            </h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              „Zur Anwendung in der Praxis" — ohne Patientenbezug, mit PZN für die Apotheke.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setFehler(null); setOffen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Bestellung
          </Button>
        </div>

        {(liste.data ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">Noch keine Praxisbedarf-Bestellungen erstellt.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {(liste.data ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <div className="text-sm">
                    {new Date(r.createdAt).toLocaleDateString("de-DE")}
                    {r.ersteller?.name ? ` · ${r.ersteller.name}` : ""}
                  </div>
                  <div className="max-w-md truncate text-xs text-neutral-400">
                    {(JSON.parse(r.inhalt) as { medikamente: { name: string }[] })
                      .medikamente.map((m) => m.name)
                      .join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const f = await utils.rezepte.pdf.fetch({ id: r.id, format: "a5" });
                      pdfHerunterladen(f);
                    }}
                  >
                    <FileDown className="mr-1 h-4 w-4" /> PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => loeschen.mutate({ id: r.id, grund: "Praxisbedarf-Bestellung verworfen" })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={offen} onOpenChange={(o) => !o && setOffen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Praxisbedarf-Bestellung erstellen</DialogTitle>
          </DialogHeader>
          <datalist id="bedarf-vorschlaege">
            {(produkte.data ?? []).map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <div className="space-y-4">
            {zeilen.map((z, i) => (
              <div key={i} className="rounded-lg border border-neutral-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">Artikel {i + 1}</span>
                  {zeilen.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-red-600"
                      onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Label>Medikament / Artikel *</Label>
                    <Input
                      list="bedarf-vorschlaege"
                      placeholder="frei eingeben oder Katalog-Vorschlag wählen"
                      value={z.name}
                      onChange={(e) => setZ(i, "name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Stärke</Label>
                    <Input
                      placeholder="z. B. 25.000 I.E."
                      value={z.staerke}
                      onChange={(e) => setZ(i, "staerke", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Menge / Packung</Label>
                    <Input
                      placeholder="z. B. 4 PCK (5×5 ml, N1)"
                      value={z.menge}
                      onChange={(e) => setZ(i, "menge", e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>PZN</Label>
                    <Input
                      placeholder="z. B. 03029843"
                      value={z.pzn}
                      onChange={(e) => setZ(i, "pzn", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZeilen([...zeilen, { name: "", staerke: "", menge: "", pzn: "" }])}
              disabled={zeilen.length >= 10}
            >
              <Plus className="mr-1 h-4 w-4" /> Weiterer Artikel
            </Button>
            <div>
              <Label>Hinweis (optional)</Label>
              <Textarea rows={2} value={hinweis} onChange={(e) => setHinweis(e.target.value)} />
            </div>
            {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button onClick={absenden} disabled={erstellen.isPending}>
              {erstellen.isPending ? "Erstelle …" : "PDF erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
