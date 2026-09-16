import { useRef, useState } from "react";
import { kopiereInZwischenablage } from "@/lib/clipboard";
import { BLOCK_TYPEN, BLOCK_TYP_LABEL, type FormBlock } from "@contracts/anamnese";
import { trpc } from "@/providers/trpc";
import { pdfHerunterladen } from "@/lib/downloads";
import { BogenEditor } from "@/components/BogenEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FileUp, Plus, FileDown, Link2, QrCode, ClipboardCopy, Trash2 } from "lucide-react";

type Props_initial = { titel: string; beschreibung: string; bloecke: FormBlock[] } | null;

export default function Anamnese() {
  const utils = trpc.useUtils();
  const liste = trpc.anamnese.liste.useQuery();
  const [editorOffen, setEditorOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<number | null>(null);
  const [linkDialog, setLinkDialog] = useState<number | null>(null);
  const [importOffen, setImportOffen] = useState(false);
  const [editorInitial, setEditorInitial] = useState<Props_initial>(null);

  const setAktiv = trpc.anamnese.setAktiv.useMutation({
    onSuccess: () => utils.anamnese.liste.invalidate(),
  });

  const [musterFehler, setMusterFehler] = useState<string | null>(null);
  const musterDrx = trpc.anamnese.musterDrx.useMutation({
    onSuccess: () => {
      setMusterFehler(null);
      utils.anamnese.liste.invalidate();
    },
    onError: (e) => setMusterFehler(e.message),
  });

  const leerPdf = async (id: number) => {
    const r = await utils.anamnese.leerPdf.fetch({ id });
    pdfHerunterladen(r);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Anamnesebögen</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bögen aus Blöcken zusammenstellen, per Link oder QR-Code an Patienten
            schicken — eingereichte Bögen landen automatisch in der Akte.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => musterDrx.mutate()}
            disabled={musterDrx.isPending}
            title="Unseren Praxis-Standardbogen (Dr. X) mit einem Klick anlegen"
          >
            <ClipboardCopy className="mr-1.5 h-4 w-4" /> Muster: Dr.-X-Bogen
          </Button>
          <Button variant="outline" onClick={() => setImportOffen(true)}>
            <FileUp className="mr-1.5 h-4 w-4" /> Bogen importieren (docx/pdf)
          </Button>
          <Button
            onClick={() => {
              setEditorInitial(null);
              setBearbeiteId(null);
              setEditorOffen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Neuer Bogen
          </Button>
        </div>
      </div>

      {musterFehler && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {musterFehler}
        </div>
      )}

      <div className="space-y-3">
        {(liste.data ?? []).length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-400">
            Noch keine Bögen — den ersten anlegen, das Dr.-X-Muster übernehmen
            oder einen bestehenden Bogen (docx/pdf) importieren.
          </div>
        )}
        {(liste.data ?? []).map((form) => (
          <section
            key={form.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{form.titel}</span>
                {!form.aktiv && <Badge variant="secondary">inaktiv</Badge>}
                <Badge variant="outline">{form.links.length} Link(s)</Badge>
              </div>
              {form.beschreibung && (
                <div className="mt-0.5 max-w-xl truncate text-xs text-neutral-500">
                  {form.beschreibung}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => leerPdf(form.id)}>
                <FileDown className="mr-1 h-4 w-4" /> PDF (leer)
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLinkDialog(form.id)}>
                <Link2 className="mr-1 h-4 w-4" /> Links
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBearbeiteId(form.id);
                  setEditorOffen(true);
                }}
              >
                Bearbeiten
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAktiv.mutate({ id: form.id, aktiv: !form.aktiv })}
              >
                {form.aktiv ? "Deaktivieren" : "Aktivieren"}
              </Button>
            </div>
          </section>
        ))}
      </div>

      <ImportDialog
        offen={importOffen}
        onOpenChange={setImportOffen}
        onUebernehmen={(titel, bloecke) => {
          setEditorInitial({ titel, beschreibung: "", bloecke });
          setImportOffen(false);
          setBearbeiteId(null);
          setEditorOffen(true);
        }}
      />
      <BogenEditor
        offen={editorOffen}
        onOpenChange={(o) => {
          setEditorOffen(o);
          if (!o) setEditorInitial(null);
        }}
        formId={bearbeiteId}
        initial={editorInitial}
        onGespeichert={() => utils.anamnese.liste.invalidate()}
      />
      <LinkDialog formId={linkDialog} onClose={() => setLinkDialog(null)} />
    </div>
  );
}

