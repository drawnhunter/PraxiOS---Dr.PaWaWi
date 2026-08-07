// ── PraxiOS: Block-Editor für Behandlungsprotokolle & Vorlagen ─────────────
// Sechs Blocktypen: Text, Tabelle (+Diagramm), Skala, Foto, Vital, Ankreuz.
import { useRef } from "react";
import {
  BLOCK_TYP_LABEL,
  neueBlockId,
  type ProtokollBlock,
  type ProtokollBlockTyp,
} from "@contracts/protokolle";
import { ProtokollChart } from "@/components/ProtokollChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CheckSquare,
  Gauge,
  Table2,
  Trash2,
  Type,
} from "lucide-react";

interface Props {
  bloecke: ProtokollBlock[];
  onChange: (b: ProtokollBlock[]) => void;
  patientId: number;
  gesperrt?: boolean;
}

const ADD_BUTTONS: { typ: ProtokollBlockTyp; icon: typeof Type }[] = [
  { typ: "text", icon: Type },
  { typ: "tabelle", icon: Table2 },
  { typ: "skala", icon: Gauge },
  { typ: "foto", icon: Camera },
  { typ: "vital", icon: Gauge },
  { typ: "ankreuz", icon: CheckSquare },
];

function neuerBlock(typ: ProtokollBlockTyp): ProtokollBlock {
  const id = neueBlockId();
  switch (typ) {
    case "text":
      return { id, typ, titel: "Notiz", inhalt: "" };
    case "tabelle":
      return { id, typ, titel: "Verlauf", spalten: ["Zeit", "Wert 1"], zeilen: [["", ""]], diagramm: true };
    case "skala":
      return { id, typ, titel: "Schmerzskala", wert: null };
    case "foto":
      return { id, typ, titel: "Dokumentation", dokumentId: null };
    case "vital":
      return { id, typ, titel: "Vitalparameter", werte: {} };
    case "ankreuz":
      return { id, typ, titel: "Checkliste", optionen: [{ label: "Erledigt", gewaehlt: false }] };
  }
}

