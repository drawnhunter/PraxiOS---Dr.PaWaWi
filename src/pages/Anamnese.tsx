import { useState } from "react";
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
import { Plus, FileDown, Link2, QrCode, ClipboardCopy } from "lucide-react";

export default function Anamnese() {
  const utils = trpc.useUtils();
  const liste = trpc.anamnese.liste.useQuery();
  const [editorOffen, setEditorOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<number | null>(null);
  const [linkDialog, setLinkDialog] = useState<number | null>(null);

  const setAktiv = trpc.anamnese.setAktiv.useMutation({
    onSuccess: () => utils.anamnese.liste.invalidate(),
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
        <Button
          onClick={() => {
            setBearbeiteId(null);
            setEditorOffen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Neuer Bogen
        </Button>
      </div>

      <div className="space-y-3">
        {(liste.data ?? []).length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-400">
            Noch keine Bögen — den ersten anlegen (z. B. „Erstanamnese“).
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

      <BogenEditor
        offen={editorOffen}
        onOpenChange={setEditorOffen}
        formId={bearbeiteId}
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
    await navigator.clipboard.writeText(urlFuer(token));
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
