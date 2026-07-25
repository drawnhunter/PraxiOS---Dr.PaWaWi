import { useState } from "react";
import { useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  BLOCK_TYP_LABEL,
  HAEUFIGKEIT_STUFEN,
  KOPFBOGEN_FELDER,
  type KopfbogenKey,
  type OeffentlicherBogen,
} from "@contracts/anamnese";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CircleCheck, CircleAlert } from "lucide-react";

type AntwortWert = string[] | string | number | Record<string, string>;

export default function Bogen() {
  const { token } = useParams();
  const bogen = trpc.anamnese.bogenByToken.useQuery({ token: token ?? "" }, { retry: false });
  const einreichen = trpc.anamnese.einreichen.useMutation();

  const [kopf, setKopf] = useState<Record<string, string> | null>(null);
  const [antworten, setAntworten] = useState<Record<number, AntwortWert>>({});
  const [unterschrift, setUnterschrift] = useState("");
  const [datenschutz, setDatenschutz] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState("");

  if (bogen.isLoading) {
    return <Rahmen praxis={null}><p className="text-sm text-neutral-500">Bogen wird geladen …</p></Rahmen>;
  }
  if (bogen.error || !bogen.data) {
    return (
      <Rahmen praxis={null}>
        <div className="flex items-center gap-2 text-sm text-red-700">
          <CircleAlert className="h-5 w-5" />
          {bogen.error?.message ?? "Bogen nicht gefunden."}
        </div>
      </Rahmen>
    );
  }

  const b = bogen.data;

  if (b.linkStatus !== "offen") {
    return (
      <Rahmen praxis={b.praxisName}>
        <div className="text-center">
          <CircleCheck className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-lg font-semibold">
            {b.linkStatus === "eingereicht"
              ? "Dieser Bogen wurde bereits eingereicht."
              : "Dieser Link ist abgelaufen."}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {b.linkStatus === "abgelaufen" &&
              "Bitte wenden Sie sich für einen neuen Link an die Praxis."}
          </p>
        </div>
      </Rahmen>
    );
  }

  if (fertig) {
    return (
      <Rahmen praxis={b.praxisName}>
        <div className="text-center">
          <CircleCheck className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-lg font-semibold">Vielen Dank!</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Ihre Angaben wurden übermittelt und in Ihrer Patientenakte hinterlegt.
          </p>
        </div>
      </Rahmen>
    );
  }

  const kopfWerte: Record<string, string> =
    kopf ?? { ...(b.vorbefuellung ?? {}) } as Record<string, string>;
  const setK = (key: string, v: string) => setKopf({ ...kopfWerte, [key]: v });

  const absenden = () => {
    const fehlend = KOPFBOGEN_FELDER.filter((f) => f.pflicht && !(kopfWerte[f.key] ?? "").trim());
    if (fehlend.length > 0) {
      setFehler(`Bitte ausfüllen: ${fehlend.map((f) => f.label).join(", ")}`);
      return;
    }
    if (!datenschutz) {
      setFehler("Bitte bestätigen Sie die Datenschutzerklärung.");
      return;
    }
    if (unterschrift.trim().length < 2) {
      setFehler("Bitte bestätigen Sie mit Ihrem Namen (Unterschrift).");
      return;
    }
    setFehler("");
    einreichen.mutate(
      {
        token: token!,
        kopfbogen: kopfWerte,
        antworten: b.bloecke.map((block, i) => ({
          titel: block.titel,
          typ: block.typ,
          wert: antworten[i] ?? standardAntwort(block.typ),
        })),
        unterschriftName: unterschrift.trim(),
        datenschutzZugestimmt: true,
      },
      { onSuccess: () => setFertig(true), onError: (e) => setFehler(e.message) },
    );
  };

  return (
    <Rahmen praxis={b.praxisName}>
      <h1 className="text-xl font-semibold tracking-tight">{b.formTitel}</h1>
      {b.formBeschreibung && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{b.formBeschreibung}</p>
      )}

      {/* Kopfbogen */}
      <Abschnitt titel="1 · Persönliche Daten">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {KOPFBOGEN_FELDER.map((feld) => (
            <div key={feld.key}>
              <Label>
                {feld.label} {feld.pflicht && <span className="text-red-600">*</span>}
              </Label>
              <Input
                type={feld.typ === "datum" ? "date" : feld.typ === "email" ? "email" : "text"}
                value={kopfWerte[feld.key] ?? ""}
                onChange={(e) => setK(feld.key as KopfbogenKey, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Abschnitt>

      {/* Blöcke */}
      {b.bloecke.map((block, i) => (
        <Abschnitt key={i} titel={`${i + 2} · ${block.titel}`}>
          <BlockEingabe
            block={block}
            wert={antworten[i]}
            onChange={(w) => setAntworten({ ...antworten, [i]: w })}
          />
        </Abschnitt>
      ))}

      {/* Datenschutz + Unterschrift */}
      <Abschnitt titel="Bestätigung">
        <label className="flex items-start gap-2.5 text-sm text-neutral-700">
          <Checkbox
            checked={datenschutz}
            onCheckedChange={(v) => setDatenschutz(!!v)}
            className="mt-0.5"
          />
          <span>
            Ich stimme zu, dass meine Angaben zur Behandlung und Abrechnung in der
            Patientenakte der Praxis gespeichert werden (DSGVO).{" "}
            <span className="text-red-600">*</span>
          </span>
        </label>
        <div className="mt-4">
          <Label>
            Unterschrift (Name in Klartext) <span className="text-red-600">*</span>
          </Label>
          <Input
            value={unterschrift}
            onChange={(e) => setUnterschrift(e.target.value)}
            placeholder="Vorname Nachname"
          />
        </div>
      </Abschnitt>

      {fehler && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {fehler}
        </p>
      )}
      <Button className="w-full" size="lg" onClick={absenden} disabled={einreichen.isPending}>
        {einreichen.isPending ? "Wird gesendet …" : "Bogen einreichen"}
      </Button>
    </Rahmen>
  );
}

function standardAntwort(typ: string): AntwortWert {
  if (typ === "checkboxen") return [];
  if (typ === "skala_1_10") return 0 as unknown as number;
  if (typ === "haeufigkeit") return {};
  return "";
}

function Rahmen({ praxis, children }: { praxis: string | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-[#0F766E] px-4 py-4 text-center">
        <span className="text-sm font-semibold tracking-tight text-white">
          {praxis ?? "PraxiOS"} · Anamnesebogen
        </span>
      </div>
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">{children}</div>
    </div>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <h2 className="border-b border-neutral-100 bg-[#F0FDFA] px-4 py-2.5 text-sm font-medium text-[#0B4F4A]">
        {titel}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function BlockEingabe({
  block,
  wert,
  onChange,
}: {
  block: OeffentlicherBogen["bloecke"][number];
  wert: AntwortWert | undefined;
  onChange: (w: AntwortWert) => void;
}) {
  if (block.typ === "checkboxen") {
    const gewaehlt = Array.isArray(wert) ? wert : [];
    const spalten = block.config.spalten ?? 2;
    return (
      <div className={cn("grid gap-2.5", spalten === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        {(block.config.fragen ?? []).map((frage) => (
          <label key={frage} className="flex items-center gap-2.5 text-sm">
            <Checkbox
              checked={gewaehlt.includes(frage)}
              onCheckedChange={(v) =>
                onChange(v ? [...gewaehlt, frage] : gewaehlt.filter((f) => f !== frage))
              }
            />
            {frage}
          </label>
        ))}
      </div>
    );
  }
  if (block.typ === "textfeld") {
    return (
      <div>
        <Label>{block.config.frage}</Label>
        <Input
          value={typeof wert === "string" ? wert : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  if (block.typ === "textfeld_schreibfeld") {
    return (
      <div>
        <Label>{block.config.frage}</Label>
        <Textarea
          rows={block.config.zeilen ?? 4}
          value={typeof wert === "string" ? wert : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  if (block.typ === "skala_1_10") {
    const aktuell = typeof wert === "number" ? wert : 0;
    return (
      <div>
        <Label>{block.config.frage}</Label>
        <div className="mt-1.5 grid grid-cols-10 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                "rounded border py-1.5 text-sm tabular-nums transition-colors",
                aktuell === n
                  ? "border-[#0F766E] bg-[#0F766E] font-semibold text-white"
                  : "border-neutral-200 text-neutral-600 hover:border-[#0F766E]/50",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-neutral-400">
          <span>{block.config.vonLabel ?? "1 = schwach"}</span>
          <span>{block.config.bisLabel ?? "10 = stark"}</span>
        </div>
      </div>
    );
  }
  if (block.typ === "haeufigkeit") {
    const map = (typeof wert === "object" && !Array.isArray(wert) ? wert : {}) as Record<string, string>;
    return (
      <div className="space-y-2">
        {(block.config.fragen ?? []).map((frage) => (
          <div key={frage} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-50 pb-2">
            <span className="min-w-40 text-sm">{frage}</span>
            <div className="flex gap-1">
              {HAEUFIGKEIT_STUFEN.map((stufe) => (
                <button
                  key={stufe}
                  type="button"
                  onClick={() => onChange({ ...map, [frage]: stufe })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    map[frage] === stufe
                      ? "border-[#0F766E] bg-[#0F766E] text-white"
                      : "border-neutral-200 text-neutral-600 hover:border-[#0F766E]/50",
                  )}
                >
                  {stufe}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-xs text-neutral-400">Unbekannter Blocktyp: {BLOCK_TYP_LABEL[block.typ]}</p>;
}
