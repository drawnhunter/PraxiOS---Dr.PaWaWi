// ── PraxiOS: Einzelnes Behandlungsprotokoll (Editor) ───────────────────────
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import type { ProtokollBlock } from "@contracts/protokolle";
import { ProtokollBloeckeEditor } from "@/components/ProtokollBloeckeEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, BookMarked, Lock, Trash2 } from "lucide-react";

export default function ProtokollDetail() {
  const { id } = useParams<{ id: string }>();
  const protokollId = Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const abfrage = trpc.protokolle.byId.useQuery({ id: protokollId });

  const [titel, setTitel] = useState("");
  const [bloecke, setBloecke] = useState<ProtokollBlock[]>([]);
  const [nachtrag, setNachtrag] = useState("");
  const [loeschDialog, setLoeschDialog] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (abfrage.data) {
      setTitel(abfrage.data.titel);
      setBloecke(abfrage.data.bloecke);
    }
  }, [abfrage.data]);

  const inval = () => utils.protokolle.byId.invalidate({ id: protokollId });
  const speichern = trpc.protokolle.aktualisieren.useMutation({
    onSuccess: () => {
      setFehler(null);
      inval();
    },
    onError: (e) => setFehler(e.message),
  });
  const nachtragen = trpc.protokolle.nachtrag.useMutation({
    onSuccess: () => {
      setNachtrag("");
      inval();
    },
    onError: (e) => setFehler(e.message),
  });
  const loeschen = trpc.protokolle.loeschen.useMutation({
    onSuccess: () => navigate("/protokolle"),
    onError: (e) => setFehler(e.message),
  });
  const alsVorlage = trpc.protokolle.vorlageSpeichern.useMutation({
    onSuccess: () => {
      utils.protokolle.vorlagen.invalidate();
      zeigeOk("Als Vorlage gespeichert — ab sofort beim Anlegen wählbar.");
    },
    onError: (e) => setFehler(e.message),
  });
  const [ok, setOk] = useState<string | null>(null);
  const zeigeOk = (t: string) => {
    setOk(t);
    setTimeout(() => setOk(null), 3500);
  };

  if (abfrage.isLoading || !abfrage.data) return <p className="text-sm text-neutral-500">Lade …</p>;
  const p = abfrage.data;
  const gesperrt = p.gesperrt;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/protokolle")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Protokoll: {p.titel}
            </h1>
            <p className="text-sm text-neutral-500">
              <Link to={`/patienten/${p.patient.id}`} className="text-teal-700 hover:underline">
                {p.patient.name}
              </Link>{" "}
              · {new Date(p.createdAt).toLocaleDateString("de-DE")}
              {p.ersteller?.name ? ` · ${p.ersteller.name}` : ""}
              {p.vorlage ? ` · Vorlage: ${p.vorlage.titel}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {gesperrt && (
            <Badge variant="outline" className="border-amber-300 text-amber-700">
              <Lock className="mr-1 h-3 w-3" /> Gesperrt (48-h-Fenster)
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={bloecke.length === 0}
            title="Struktur (ohne Inhalte) als wiederverwendbare Vorlage speichern"
            onClick={() => {
              const name = window.prompt("Titel der Vorlage:", `${titel} (Vorlage)`);
              if (name?.trim()) {
                alsVorlage.mutate({ titel: name.trim(), bloecke });
              }
            }}
          >
            <BookMarked className="mr-1 h-4 w-4" /> Als Vorlage speichern
          </Button>
          {!gesperrt && (
            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setLoeschDialog(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {gesperrt && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Dieses Protokoll ist älter als 48 h und damit medizinisch gesperrt.
          Korrekturen bitte als Nachtrag unten ergänzen.
        </div>
      )}
      {ok && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
          {ok}
        </div>
      )}
      {fehler && <p className="mb-4 text-sm text-red-600">{fehler}</p>}

      {!gesperrt && (
        <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
          <Label>Titel des Protokolls</Label>
          <Input value={titel} onChange={(e) => setTitel(e.target.value)} />
        </div>
      )}

      <ProtokollBloeckeEditor
        bloecke={bloecke}
        onChange={setBloecke}
        patientId={p.patient.id}
        gesperrt={gesperrt}
      />

      {!gesperrt && (
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            disabled={speichern.isPending || !titel.trim()}
            onClick={() => speichern.mutate({ id: protokollId, titel: titel.trim(), bloecke })}
          >
            {speichern.isPending ? "Speichere …" : "Protokoll speichern"}
          </Button>
        </div>
      )}

      {/* ── Nachträge (immer möglich, append-only) ── */}
      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-700">Nachträge</h2>
        {p.nachtraegeListe.length === 0 && (
          <p className="text-sm text-neutral-400">Keine Nachträge vorhanden.</p>
        )}
        <div className="space-y-2">
          {p.nachtraegeListe.map((n, i) => (
            <div key={i} className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2">
              <div className="text-xs text-neutral-500">
                {new Date(n.createdAt).toLocaleString("de-DE")} · {n.autorName}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap text-sm">{n.text}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2">
          <Textarea
            rows={2}
            placeholder="Nachtrag hinzufügen (wird mit Zeit + Name festgehalten) …"
            value={nachtrag}
            onChange={(e) => setNachtrag(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={!nachtrag.trim() || nachtragen.isPending}
            onClick={() => nachtragen.mutate({ id: protokollId, text: nachtrag.trim() })}
          >
            Hinzufügen
          </Button>
        </div>
      </section>

      {/* ── Löschen bestätigen ── */}
      <AlertDialog open={loeschDialog} onOpenChange={setLoeschDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Protokoll löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Nur innerhalb des 48-h-Fensters möglich. Die Löschung wird im
              Löschprotokoll festgehalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => loeschen.mutate({ id: protokollId })}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
