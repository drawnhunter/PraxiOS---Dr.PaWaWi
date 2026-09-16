import { useRef, useState } from "react";
import { kopiereInZwischenablage } from "@/lib/clipboard";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ClipboardCopy, FileUp, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";

async function dateiZuBase64(datei: File): Promise<string> {
  const buf = new Uint8Array(await datei.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export default function Austausch() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Austausch mit Kollegen</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Akten als age-verschlüsseltes Paket an Kollegen-Praxen senden (Export in der
          Patientenakte) und empfangene Pakete hier importieren.
        </p>
      </div>
      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Paket importieren</TabsTrigger>
          <TabsTrigger value="kollegen">Kollegen-Praxen</TabsTrigger>
          <TabsTrigger value="schluessel">Eigener Schlüssel</TabsTrigger>
        </TabsList>
        <TabsContent value="import">
          <ImportTab />
        </TabsContent>
        <TabsContent value="kollegen">
          <KollegenTab />
        </TabsContent>
        <TabsContent value="schluessel">
          <SchluesselTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Import ──────────────────────────────────────────────────────────────────
function ImportTab() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const dateiInput = useRef<HTMLInputElement>(null);
  const [datei, setDatei] = useState<{ name: string; base64: string } | null>(null);
  const vorschau = trpc.austausch.importVorschau.useMutation();
  const importieren = trpc.austausch.importieren.useMutation({
    onSuccess: (r) => {
      utils.customers.list.invalidate();
      navigate(`/patienten/${r.patientId}`);
    },
  });

  const waehlen = async (f: File | undefined) => {
    if (!f) return;
    const base64 = await dateiZuBase64(f);
    setDatei({ name: f.name, base64 });
    vorschau.mutate({ dateiname: f.name, base64 });
  };

  const fehler = vorschau.error ?? importieren.error;

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <input
          ref={dateiInput}
          type="file"
          accept=".age,.txt"
          className="hidden"
          onChange={(e) => waehlen(e.target.files?.[0])}
        />
        <Button variant="outline" onClick={() => dateiInput.current?.click()}>
          <FileUp className="mr-1.5 h-4 w-4" />
          {datei ? "Andere Datei …" : "Paket-Datei wählen (.age) …"}
        </Button>
        {datei && <span className="ml-3 text-sm text-neutral-600">{datei.name}</span>}
        {vorschau.isPending && (
          <span className="ml-3 text-sm text-neutral-400">wird entschlüsselt …</span>
        )}
      </section>

      {fehler && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fehler.message}
        </div>
      )}

      {vorschau.data && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-medium">Vorschau</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            <dt className="text-neutral-500">Patient</dt>
            <dd className="font-medium">{vorschau.data.patientName}</dd>
            <dt className="text-neutral-500">Geburtsdatum</dt>
            <dd>{vorschau.data.geburtsdatum ?? "—"}</dd>
            <dt className="text-neutral-500">Quell-Praxis</dt>
            <dd>{vorschau.data.quellPraxis ?? "—"}</dd>
            <dt className="text-neutral-500">Pläne / Einträge</dt>
            <dd>
              {vorschau.data.anzahlPlaene} / {vorschau.data.anzahlEintraege}
            </dd>
            <dt className="text-neutral-500">Dokumente</dt>
            <dd>{vorschau.data.anzahlDokumente}</dd>
            <dt className="text-neutral-500">Kontakte / Chronik</dt>
            <dd>
              {vorschau.data.anzahlKontakte} / {vorschau.data.anzahlTimeline}
            </dd>
          </dl>
          {vorschau.data.vorhandenerPatient && (
            <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Patient bereits im Stamm: „{vorschau.data.vorhandenerPatient.name}" — Pläne,
              Dokumente und Kontakte werden ergänzt (Dubletten werden übersprungen).
            </p>
          )}
          <Button
            className="mt-4"
            disabled={importieren.isPending}
            onClick={() => datei && importieren.mutate({ dateiname: datei.name, base64: datei.base64 })}
          >
            {importieren.isPending ? "Importiere …" : "Jetzt importieren"}
          </Button>
        </section>
      )}
    </div>
  );
}