function LinkDialog({ formId, onClose }: { formId: number | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const form = trpc.anamnese.byId.useQuery(
    { id: formId ?? 0 },
    { enabled: formId !== null },
  );
  const patienten = trpc.customers.list.useQuery({});
  const [patientId, setPatientId] = useState("");
  const [notiz, setNotiz] = useState("");
  const [qr, setQr] = useState<{ url: string; dataUrl: string } | null>(null);
  const [kopiert, setKopiert] = useState("");

  const erstellen = trpc.anamnese.linkErstellen.useMutation({
    onSuccess: () => {
      utils.anamnese.byId.invalidate({ id: formId ?? 0 });
      utils.anamnese.liste.invalidate();
      setPatientId("");
      setNotiz("");
    },
  });

  const urlFuer = (token: string) => `${window.location.origin}/bogen/${token}`;

  const qrAnzeigen = async (token: string) => {
    const url = urlFuer(token);
    const r = await utils.anamnese.qr.fetch({ text: url });
    setQr({ url, dataUrl: r.dataUrl });
  };

  const kopieren = async (token: string) => {
    await kopiereInZwischenablage(urlFuer(token));
    setKopiert(token);
    setTimeout(() => setKopiert(""), 2000);
  };

  const qrHerunterladen = () => {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr.dataUrl;
    a.download = "anamnese-qr.png";
    a.click();
  };

  return (
    <Dialog open={formId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Links für „{form.data?.titel ?? "…"}“</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label>Patient (optional, vorbefüllt)</Label>
            <select
              className="w-full rounded-md border border-neutral-200 bg-white px-2 py-2 text-sm"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">— Neuer Patient —</option>
              {(patienten.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <Label>Notiz (intern)</Label>
            <Input
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="z. B. WhatsApp an Frau M."
            />
          </div>
          <div className="flex items-end sm:col-span-1">
            <Button
              className="w-full"
              disabled={erstellen.isPending}
              onClick={() =>
                erstellen.mutate({
                  formId: formId!,
                  patientId: patientId ? Number(patientId) : null,
                  notiz: notiz.trim() || null,
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Link (72 h)
            </Button>
          </div>
        </div>

        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {(form.data?.links ?? []).map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-100 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    l.status === "offen"
                      ? "default"
                      : l.status === "eingereicht"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {l.status === "offen"
                    ? "offen"
                    : l.status === "eingereicht"
                      ? "eingereicht"
                      : "abgelaufen"}
                </Badge>
                <span className="text-xs text-neutral-500">
                  {l.notiz ?? `Link #${l.id}`}
                  {l.patientId ? ` · Patient #${l.patientId}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => kopieren(l.token)}>
                  <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
                  {kopiert === l.token ? "Kopiert!" : "Link"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => qrAnzeigen(l.token)}>
                  <QrCode className="mr-1 h-3.5 w-3.5" /> QR
                </Button>
              </div>
            </div>
          ))}
        </div>

        {qr && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 p-4">
            <img src={qr.dataUrl} alt="QR-Code" className="h-40 w-40" />
            <div className="break-all text-center text-xs text-neutral-500">{qr.url}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={qrHerunterladen}>
                QR als PNG
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setQr(null)}>
                Schließen
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fertig
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── Import-Dialog: docx/pdf analysieren → Block-Vorschau → an Editor ───────
function ImportDialog({
  offen,
  onOpenChange,
  onUebernehmen,
}: {
  offen: boolean;
  onOpenChange: (o: boolean) => void;
  onUebernehmen: (titel: string, bloecke: FormBlock[]) => void;
}) {
  const dateiInput = useRef<HTMLInputElement>(null);
  const [datei, setDatei] = useState<{ name: string; base64: string } | null>(null);
  const [titel, setTitel] = useState("");
  const [bloecke, setBloecke] = useState<FormBlock[]>([]);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [quelle, setQuelle] = useState("");
  const analysieren = trpc.anamnese.bogenImportAnalysieren.useMutation({
    onSuccess: (r) => {
      setBloecke(r.bloecke);
      setHinweise(r.hinweise);
      setQuelle(r.quelle);
      if (!titel) setTitel(datei?.name.replace(/\.[^.]+$/, "") ?? "Importierter Bogen");
    },
  });

  const waehlen = async (f: File | undefined) => {
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const base64 = btoa(bin);
    setDatei({ name: f.name, base64 });
    setBloecke([]);
    setHinweise([]);
    analysieren.mutate({ dateiname: f.name, base64 });
  };

  const entfernen = (i: number) => setBloecke(bloecke.filter((_, bi) => bi !== i));
  const typAendern = (i: number, typ: FormBlock["typ"]) =>
    setBloecke(
      bloecke.map((b, bi) =>
        bi === i
          ? {
              ...b,
              typ,
              config: typ === "textfeld_schreibfeld"
                ? { ...b.config, zeilen: b.config.zeilen ?? 3 }
                : b.config,
            }
          : b,
      ),
    );

  return (
    <Dialog open={offen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bogen importieren (docx/pdf)</DialogTitle>
        </DialogHeader>
        <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
          <input
            ref={dateiInput}
            type="file"
            accept=".docx,.pdf"
            className="hidden"
            onChange={(e) => waehlen(e.target.files?.[0])}
          />
          <Button variant="outline" onClick={() => dateiInput.current?.click()} disabled={analysieren.isPending}>
            <FileUp className="mr-1.5 h-4 w-4" />
            {datei ? datei.name : "Datei wählen …"}
          </Button>
          {analysieren.isPending && <span className="text-sm text-neutral-400">Analysiere …</span>}
          {analysieren.error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {analysieren.error.message}
            </p>
          )}

          {bloecke.length > 0 && (
            <>
              <div>
                <Label>Titel des Bogens</Label>
                <Input value={titel} onChange={(e) => setTitel(e.target.value)} />
              </div>
              <p className="text-xs text-neutral-500">
                {bloecke.length} Baublöcke erkannt ({quelle.toUpperCase()}) — prüfen, entfernen oder
                Typ ändern, danach „Im Editor prüfen“ zum Feinschliff.
              </p>
              <div className="space-y-2">
                {bloecke.map((b, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 rounded border border-neutral-100 px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{BLOCK_TYP_LABEL[b.typ]}</Badge>
                        <span className="text-sm font-medium">{b.titel}</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-neutral-500">
                        {[
                          ...(b.config.fragen ?? []).slice(0, 4),
                          b.config.frage,
                          b.config.text ? b.config.text.slice(0, 60) + "…" : undefined,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {(b.config.fragen ?? []).length > 4 && ` (+${(b.config.fragen ?? []).length - 4})`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Select value={b.typ} onValueChange={(v) => typAendern(i, v as FormBlock["typ"])}>
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BLOCK_TYPEN.map((t) => (
                            <SelectItem key={t} value={t}>
                              {BLOCK_TYP_LABEL[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => entfernen(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {hinweise.length > 0 && (
                <details className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <summary className="cursor-pointer font-medium">
                    {hinweise.length} Hinweis(e) zur Erkennung
                  </summary>
                  <ul className="mt-2 max-h-32 list-disc space-y-1 overflow-y-auto pl-4">
                    {hinweise.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
          {bloecke.length === 0 && datei && !analysieren.isPending && !analysieren.error && (
            <p className="text-sm text-neutral-500">
              Keine Baublöcke erkannt — die Datei hat womöglich ein sehr freies Layout. Im Editor
              kannst du den Bogen trotzdem manuell aufbauen.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            disabled={bloecke.length === 0 || !titel.trim()}
            onClick={() => onUebernehmen(titel.trim(), bloecke)}
          >
            Im Editor prüfen ({bloecke.length} Blöcke)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