export function ProtokollBloeckeEditor({ bloecke, onChange, patientId, gesperrt }: Props) {
  const ersetzen = (id: string, neu: ProtokollBlock) =>
    onChange(bloecke.map((b) => (b.id === id ? neu : b)));
  const entfernen = (id: string) => {
    if (window.confirm("Block wirklich entfernen?")) onChange(bloecke.filter((b) => b.id !== id));
  };
  const bewegen = (id: string, richtung: -1 | 1) => {
    const i = bloecke.findIndex((b) => b.id === id);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= bloecke.length) return;
    const kopie = [...bloecke];
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    onChange(kopie);
  };

  return (
    <div className="space-y-4">
      {bloecke.map((block, i) => (
        <section
          key={block.id}
          className="rounded-lg border border-neutral-200 bg-white p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Badge variant="outline">{BLOCK_TYP_LABEL[block.typ]}</Badge>
            {!gesperrt && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => bewegen(block.id, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={i === bloecke.length - 1}
                  onClick={() => bewegen(block.id, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => entfernen(block.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          <BlockInhalt block={block} onChange={(n) => ersetzen(block.id, n)} patientId={patientId} gesperrt={gesperrt} />
        </section>
      ))}

      {bloecke.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-400">
          Noch keine Blöcke — unten einen Blocktyp hinzufügen.
        </p>
      )}

      {!gesperrt && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3">
          <span className="mr-1 text-xs font-medium text-neutral-500">Block hinzufügen:</span>
          {ADD_BUTTONS.map(({ typ, icon: Icon }) => (
            <Button
              key={typ}
              variant="outline"
              size="sm"
              onClick={() => onChange([...bloecke, neuerBlock(typ)])}
            >
              <Icon className="mr-1 h-3.5 w-3.5" /> {BLOCK_TYP_LABEL[typ]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inhalt je Blocktyp ──────────────────────────────────────────────────────
function BlockInhalt({
  block,
  onChange,
  patientId,
  gesperrt,
}: {
  block: ProtokollBlock;
  onChange: (b: ProtokollBlock) => void;
  patientId: number;
  gesperrt?: boolean;
}) {
  const dateiInput = useRef<HTMLInputElement>(null);
  const ro = gesperrt ? { disabled: true } : {};

  const titelZeile = (
    <div className="mb-2">
      <Label>Titel</Label>
      <Input value={block.titel} onChange={(e) => onChange({ ...block, titel: e.target.value })} {...ro} />
    </div>
  );

  switch (block.typ) {
    case "text":
      return (
        <div>
          {titelZeile}
          <Textarea
            rows={5}
            placeholder="Freitext …"
            value={block.inhalt}
            onChange={(e) => onChange({ ...block, inhalt: e.target.value })}
            {...ro}
          />
        </div>
      );

    case "tabelle": {
      const setSpalte = (i: number, name: string) =>
        onChange({ ...block, spalten: block.spalten.map((s, j) => (j === i ? name : s)) });
      const setZelle = (zi: number, si: number, wert: string) =>
        onChange({
          ...block,
          zeilen: block.zeilen.map((z, j) => (j === zi ? z.map((c, k) => (k === si ? wert : c)) : z)),
        });
      const spaltePlus = () =>
        onChange({
          ...block,
          spalten: [...block.spalten, `Wert ${block.spalten.length}`],
          zeilen: block.zeilen.map((z) => [...z, ""]),
        });
      const spalteMinus = () => {
        if (block.spalten.length <= 1) return;
        onChange({
          ...block,
          spalten: block.spalten.slice(0, -1),
          zeilen: block.zeilen.map((z) => z.slice(0, -1)),
        });
      };
      const zeilePlus = () => onChange({ ...block, zeilen: [...block.zeilen, block.spalten.map(() => "")] });
      const zeileWeg = (zi: number) =>
        onChange({ ...block, zeilen: block.zeilen.filter((_, j) => j !== zi) });
      return (
        <div>
          {titelZeile}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {block.spalten.map((s, si) => (
                    <th key={si} className="p-1 text-left">
                      <Input
                        value={s}
                        onChange={(e) => setSpalte(si, e.target.value)}
                        className="h-8 text-xs font-medium"
                        placeholder={si === 0 ? "Zeit/Datum" : `Spalte ${si + 1}`}
                        {...ro}
                      />
                    </th>
                  ))}
                  {!gesperrt && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {block.zeilen.map((z, zi) => (
                  <tr key={zi}>
                    {block.spalten.map((_, si) => (
                      <td key={si} className="p-1">
                        <Input
                          value={z[si] ?? ""}
                          onChange={(e) => setZelle(zi, si, e.target.value)}
                          className="h-8"
                          {...ro}
                        />
                      </td>
                    ))}
                    {!gesperrt && (
                      <td>
                        <Button variant="ghost" size="sm" className="h-8 text-red-600" onClick={() => zeileWeg(zi)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!gesperrt && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={zeilePlus}>+ Zeile</Button>
              <Button variant="outline" size="sm" onClick={spaltePlus}>+ Spalte</Button>
              <Button variant="outline" size="sm" onClick={spalteMinus} disabled={block.spalten.length <= 1}>
                – Spalte
              </Button>
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#0F766E]"
                  checked={block.diagramm}
                  onChange={(e) => onChange({ ...block, diagramm: e.target.checked })}
                />
                Diagramm unter der Tabelle (Zeit × Werte)
              </label>
            </div>
          )}
          {block.diagramm && <ProtokollChart spalten={block.spalten} zeilen={block.zeilen} />}
        </div>
      );
    }

    case "skala":
      return (
        <div>
          {titelZeile}
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                disabled={gesperrt}
                onClick={() => onChange({ ...block, wert: block.wert === n ? null : n })}
                className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                  block.wert === n
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-neutral-300 bg-white hover:border-teal-500"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-neutral-400">
            <span>1 = gar nicht / minimal</span>
            <span>10 = maximal</span>
          </div>
        </div>
      );

    case "foto": {
      const hochladen = async (f: File) => {
        const form = new FormData();
        form.append("datei", f);
        form.append("patientId", String(patientId));
        form.append("kategorie", "sonstiges");
        form.append("notiz", `Protokoll-Foto: ${block.titel}`);
        const res = await fetch("/api/dokumente", { method: "POST", body: form, credentials: "include" });
        if (!res.ok) {
          window.alert("Upload fehlgeschlagen: " + (await res.text()).slice(0, 200));
          return;
        }
        const doc = (await res.json()) as { id: number };
        onChange({ ...block, dokumentId: doc.id });
      };
      return (
        <div>
          {titelZeile}
          {block.dokumentId ? (
            <div className="space-y-2">
              <img
                src={`/api/dokumente/${block.dokumentId}/datei`}
                alt={block.titel}
                className="max-h-72 rounded-md border border-neutral-200 object-contain"
              />
              {!gesperrt && (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onChange({ ...block, dokumentId: null })}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Foto entfernen
                </Button>
              )}
            </div>
          ) : patientId === 0 ? (
            <p className="text-xs text-neutral-400">
              Fotos werden erst im Protokoll eines Patienten hochgeladen (nicht in der Vorlage).
            </p>
          ) : (
            !gesperrt && (
              <>
                <input
                  ref={dateiInput}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void hochladen(f);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => dateiInput.current?.click()}>
                  <Camera className="mr-1 h-4 w-4" /> Foto / Dokument hochladen
                </Button>
              </>
            )
          )}
        </div>
      );
    }

    case "vital": {
      const setWert = (feld: keyof typeof block.werte, wert: string) =>
        onChange({ ...block, werte: { ...block.werte, [feld]: wert } });
      const felder: { feld: keyof typeof block.werte; label: string; einheit?: string }[] = [
        { feld: "zeitpunkt", label: "Zeitpunkt" },
        { feld: "rrSys", label: "RR systolisch", einheit: "mmHg" },
        { feld: "rrDia", label: "RR diastolisch", einheit: "mmHg" },
        { feld: "puls", label: "Puls", einheit: "/min" },
        { feld: "temperatur", label: "Temperatur", einheit: "°C" },
        { feld: "spo2", label: "SpO₂", einheit: "%" },
      ];
      return (
        <div>
          {titelZeile}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {felder.map(({ feld, label, einheit }) => (
              <div key={feld}>
                <Label className="text-xs">
                  {label}
                  {einheit ? ` (${einheit})` : ""}
                </Label>
                <Input
                  value={block.werte[feld] ?? ""}
                  onChange={(e) => setWert(feld, e.target.value)}
                  className="h-8"
                  {...ro}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "ankreuz": {
      const setOption = (i: number, teil: Partial<(typeof block.optionen)[0]>) =>
        onChange({
          ...block,
          optionen: block.optionen.map((o, j) => (j === i ? { ...o, ...teil } : o)),
        });
      return (
        <div>
          {titelZeile}
          <div className="space-y-1.5">
            {block.optionen.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[#0F766E]"
                  checked={o.gewaehlt}
                  disabled={gesperrt}
                  onChange={(e) => setOption(i, { gewaehlt: e.target.checked })}
                />
                <Input
                  value={o.label}
                  onChange={(e) => setOption(i, { label: e.target.value })}
                  className="h-8"
                  {...ro}
                />
                {!gesperrt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-red-600"
                    onClick={() => onChange({ ...block, optionen: block.optionen.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!gesperrt && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => onChange({ ...block, optionen: [...block.optionen, { label: "", gewaehlt: false }] })}
            >
              + Option
            </Button>
          )}
        </div>
      );
    }
  }
}