// ── Kollegen ────────────────────────────────────────────────────────────────
function KollegenTab() {
  const utils = trpc.useUtils();
  const liste = trpc.austausch.kollegenListe.useQuery();
  const [dialog, setDialog] = useState<{ id: number | null; name: string; ageRecipient: string; notiz: string } | null>(null);
  const anlegen = trpc.austausch.kollegeAnlegen.useMutation({
    onSuccess: () => {
      utils.austausch.kollegenListe.invalidate();
      setDialog(null);
    },
  });
  const aktualisieren = trpc.austausch.kollegeUpdate.useMutation({
    onSuccess: () => {
      utils.austausch.kollegenListe.invalidate();
      setDialog(null);
    },
  });
  const setAktiv = trpc.austausch.kollegeSetAktiv.useMutation({
    onSuccess: () => utils.austausch.kollegenListe.invalidate(),
  });
  const loeschen = trpc.austausch.kollegeLoeschen.useMutation({
    onSuccess: () => utils.austausch.kollegenListe.invalidate(),
  });

  const fehler = anlegen.error ?? aktualisieren.error;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ id: null, name: "", ageRecipient: "", notiz: "" })}>
          <Plus className="mr-1.5 h-4 w-4" /> Kollegen-Praxis hinzufügen
        </Button>
      </div>
      <section className="rounded-lg border border-neutral-200 bg-white">
        {(liste.data ?? []).length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-400">
            Noch keine Kollegen-Praxen — Empfänger-Schlüssel (age1…) hier hinterlegen.
          </p>
        )}
        {(liste.data ?? []).map((k) => (
          <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 last:border-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{k.name}</span>
                {!k.aktiv && <Badge variant="secondary">inaktiv</Badge>}
              </div>
              <div className="mt-0.5 font-mono text-xs text-neutral-400">
                {k.ageRecipient.slice(0, 24)}…
                {k.notiz ? ` · ${k.notiz}` : ""}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDialog({ id: k.id, name: k.name, ageRecipient: k.ageRecipient, notiz: k.notiz ?? "" })
                }
              >
                Bearbeiten
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAktiv.mutate({ id: k.id, aktiv: !k.aktiv })}>
                {k.aktiv ? "Deaktivieren" : "Aktivieren"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => loeschen.mutate({ id: k.id })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </section>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.id ? "Kollegen-Praxis bearbeiten" : "Neue Kollegen-Praxis"}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <div>
                <Label>Name *</Label>
                <Input
                  value={dialog.name}
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  placeholder="Praxis Dr. Kühnel, Potsdam"
                />
              </div>
              <div>
                <Label>Empfänger-Schlüssel (age1…) *</Label>
                <Input
                  value={dialog.ageRecipient}
                  onChange={(e) => setDialog({ ...dialog, ageRecipient: e.target.value.trim() })}
                  placeholder="age1…"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label>Notiz</Label>
                <Input
                  value={dialog.notiz}
                  onChange={(e) => setDialog({ ...dialog, notiz: e.target.value })}
                />
              </div>
            </div>
          )}
          {fehler && <p className="text-sm text-red-600">{fehler.message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={!dialog?.name || !dialog?.ageRecipient}
              onClick={() => {
                if (!dialog) return;
                const daten = {
                  name: dialog.name.trim(),
                  ageRecipient: dialog.ageRecipient.trim(),
                  notiz: dialog.notiz.trim() || null,
                };
                if (dialog.id) aktualisieren.mutate({ id: dialog.id, data: daten });
                else anlegen.mutate(daten);
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Eigener Schlüssel ───────────────────────────────────────────────────────
function SchluesselTab() {
  const utils = trpc.useUtils();
  const schluessel = trpc.austausch.schluessel.useQuery();
  const generieren = trpc.austausch.schluesselGenerieren.useMutation({
    onSuccess: () => utils.austausch.schluessel.invalidate(),
  });
  const [kopiert, setKopiert] = useState(false);

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-neutral-500" /> Öffentlicher Schlüssel deiner Praxis
        </div>
        {schluessel.data?.recipient ? (
          <>
            <p className="mb-3 text-xs text-neutral-500">
              Diesen Schlüssel gibst du Kollegen, die dir Akten schicken wollen. Sie verschlüsseln
              damit Pakete an dich. Der geheime Gegenpart verlässt diesen Server nie.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full overflow-x-auto rounded bg-neutral-50 px-3 py-2 font-mono text-xs">
                {schluessel.data.recipient}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await kopiereInZwischenablage(schluessel.data!.recipient!);
                  setKopiert(true);
                  setTimeout(() => setKopiert(false), 2000);
                }}
              >
                <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
                {kopiert ? "Kopiert!" : "Kopieren"}
              </Button>
            </div>
            <div className="mt-4 border-t border-neutral-100 pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                disabled={generieren.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Neues Schlüsselpaar erzeugen? Pakete, die mit dem ALTEN öffentlichen Schlüssel verschlüsselt wurden, kannst du danach NICHT mehr öffnen.",
                    )
                  ) {
                    generieren.mutate();
                  }
                }}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Neu generieren (alter wird ungültig)
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-500">
              Noch kein Schlüsselpaar vorhanden — jetzt erzeugen (dauert eine Sekunde).
            </p>
            <Button onClick={() => generieren.mutate()} disabled={generieren.isPending}>
              <KeyRound className="mr-1.5 h-4 w-4" /> Schlüsselpaar erzeugen
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
