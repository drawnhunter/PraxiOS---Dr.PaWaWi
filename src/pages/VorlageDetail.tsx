// ── PraxiOS: Protokoll-Vorlage anlegen/bearbeiten ──────────────────────────
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import type { ProtokollBlock } from "@contracts/protokolle";
import { ProtokollBloeckeEditor } from "@/components/ProtokollBloeckeEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";

export default function VorlageDetail() {
  const { id } = useParams<{ id: string }>();
  const vorlageId = id === "neu" ? null : Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const vorlagen = trpc.protokolle.vorlagen.useQuery(undefined, { enabled: vorlageId !== null });

  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [bloecke, setBloecke] = useState<ProtokollBlock[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (vorlageId !== null && vorlagen.data) {
      const v = vorlagen.data.find((x) => x.id === vorlageId);
      if (v) {
        setTitel(v.titel);
        setBeschreibung(v.beschreibung ?? "");
        setBloecke(v.bloecke);
      }
    }
  }, [vorlagen.data, vorlageId]);

  const speichern = trpc.protokolle.vorlageSpeichern.useMutation({
    onSuccess: () => {
      utils.protokolle.vorlagen.invalidate();
      navigate("/protokolle?tab=vorlagen");
    },
    onError: (e) => setFehler(e.message),
  });

  if (vorlageId !== null && (vorlagen.isLoading || !vorlagen.data)) {
    return <p className="text-sm text-neutral-500">Lade …</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/protokolle?tab=vorlagen")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          {vorlageId === null ? "Neue Vorlage" : "Vorlage bearbeiten"}
        </h1>
      </div>

      <div className="mb-4 space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <Label>Titel *</Label>
          <Input
            placeholder="z. B. Infusionsprotokoll, Wundkontrolle …"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
          />
        </div>
        <div>
          <Label>Beschreibung (optional)</Label>
          <Textarea
            rows={2}
            placeholder="Wofür wird diese Vorlage verwendet?"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          />
        </div>
        <p className="text-xs text-neutral-400">
          In Vorlagen wird nur die Struktur gepflegt (Titel, Spalten, Optionen) —
          Inhalte und Fotos entstehen erst im Protokoll des Patienten.
        </p>
      </div>

      {fehler && <p className="mb-4 text-sm text-red-600">{fehler}</p>}

      <ProtokollBloeckeEditor bloecke={bloecke} onChange={setBloecke} patientId={0} />

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/protokolle?tab=vorlagen")}>
          Abbrechen
        </Button>
        <Button
          disabled={speichern.isPending || !titel.trim()}
          onClick={() =>
            speichern.mutate({
              id: vorlageId ?? undefined,
              titel: titel.trim(),
              beschreibung: beschreibung.trim() || null,
              bloecke,
            })
          }
        >
          {speichern.isPending ? "Speichere …" : "Vorlage speichern"}
        </Button>
      </div>
    </div>
  );
}
