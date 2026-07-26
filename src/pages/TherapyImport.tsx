import { useRef, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { geld } from "@/lib/format";
import { blobHerunterladen } from "@/lib/downloads";
import type {
  AnalyseErgebnis,
  ImportErgebnis,
  PatientVorschau,
  SheetInfo,
} from "@contracts/therapy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileUp,
  FileText,
  FileDown,
  CircleAlert,
  CircleCheck,
  RefreshCw,
  Upload,
} from "lucide-react";

async function dateiZuBase64(datei: File): Promise<string> {
  const buf = new Uint8Array(await datei.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

const fmtDatumDe = (iso: string) => {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
};

export default function TherapyImport() {
  const [datei, setDatei] = useState<{ name: string; base64: string } | null>(null);
  const [blaetter, setBlaetter] = useState<SheetInfo[]>([]);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [vorschau, setVorschau] = useState<AnalyseErgebnis | null>(null);
  const [ergebnis, setErgebnis] = useState<(ImportErgebnis & { importId: number }) | null>(null);
  const dateiInput = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const historie = trpc.therapyImport.historie.useQuery();

  const blaetterMut = trpc.therapyImport.blaetter.useMutation({
    onSuccess: (d) => {
      setBlaetter(d.sheets);
      setAuswahl(d.sheets.map((s) => s.name));
      setVorschau(null);
      setErgebnis(null);
    },
  });
  const vorschauMut = trpc.therapyImport.vorschau.useMutation({
    onSuccess: (d) => setVorschau(d),
  });
  const importMut = trpc.therapyImport.importieren.useMutation({
    onSuccess: (d) => {
      setErgebnis(d);
      setVorschau(null);
      utils.therapyImport.historie.invalidate();
      utils.invoices.list.invalidate();
      utils.customers.list.invalidate();
    },
  });

  const fehler = blaetterMut.error ?? vorschauMut.error ?? importMut.error;
  const busy =
    blaetterMut.isPending || vorschauMut.isPending || importMut.isPending;

  const dateiWaehlen = async (f: File | undefined) => {
    if (!f) return;
    const base64 = await dateiZuBase64(f);
    setDatei({ name: f.name, base64 });
    setBlaetter([]);
    setVorschau(null);
    setErgebnis(null);
    blaetterMut.mutate({ dateiname: f.name, base64 });
  };

  const analysieren = () => {
    if (!datei || auswahl.length === 0) return;
    vorschauMut.mutate({
      dateiname: datei.name,
      base64: datei.base64,
      jahr,
      sheets: auswahl,
    });
  };

  const importieren = () => {
    if (!datei || auswahl.length === 0) return;
    importMut.mutate({
      dateiname: datei.name,
      base64: datei.base64,
      jahr,
      sheets: auswahl,
    });
  };

  const reportLaden = async (id: number, format: "txt" | "pdf") => {
    const r = await utils.therapyImport.report.fetch({ id, format });
    const bin = atob(r.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blobHerunterladen(r.dateiname, new Blob([bytes], { type: r.mime }));
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Therapieplan-Import</h1>
        <p className="mt-1 text-sm text-neutral-500">
          IMTZ-Therapieplan (XLSX) oder PraxisAkte-Export (CSV) hochladen —
          Dr.ReWaWi erstellt pro Patient eine Rechnung über alle gewählten
          Wochen. Unklarheiten landen im Report zum Zurückschicken.
        </p>
      </div>

      {/* Schritt 1: Datei */}
      <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[11px] text-white">1</span>
          Datei wählen
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={dateiInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => dateiWaehlen(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            onClick={() => dateiInput.current?.click()}
            disabled={busy}
          >
            <FileUp className="mr-1.5 h-4 w-4" />
            {datei ? "Andere Datei …" : "Therapieplan hochladen …"}
          </Button>
          {datei && (
            <span className="text-sm text-neutral-600">
              {datei.name}
              {blaetter.length > 0 && ` — ${blaetter.length} KW-Blätter erkannt`}
            </span>
          )}
          {blaetterMut.isPending && (
            <span className="text-sm text-neutral-400">wird gelesen …</span>
          )}
        </div>
      </section>

      {/* Schritt 2: Wochen + Jahr */}
      {blaetter.length > 0 && !ergebnis && (
        <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[11px] text-white">2</span>
            Wochen wählen (eine Rechnung pro Patient über alle gewählten Wochen)
          </div>
          <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
            {blaetter.map((b) => (
              <label key={b.name} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={auswahl.includes(b.name)}
                  onCheckedChange={(v) =>
                    setAuswahl(
                      v
                        ? [...auswahl, b.name]
                        : auswahl.filter((x) => x !== b.name),
                    )
                  }
                />
                {b.name}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Jahr (für Datumsangaben ohne Jahr, z. B. „06.07“)</Label>
              <Input
                type="number"
                className="w-28"
                value={jahr}
                onChange={(e) => setJahr(Number(e.target.value) || jahr)}
              />
            </div>
            <Button onClick={analysieren} disabled={busy || auswahl.length === 0}>
              {vorschauMut.isPending ? (
                <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Vorschau berechnen
            </Button>
          </div>
        </section>
      )}

      {fehler && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fehler.message}
        </div>
      )}

      {/* Schritt 3: Vorschau */}
      {vorschau && (
        <section className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[11px] text-white">3</span>
              Vorschau — {vorschau.patienten.length} Rechnung(en),{" "}
              {vorschau.eintraegeGesamt} Einträge, {vorschau.unklarheiten.length} Unklarheit(en)
            </div>
            <Button onClick={importieren} disabled={busy || vorschau.patienten.length === 0}>
              <Upload className="mr-1.5 h-4 w-4" />
              {importMut.isPending
                ? "Importiere …"
                : `${vorschau.patienten.length} Rechnung(en) als Entwurf anlegen`}
            </Button>
          </div>

          {vorschau.unklarheiten.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-900">
                <CircleAlert className="h-4 w-4" /> Unklarheiten ({vorschau.unklarheiten.length})
                — kommen in den Report an IMTZ
              </div>
              <ul className="space-y-1 text-sm text-amber-900">
                {vorschau.unklarheiten.map((u, i) => (
                  <li key={i}>
                    • {u.grund}
                    {(u.sheet || u.zeile) && (
                      <span className="text-amber-700">
                        {" "}
                        ({[u.sheet && `Sheet ${u.sheet}`, u.zeile && `Zeile ${u.zeile}`]
                          .filter(Boolean)
                          .join(", ")})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vorschau.uebersprungen.length > 0 && (
            <div className="mb-4 rounded-lg border border-neutral-300 bg-neutral-100 p-4 text-sm">
              <div className="mb-1 font-medium">Übersprungen (keine Rechnung):</div>
              {vorschau.uebersprungen.map((u, i) => (
                <div key={i}>• {u.patient}: {u.grund}</div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {vorschau.patienten.map((p) => (
              <PatientKarte key={p.patientName} p={p} />
            ))}
          </div>
        </section>
      )}

      {/* Ergebnis nach Import */}
      {ergebnis && (
        <section className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-900">
            <CircleCheck className="h-4 w-4" /> Import abgeschlossen —{" "}
            {ergebnis.rechnungen.length} Rechnung(en) als Entwurf angelegt
          </div>
          <ul className="mb-4 space-y-1 text-sm">
            {ergebnis.rechnungen.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Link
                  to={`/rechnungen/${r.id}`}
                  className="font-medium text-emerald-900 underline underline-offset-2"
                >
                  {r.patient}
                </Link>
                {r.klar ? (
                  <Badge variant="secondary">klar</Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-400 text-amber-700">
                    mit Unklarheiten
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => reportLaden(ergebnis.importId, "pdf")}>
              <FileDown className="mr-1.5 h-4 w-4" /> Unklarheiten-Report (PDF)
            </Button>
            <Button variant="outline" size="sm" onClick={() => reportLaden(ergebnis.importId, "txt")}>
              <FileText className="mr-1.5 h-4 w-4" /> Report (TXT)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setErgebnis(null);
                setDatei(null);
                setBlaetter([]);
              }}
            >
              Neuer Import
            </Button>
          </div>
        </section>
      )}

      {/* Verlauf */}
      {(historie.data ?? []).length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="mb-3 text-sm font-medium">Bisherige Importe</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-1.5 pr-3 font-medium">Datum</th>
                <th className="py-1.5 pr-3 font-medium">Datei</th>
                <th className="py-1.5 pr-3 font-medium">Wochen</th>
                <th className="py-1.5 pr-3 font-medium">Rechnungen</th>
                <th className="py-1.5 pr-3 font-medium">Unklarheiten</th>
                <th className="py-1.5 text-right font-medium">Report</th>
              </tr>
            </thead>
            <tbody>
              {(historie.data ?? []).map((h) => (
                <tr key={h.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-3 text-neutral-600">
                    {new Date(h.erstelltAm).toLocaleString("de-DE")}
                  </td>
                  <td className="py-2 pr-3">{h.dateiname}</td>
                  <td className="py-2 pr-3 text-neutral-600">{h.sheets.join(", ")}</td>
                  <td className="py-2 pr-3">{h.anzahlRechnungen}</td>
                  <td className="py-2 pr-3">
                    {h.anzahlUnklarheiten > 0 ? (
                      <span className="text-amber-700">{h.anzahlUnklarheiten}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => reportLaden(h.id, "pdf")}>
                      PDF
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => reportLaden(h.id, "txt")}>
                      TXT
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function PatientKarte({ p }: { p: PatientVorschau }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{p.patientName}</span>
          {p.klar ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">klar</Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">unklar</Badge>
          )}
          {p.kundeNeu ? (
            <Badge variant="outline">Patient wird neu angelegt</Badge>
          ) : p.kundeName && p.kundeName !== p.patientName ? (
            <Badge variant="outline">Stamm: {p.kundeName}</Badge>
          ) : null}
          {p.patientInfo && (
            <Badge variant="outline" className="border-sky-400 text-sky-700">
              Daten aus Vorlage ✓
            </Badge>
          )}
          {p.patientInfo?.empfaengerAbweichend && (
            <Badge variant="outline" className="border-amber-400 text-amber-700">
              abw. Empfänger
            </Badge>
          )}
        </div>
        <div className="text-sm text-neutral-500">
          {p.zeitraum &&
            `${fmtDatumDe(p.zeitraum.von)}–${fmtDatumDe(p.zeitraum.bis)} · KW ${p.wochen
              .map((w) => w.kw)
              .sort((a, b) => a - b)
              .join("/")}`}
          {" · "}
          <span className="font-medium text-neutral-900">{geld(p.summeCent / 100)}</span>
        </div>
      </div>
      {p.patientInfo && (
        <div className="border-b border-neutral-100 px-4 py-2 text-xs text-neutral-500">
          {[
            p.patientInfo.geburtsdatum && `geb. ${fmtDatumDe(p.patientInfo.geburtsdatum)}`,
            p.patientInfo.strasse,
            [p.patientInfo.plz, p.patientInfo.ort].filter(Boolean).join(" "),
            p.patientInfo.patientenNr && `Pat.-Nr. ${p.patientInfo.patientenNr}`,
            p.patientInfo.email,
            p.patientInfo.telefon,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
            <th className="px-4 py-1.5 font-medium">Datum</th>
            <th className="px-4 py-1.5 font-medium">Leistung (Katalog)</th>
            <th className="px-4 py-1.5 font-medium">Abschnitt</th>
            <th className="px-4 py-1.5 text-right font-medium">Menge</th>
            <th className="px-4 py-1.5 text-right font-medium">Einzelpreis</th>
            <th className="px-4 py-1.5 text-right font-medium">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {p.positionen.map((pos, i) => (
            <tr key={i} className="border-b border-neutral-50 last:border-0">
              <td className="px-4 py-1.5 text-neutral-600">
                {pos.datum ? fmtDatumDe(pos.datum) : "—"}
              </td>
              <td className="px-4 py-1.5">
                {pos.bezeichnung}
                {pos.quelle !== pos.bezeichnung && (
                  <span className="ml-1 text-xs text-neutral-400">(„{pos.quelle}“)</span>
                )}
              </td>
              <td className="px-4 py-1.5 text-xs text-neutral-500">
                {pos.kategorie === "leistung" ? "GOÄ" : "§ 10 (EK)"}
              </td>
              <td className="px-4 py-1.5 text-right tabular-nums">{pos.menge}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{geld(pos.einzelpreis)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">
                {geld(Number(pos.menge) * Number(pos.einzelpreis))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
