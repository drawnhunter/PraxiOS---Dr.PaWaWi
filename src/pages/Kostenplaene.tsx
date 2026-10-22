// ── PraxiOS: Kostenvoranschläge — Register (1.27.0, Bus #179) ─────────────────────
// 1:1 wie Rechnungen: Tabelle voller Breite; Klick auf NUMMER → Detail-Seite
// (/kostenplaene/:id); Klick auf die Zeile → Side-Menü mit Aktionen rechts.
import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { pdfHerunterladen } from "@/lib/downloads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { KostenplanEditorDialog } from "@/components/KostenplanEditor";
import { KostenplanVorschauButton } from "@/components/KostenplanVorschauButton";
import {
  Copy,
  FileDown,
  FileText,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

const geld = (v: number | string) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));

export default function Kostenplaene() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const liste = trpc.kostenplaene.liste.useQuery();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [seitenmenueId, setSeitenmenueId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<"neu" | number | null>(null);
  const [loescheId, setLoescheId] = useState<number | null>(null);

  const neuLaden = () => utils.kostenplaene.liste.invalidate();
  const finalisieren = trpc.kostenplaene.finalisieren.useMutation({ onSuccess: () => { setSeitenmenueId(null); neuLaden(); } });
  const duplizieren = trpc.kostenplaene.duplizieren.useMutation({ onSuccess: (r) => { setSeitenmenueId(null); neuLaden(); navigate(`/kostenplaene/${r.id}`); } });
  const loeschen = trpc.kostenplaene.loeschen.useMutation({
    onSuccess: () => { setLoescheId(null); setSeitenmenueId(null); neuLaden(); },
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

  const herunterladen = async (id: number, art: "pdf" | "docx") => {
    const r = art === "pdf"
      ? await utils.kostenplaene.pdf.fetch({ id })
      : await utils.kostenplaene.docx.fetch({ id });
    pdfHerunterladen({ dateiname: r.dateiname, base64: r.base64 });
  };

  const gewaehlterPlan = (liste.data ?? []).find((p) => p.id === seitenmenueId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <FileText className="h-5 w-5 text-amber-700" /> Kostenvoranschläge
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Kostenvoranschläge und Heil- und Kostenvoranschläge erstellen und verwalten.
            Nummer anklicken öffnet die Akte — Zeile anklicken öffnet die Aktionen.
          </p>
        </div>
        <Button onClick={() => setDialog("neu")}>
          <Plus className="mr-1.5 h-4 w-4" /> Kostenvoranschlag erstellen
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

      {/* Tabelle voller Breite */}
      <div className="rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
              <th className="px-3 py-2.5 font-medium">Nummer</th>
              <th className="px-3 py-2.5 font-medium">Titel</th>
              <th className="px-3 py-2.5 font-medium">Patient</th>
              <th className="px-3 py-2.5 font-medium">Zeitraum</th>
              <th className="px-3 py-2.5 font-medium">Erstellt</th>
              <th className="px-3 py-2.5 font-medium text-right">Summe</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-neutral-400">
                  {(liste.data ?? []).length === 0
                    ? "Noch keine Kostenvoranschläge. Der erste fängt alles an."
                    : "Kein Treffer für Suche/Filter."}
                </td>
              </tr>
            )}
            {gefiltert.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSeitenmenueId(p.id)}
                className={`cursor-pointer border-b border-neutral-50 transition-colors hover:bg-amber-50/60 ${
                  seitenmenueId === p.id ? "bg-amber-50" : ""
                }`}
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="font-mono text-xs text-amber-800 underline decoration-amber-300 underline-offset-2 hover:text-amber-900"
                    onClick={() => navigate(`/kostenplaene/${p.id}`)}
                  >
                    {p.nummer ?? `#${p.id}`}
                  </button>
                </td>
                <td className="px-3 py-2.5 font-medium">{p.titel}</td>
                <td className="px-3 py-2.5 text-neutral-600">{p.patient?.name ?? "—"}</td>
                <td className="px-3 py-2.5 text-xs text-neutral-500">
                  {p.zeitraumVon ? `${datum(p.zeitraumVon)}${p.zeitraumBis ? `–${datum(p.zeitraumBis)}` : ""}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-neutral-500">
                  {new Date(p.createdAt).toLocaleDateString("de-DE")}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">
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

      {/* ── Side-Menü mit Aktionen (Zeilen-Klick) ── */}
      <Sheet open={seitenmenueId !== null} onOpenChange={(o) => !o && setSeitenmenueId(null)}>
        <SheetContent className="w-[320px]">
          <SheetHeader>
            <SheetTitle>{gewaehlterPlan?.titel ?? "Kostenplan"}</SheetTitle>
          </SheetHeader>
          {gewaehlterPlan && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-neutral-500">
                {gewaehlterPlan.patient?.name} · {gewaehlterPlan.nummer ?? `Entwurf #${gewaehlterPlan.id}`} ·{" "}
                {gewaehlterPlan.status === "finalisiert" ? "finalisiert" : "Entwurf"}
              </p>
              <Button className="w-full" variant="outline"
                onClick={() => { setSeitenmenueId(null); navigate(`/kostenplaene/${gewaehlterPlan.id}`); }}>
                <FileText className="mr-1 h-4 w-4" /> Öffnen (Detail)
              </Button>
              <div className="w-full">
                <KostenplanVorschauButton id={gewaehlterPlan.id} titel={gewaehlterPlan.titel} />
              </div>
              <Button className="w-full" variant="outline" onClick={() => herunterladen(gewaehlterPlan.id, "pdf")}>
                <FileDown className="mr-1 h-4 w-4" /> PDF herunterladen
              </Button>
              {gewaehlterPlan.status === "entwurf" ? (
                <>
                  <Button className="w-full" variant="outline"
                    onClick={() => { setDialog(gewaehlterPlan.id); }}>
                    <Pencil className="mr-1 h-4 w-4" /> Bearbeiten
                  </Button>
                  <Button className="w-full bg-amber-700 hover:bg-amber-800"
                    onClick={() => window.confirm("Kostenplan finalisieren? Er wird unveränderbar, bekommt eine HKP-Nummer und liegt als PDF in der Akte.") && finalisieren.mutate({ id: gewaehlterPlan.id })}>
                    <Lock className="mr-1 h-4 w-4" /> Finalisieren
                  </Button>
                  <Button className="w-full" variant="ghost"
                    onClick={() => { setLoescheId(gewaehlterPlan.id); }}>
                    <Trash2 className="mr-1 h-4 w-4 text-red-600" /> <span className="text-red-600">Löschen</span>
                  </Button>
                </>
              ) : (
                <Button className="w-full" variant="outline" onClick={() => duplizieren.mutate({ id: gewaehlterPlan.id })}>
                  <Copy className="mr-1 h-4 w-4" /> Als Vorlage duplizieren
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Editor-Dialog (Typ-Wahl + Felder — ausgelagerte Komponente) */}
      <KostenplanEditorDialog
        offen={dialog}
        onSchliessen={() => setDialog(null)}
        onGespeichert={(neueId) => { setDialog(null); neuLaden(); if (neueId) navigate(`/kostenplaene/${neueId}`); }}
      />

      {/* Löschen bestätigen */}
      {loescheId !== null && (
        <ConfirmLoeschen
          onJa={() => loeschen.mutate({ id: loescheId })}
          onNein={() => setLoescheId(null)}
        />
      )}
    </div>
  );
}

function ConfirmLoeschen({ onJa, onNein }: { onJa: () => void; onNein: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold">Entwurf löschen?</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Der Kostenplan-Entwurf wird entfernt. Finalisierte Pläne sind nicht löschbar.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onNein}>Abbrechen</Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={onJa}>Löschen</Button>
        </div>
      </div>
    </div>
  );
}
