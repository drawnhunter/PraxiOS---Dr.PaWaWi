import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  BLOCK_TYPEN,
  BLOCK_TYP_LABEL,
  type BlockConfig,
  type BlockTyp,
  type FormBlock,
} from "@contracts/anamnese";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Plus, Trash2, Library } from "lucide-react";
import { FragenZellen } from "@/components/FragenZellen";

const STANDARD_CONFIG: Record<BlockTyp, BlockConfig> = {
  checkboxen: { fragen: [], spalten: 2 },
  textfeld: { frage: "" },
  textfeld_schreibfeld: { frage: "", zeilen: 4 },
  skala_1_10: { frage: "", vonLabel: "1 = schwach", bisLabel: "10 = stark" },
  haeufigkeit: { fragen: [] },
};

interface Props {
  offen: boolean;
  onOpenChange: (offen: boolean) => void;
  formId: number | null;
  onGespeichert: () => void;
}

export function BogenEditor({ offen, onOpenChange, formId, onGespeichert }: Props) {
  const utils = trpc.useUtils();
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [bloecke, setBloecke] = useState<FormBlock[]>([]);
  const [fehler, setFehler] = useState("");

  const bestehend = trpc.anamnese.byId.useQuery(
    { id: formId ?? 0 },
    { enabled: offen && formId !== null },
  );
  const katalog = trpc.anamnese.bloecke.useQuery(undefined, { enabled: offen });

  useEffect(() => {
    if (!offen) return;
    setFehler("");
    if (formId && bestehend.data) {
      setTitel(bestehend.data.titel);
      setBeschreibung(bestehend.data.beschreibung ?? "");
      setBloecke(bestehend.data.bloecke.map((b) => ({ ...b })));
    } else if (!formId) {
      setTitel("");
      setBeschreibung("");
      setBloecke([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen, formId, bestehend.data?.id]);

  const speichern = trpc.anamnese.create.useMutation({ onSuccess: nachErfolg });
  const aktualisieren = trpc.anamnese.update.useMutation({ onSuccess: nachErfolg });
  const blockAnlegen = trpc.anamnese.blockAnlegen.useMutation({
    onSuccess: () => utils.anamnese.bloecke.invalidate(),
  });
  function nachErfolg() {
    utils.anamnese.liste.invalidate();
    onGespeichert();
    onOpenChange(false);
  }

  const verschiebe = (i: number, richtung: -1 | 1) => {
    const ziel = i + richtung;
    if (ziel < 0 || ziel >= bloecke.length) return;
    const kopie = [...bloecke];
    [kopie[i], kopie[ziel]] = [kopie[ziel], kopie[i]];
    setBloecke(kopie);
  };

  const aktualisiereBlock = (i: number, teil: Partial<FormBlock>) => {
    setBloecke(bloecke.map((b, bi) => (bi === i ? { ...b, ...teil } : b)));
  };

  const absenden = () => {
    if (!titel.trim()) return setFehler("Titel fehlt.");
    if (bloecke.length === 0) return setFehler("Mindestens ein Block ist nötig.");
    // Leere Frage-Zellen vor dem Speichern entfernen
    const bereinigt = bloecke.map((b) =>
      b.typ === "checkboxen" || b.typ === "haeufigkeit"
        ? {
            ...b,
            config: {
              ...b.config,
              fragen: (b.config.fragen ?? []).map((s) => s.trim()).filter(Boolean),
            },
          }
        : b,
    );
    const unvollstaendig = bereinigt.find(
      (b) =>
        !b.titel.trim() ||
        (b.typ === "checkboxen" && !(b.config.fragen ?? []).length) ||
        (b.typ === "haeufigkeit" && !(b.config.fragen ?? []).length) ||
        ((b.typ === "textfeld" || b.typ === "textfeld_schreibfeld" || b.typ === "skala_1_10") &&
          !(b.config.frage ?? "").trim()),
    );
    if (unvollstaendig) return setFehler(`Block „${unvollstaendig.titel || "ohne Titel"}“ ist unvollständig.`);
    setFehler("");
    const daten = { titel: titel.trim(), beschreibung: beschreibung.trim() || null, schemaJson: bereinigt };
    if (formId) aktualisieren.mutate({ id: formId, data: daten });
    else speichern.mutate(daten);
  };

  const apiFehler = speichern.error ?? aktualisieren.error;

  return (
    <Dialog open={offen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formId ? "Bogen bearbeiten" : "Neuer Bogen"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Titel *</Label>
              <Input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Erstanamnese Integrative Medizin" />
            </div>
            <div>
              <Label>Beschreibung / Einleitungstext (erscheint auf dem Bogen)</Label>
              <Textarea rows={2} value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} />
            </div>
            <p className="rounded bg-[#F0FDFA] px-3 py-2 text-xs text-[#0B4F4A]">
              Der Kopfbogen „Persönliche Daten“ (Name, Geburtsdatum, Adresse …) ist
              bei jedem Bogen automatisch der erste Abschnitt — daraus wird die
              Patientenakte befüllt. Darunter kommen deine Blöcke.
            </p>
          </div>

          {/* Blöcke */}
          <div className="space-y-3">
            {bloecke.map((block, i) => (
              <div key={i} className="rounded-lg border border-neutral-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-500">
                    {i + 2} · {BLOCK_TYP_LABEL[block.typ]}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="sm" onClick={() => verschiebe(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => verschiebe(i, 1)} disabled={i === bloecke.length - 1}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Block im Katalog speichern"
                      onClick={() =>
                        blockAnlegen.mutate({ typ: block.typ, titel: block.titel, config: block.config })
                      }
                    >
                      <Library className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => setBloecke(bloecke.filter((_, bi) => bi !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {block.typ === "checkboxen" && (
                    <div>
                      <Label>Spalten</Label>
                      <Select
                        value={String(block.config.spalten ?? 2)}
                        onValueChange={(v) =>
                          aktualisiereBlock(i, {
                            config: { ...block.config, spalten: Number(v) as 1 | 2 },
                          })
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Spalte</SelectItem>
                          <SelectItem value="2">2 Spalten</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Label>Block-Titel *</Label>
                    <Input
                      value={block.titel}
                      onChange={(e) => aktualisiereBlock(i, { titel: e.target.value })}
                      placeholder="z. B. Beschwerden"
                    />
                  </div>
                  <BlockConfigEditor
                    block={block}
                    onChange={(config) => aktualisiereBlock(i, { config })}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Block hinzufügen */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
            <Select
              value=""
              onValueChange={(typ) => {
                if (!typ) return;
                setBloecke([
                  ...bloecke,
                  {
                    typ: typ as BlockTyp,
                    titel: BLOCK_TYP_LABEL[typ as BlockTyp],
                    config: { ...STANDARD_CONFIG[typ as BlockTyp] },
                  },
                ]);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Blocktyp wählen …" />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPEN.map((typ) => (
                  <SelectItem key={typ} value={typ}>
                    {BLOCK_TYP_LABEL[typ]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(katalog.data ?? []).length > 0 && (
              <Select
                value=""
                onValueChange={(id) => {
                  const b = (katalog.data ?? []).find((x) => String(x.id) === id);
                  if (!b) return;
                  setBloecke([
                    ...bloecke,
                    {
                      blockId: b.id,
                      typ: b.typ as BlockTyp,
                      titel: b.titel,
                      config: JSON.parse(b.config) as BlockConfig,
                    },
                  ]);
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="aus Block-Katalog …" />
                </SelectTrigger>
                <SelectContent>
                  {(katalog.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.titel} ({BLOCK_TYP_LABEL[b.typ as BlockTyp]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Plus className="h-4 w-4 text-neutral-400" />
          </div>
        </div>

        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
        {apiFehler && <p className="text-sm text-red-600">{apiFehler.message}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={absenden} disabled={speichern.isPending || aktualisieren.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockConfigEditor({
  block,
  onChange,
}: {
  block: FormBlock;
  onChange: (config: BlockConfig) => void;
}) {
  if (block.typ === "checkboxen") {
    // Zellen-Editor: jede Frage eine Eingabe-Zelle (Navigation per Pfeiltasten)
    return (
      <div className="sm:col-span-2">
        <Label>Fragen *</Label>
        <FragenZellen
          fragen={block.config.fragen ?? []}
          spalten={block.config.spalten ?? 2}
          onChange={(fragen) => onChange({ ...block.config, fragen })}
        />
      </div>
    );
  }
  if (block.typ === "haeufigkeit") {
    return (
      <div className="sm:col-span-2">
        <Label>Fragen (eine pro Zeile) *</Label>
        <Textarea
          rows={3}
          value={(block.config.fragen ?? []).join("\n")}
          onChange={(e) =>
            onChange({
              ...block.config,
              fragen: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      </div>
    );
  }
  if (block.typ === "textfeld" || block.typ === "textfeld_schreibfeld") {
    return (
      <>
        <div className="sm:col-span-2">
          <Label>Frage *</Label>
          <Input
            value={block.config.frage ?? ""}
            onChange={(e) => onChange({ ...block.config, frage: e.target.value })}
          />
        </div>
        {block.typ === "textfeld_schreibfeld" && (
          <div>
            <Label>Schreibzeilen</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={block.config.zeilen ?? 4}
              onChange={(e) =>
                onChange({ ...block.config, zeilen: Number(e.target.value) || 4 })
              }
            />
          </div>
        )}
      </>
    );
  }
  if (block.typ === "skala_1_10") {
    return (
      <>
        <div className="sm:col-span-2">
          <Label>Frage *</Label>
          <Input
            value={block.config.frage ?? ""}
            onChange={(e) => onChange({ ...block.config, frage: e.target.value })}
          />
        </div>
        <div>
          <Label>Label links (1)</Label>
          <Input
            value={block.config.vonLabel ?? ""}
            onChange={(e) => onChange({ ...block.config, vonLabel: e.target.value })}
          />
        </div>
        <div>
          <Label>Label rechts (10)</Label>
          <Input
            value={block.config.bisLabel ?? ""}
            onChange={(e) => onChange({ ...block.config, bisLabel: e.target.value })}
          />
        </div>
      </>
    );
  }
  return null;
}
