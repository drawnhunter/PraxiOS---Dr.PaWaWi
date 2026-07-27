import { useState } from "react";
import { useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  BLOCK_TYP_LABEL,
  HAEUFIGKEIT_STUFEN,
  KOPFBOGEN_FELDER,
  SPRACHEN,
  UI_STRINGS,
  type KopfbogenKey,
  type OeffentlicherBogen,
} from "@contracts/anamnese";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";

type AntwortWert = string[] | string | number | Record<string, string>;

export default function Bogen() {
  const { token } = useParams();
  const [sprache, setSprache] = useState<string | null>(null);

  const sprachenQ = trpc.anamnese.sprachen.useQuery();
  const bogen = trpc.anamnese.bogenInSprache.useQuery(
    { token: token ?? "", sprache: sprache ?? "de" },
    { enabled: !!token && sprache !== null, retry: false },
  );

  const ui = UI_STRINGS[sprache ?? "de"] ?? UI_STRINGS.de;
  const rtl = sprache === "ar";

  // ── Sprachwahl (erster Schritt) ───────────────────────────────────────────
  if (!sprache) {
    return (
      <Rahmen praxis={null}>
        <div className="text-center">
          <h1 className="text-lg font-semibold">{UI_STRINGS.de.waehleSprache}</h1>
          <p className="mt-1 text-sm text-neutral-500">Please choose your language</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(sprachenQ.data?.sprachen ?? SPRACHEN).map((s) => (
            <button
              key={s.code}
              type="button"
              disabled={sprachenQ.data && !sprachenQ.data.mtVerfuegbar && s.code !== "de"}
              onClick={() => setSprache(s.code)}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-4 text-sm font-medium transition-colors hover:border-[#0F766E] hover:bg-[#F0FDFA] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-2xl">{s.flagge}</span>
              {s.name}
            </button>
          ))}
        </div>
        {sprachenQ.data && !sprachenQ.data.mtVerfuegbar && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
            Der Übersetzungsdienst startet gerade — bitte Seite in ein paar Sekunden
            neu laden. / The translation service is starting, please reload shortly.
          </p>
        )}
        {sprachenQ.isLoading && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade …
          </p>
        )}
      </Rahmen>
    );
  }

  // ── Bogen in gewählter Sprache ────────────────────────────────────────────
  if (bogen.isLoading) {
    return (
      <Rahmen praxis={null}>
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade …
        </p>
      </Rahmen>
    );
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
  return <BogenFormular b={bogen.data} token={token!} ui={ui} rtl={rtl} sprache={sprache} />;
}

function BogenFormular({
  b,
  token,
  ui,
  rtl,
  sprache,
}: {
  b: OeffentlicherBogen;
  token: string;
  ui: (typeof UI_STRINGS)["de"];
  rtl: boolean;
  sprache: string;
}) {
  const einreichen = trpc.anamnese.einreichen.useMutation();
  const [kopf, setKopf] = useState<Record<string, string>>(
    { ...(b.vorbefuellung ?? {}) } as Record<string, string>,
  );
  const [antworten, setAntworten] = useState<Record<number, AntwortWert>>({});
  const [unterschrift, setUnterschrift] = useState("");
  const [datenschutz, setDatenschutz] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState("");

  if (b.linkStatus !== "offen") {
    return (
      <Rahmen praxis={b.praxisName}>
        <div className="text-center">
          <CircleCheck className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-lg font-semibold">
            {b.linkStatus === "eingereicht" ? ui.bereitsEingereicht : ui.abgelaufen}
          </h1>
          {b.linkStatus === "abgelaufen" && (
            <p className="mt-2 text-sm text-neutral-500">{ui.abgelaufenText}</p>
          )}
        </div>
      </Rahmen>
    );
  }

  if (fertig) {
    return (
      <Rahmen praxis={b.praxisName}>
        <div className="text-center">
          <CircleCheck className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-lg font-semibold">{ui.danke}</h1>
          <p className="mt-2 text-sm text-neutral-500">{ui.dankeText}</p>
        </div>
      </Rahmen>
    );
  }

  const setK = (key: string, v: string) => setKopf({ ...kopf, [key]: v });
  const labelFuer = (feld: (typeof KOPFBOGEN_FELDER)[number]) =>
    b.kopfbogenLabels?.[feld.key] ?? feld.label;

  const absenden = () => {
    const fehlend = KOPFBOGEN_FELDER.filter((f) => f.pflicht && !(kopf[f.key] ?? "").trim());
    if (fehlend.length > 0) {
      setFehler(fehlend.map((f) => labelFuer(f)).join(", "));
      return;
    }
    if (!datenschutz) {
      setFehler(ui.fehlerDatenschutz);
      return;
    }
    if (unterschrift.trim().length < 2) {
      setFehler(ui.fehlerUnterschrift);
      return;
    }
    setFehler("");
    einreichen.mutate(
      {
        token,
        kopfbogen: kopf,
        antworten: b.bloecke.map((block, i) => ({
          titel: block.titel,
          typ: block.typ,
          wert: antworten[i] ?? standardAntwort(block.typ),
        })),
        unterschriftName: unterschrift.trim(),
        datenschutzZugestimmt: true,
        sprache,
      },
      { onSuccess: () => setFertig(true), onError: (e) => setFehler(e.message) },
    );
  };

  return (
    <Rahmen praxis={b.praxisName} dir={rtl ? "rtl" : "ltr"}>
      <h1 className="text-xl font-semibold tracking-tight">{b.formTitel}</h1>
      {b.formBeschreibung && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{b.formBeschreibung}</p>
      )}

      {/* Kopfbogen */}
      <Abschnitt titel={`1 · ${ui.kopfbogenTitel}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {KOPFBOGEN_FELDER.map((feld) => (
            <div key={feld.key}>
              <Label>
                {labelFuer(feld)} {feld.pflicht && <span className="text-red-600">*</span>}
              </Label>
              <Input
                type={feld.typ === "datum" ? "date" : feld.typ === "email" ? "email" : "text"}
                value={kopf[feld.key] ?? ""}
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
            stufen={b.haeufigkeitStufen ?? [...HAEUFIGKEIT_STUFEN]}
            wert={antworten[i]}
            onChange={(w) => setAntworten({ ...antworten, [i]: w })}
          />
        </Abschnitt>
      ))}

      {/* Datenschutz + Unterschrift */}
      <Abschnitt titel="✓">
        <label className="flex items-start gap-2.5 text-sm text-neutral-700">
          <Checkbox
            checked={datenschutz}
            onCheckedChange={(v) => setDatenschutz(!!v)}
            className="mt-0.5"
          />
          <span>
            {ui.datenschutz} <span className="text-red-600">*</span>
          </span>
        </label>
        <div className="mt-4">
          <Label>
            {ui.unterschrift} <span className="text-red-600">*</span>
          </Label>
          <Input
            value={unterschrift}
            onChange={(e) => setUnterschrift(e.target.value)}
            placeholder={ui.namePlatzhalter}
          />
        </div>
      </Abschnitt>

      {fehler && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {fehler}
        </p>
      )}
      <Button className="w-full" size="lg" onClick={absenden} disabled={einreichen.isPending}>
        {einreichen.isPending ? ui.wirdGesendet : ui.absenden}
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

function Rahmen({
  praxis,
  dir = "ltr",
  children,
}: {
  praxis: string | null;
  dir?: "ltr" | "rtl";
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50" dir={dir}>
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
  stufen,
  wert,
  onChange,
}: {
  block: OeffentlicherBogen["bloecke"][number];
  stufen: string[];
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
              {stufen.map((stufe) => (
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
