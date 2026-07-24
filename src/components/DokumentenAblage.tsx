import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { trpc } from "@/providers/trpc";
import type { Dokument } from "@db/schema";
import { DOKUMENT_KATEGORIEN, type DokumentKategorie } from "@contracts/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Camera,
  Download,
  Eye,
  FileText,
  Paperclip,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ERLAUBTE_ENDUNGEN = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "heic"];

function groesseFmt(bytes: number | null): string {
  if (bytes == null) return "–";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

function datumFmt(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function istPdf(doc: Dokument): boolean {
  return (
    doc.mimeType === "application/pdf" ||
    doc.dateiname.toLowerCase().endsWith(".pdf")
  );
}

interface Props {
  patientId: number;
}

export function DokumentenAblage({ patientId }: Props) {
  const utils = trpc.useUtils();
  const dokumente = trpc.dokumente.list.useQuery({ patientId });

  const dateiInput = useRef<HTMLInputElement>(null);
  const fotoInput = useRef<HTMLInputElement>(null);
  const [kategorie, setKategorie] = useState<DokumentKategorie>("sonstiges");
  const [notiz, setNotiz] = useState("");
  const [dragAktiv, setDragAktiv] = useState(false);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [uploadFehler, setUploadFehler] = useState("");

  const [vorschau, setVorschau] = useState<Dokument | null>(null);
  const [bearbeiten, setBearbeiten] = useState<Dokument | null>(null);
  const [bearbKategorie, setBearbKategorie] = useState<DokumentKategorie>("sonstiges");
  const [bearbNotiz, setBearbNotiz] = useState("");
  const [loeschKandidat, setLoeschKandidat] = useState<Dokument | null>(null);

  const aktualisieren = trpc.dokumente.update.useMutation({
    onSuccess: () => {
      utils.dokumente.list.invalidate({ patientId });
      setBearbeiten(null);
    },
  });
  const entfernen = trpc.dokumente.loeschen.useMutation({
    onSuccess: () => {
      utils.dokumente.list.invalidate({ patientId });
      setLoeschKandidat(null);
    },
  });

  const hochladen = async (datei: File) => {
    const endung = (datei.name.split(".").pop() ?? "").toLowerCase();
    if (!ERLAUBTE_ENDUNGEN.includes(endung)) {
      setUploadFehler(
        `Dateityp „.${endung}“ nicht erlaubt (nur: ${ERLAUBTE_ENDUNGEN.join(", ")}).`,
      );
      return;
    }
    setUploadFehler("");
    setLaedtHoch(true);
    try {
      const form = new FormData();
      form.append("datei", datei);
      form.append("patientId", String(patientId));
      form.append("kategorie", kategorie);
      if (notiz.trim()) form.append("notiz", notiz.trim());
      const antwort = await fetch("/api/dokumente", {
        method: "POST",
        body: form,
      });
      if (!antwort.ok) {
        const daten = (await antwort.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(daten?.error ?? `Upload fehlgeschlagen (${antwort.status}).`);
      }
      setNotiz("");
      utils.dokumente.list.invalidate({ patientId });
      utils.customers.get.invalidate({ id: patientId });
    } catch (e) {
      setUploadFehler(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
    } finally {
      setLaedtHoch(false);
      if (dateiInput.current) dateiInput.current.value = "";
      if (fotoInput.current) fotoInput.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragAktiv(false);
    const datei = e.dataTransfer.files?.[0];
    if (datei) hochladen(datei);
  };

  const bearbeitenOeffnen = (doc: Dokument) => {
    setBearbeiten(doc);
    setBearbKategorie(doc.kategorie);
    setBearbNotiz(doc.notiz ?? "");
  };

  return (
    <section className="space-y-4">
      {/* ── Upload-Zone ── */}
      <div
        className={cn(
          "rounded-lg border-2 border-dashed bg-white p-5 transition-colors",
          dragAktiv ? "border-neutral-500 bg-neutral-50" : "border-neutral-300",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragAktiv(true);
        }}
        onDragLeave={() => setDragAktiv(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Upload className="h-6 w-6 text-neutral-400" />
          <p className="text-sm text-neutral-600">
            Datei hierher ziehen oder auswählen — Befunde, Arztbriefe, Rezepte
            hier ablegen
          </p>
          <p className="text-xs text-neutral-400">
            Erlaubt: {ERLAUBTE_ENDUNGEN.join(", ")}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Kategorie</Label>
            <Select
              value={kategorie}
              onValueChange={(v) => setKategorie(v as DokumentKategorie)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOKUMENT_KATEGORIEN).map(([wert, label]) => (
                  <SelectItem key={wert} value={wert}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notiz (optional)</Label>
            <Input
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="z. B. Laborwerte vom Hausarzt"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={laedtHoch}
            onClick={() => dateiInput.current?.click()}
          >
            <Paperclip className="mr-1 h-4 w-4" /> Datei wählen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            disabled={laedtHoch}
            onClick={() => fotoInput.current?.click()}
          >
            <Camera className="mr-1 h-4 w-4" /> Foto aufnehmen
          </Button>
          {laedtHoch && (
            <span className="text-sm text-neutral-500">Wird hochgeladen …</span>
          )}
          {uploadFehler && (
            <span className="text-sm text-red-600">{uploadFehler}</span>
          )}
        </div>
        <input
          ref={dateiInput}
          type="file"
          className="hidden"
          accept={ERLAUBTE_ENDUNGEN.map((e) => `.${e}`).join(",")}
          onChange={(e) => {
            const datei = e.target.files?.[0];
            if (datei) hochladen(datei);
          }}
        />
        <input
          ref={fotoInput}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const datei = e.target.files?.[0];
            if (datei) hochladen(datei);
          }}
        />
      </div>

      {/* ── Dokumentenliste ── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-neutral-700">Dokumente</h2>
        {dokumente.isLoading ? (
          <p className="text-sm text-neutral-500">Lade Dokumente …</p>
        ) : dokumente.error ? (
          <p className="text-sm text-red-600">{dokumente.error.message}</p>
        ) : (dokumente.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FileText className="h-8 w-8 text-neutral-300" />
            <p className="text-sm text-neutral-500">
              Noch keine Dokumente — Befunde, Arztbriefe, Rezepte hier ablegen.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="px-2 py-2 font-medium">Dateiname</th>
                  <th className="px-2 py-2 font-medium">Kategorie</th>
                  <th className="px-2 py-2 font-medium">Größe</th>
                  <th className="px-2 py-2 font-medium">Hochgeladen</th>
                  <th className="px-2 py-2 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {(dokumente.data ?? []).map((doc) => {
                  const dateiUrl = `/api/dokumente/${doc.id}/datei`;
                  return (
                    <tr
                      key={doc.id}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-2 py-2.5 font-medium">
                        <span className="break-all">{doc.dateiname}</span>
                        {doc.notiz && (
                          <div className="mt-0.5 text-xs font-normal text-neutral-500">
                            {doc.notiz}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge variant="secondary">
                          {DOKUMENT_KATEGORIEN[doc.kategorie]}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5 text-neutral-600">
                        {groesseFmt(doc.groesse)}
                      </td>
                      <td className="px-2 py-2.5 text-neutral-600">
                        {datumFmt(doc.createdAt)}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Vorschau"
                            onClick={() => setVorschau(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" asChild title="Herunterladen">
                            <a href={dateiUrl} download={doc.dateiname}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Bearbeiten"
                            onClick={() => bearbeitenOeffnen(doc)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Löschen"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setLoeschKandidat(doc)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Vorschau-Dialog ── */}
      <Dialog open={vorschau !== null} onOpenChange={(o) => !o && setVorschau(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{vorschau?.dateiname}</DialogTitle>
          </DialogHeader>
          {vorschau &&
            (istPdf(vorschau) ? (
              <iframe
                src={`/api/dokumente/${vorschau.id}/datei`}
                className="h-[70vh] w-full"
                title={vorschau.dateiname}
              />
            ) : (
              <img
                src={`/api/dokumente/${vorschau.id}/datei`}
                alt={vorschau.dateiname}
                className="max-h-[70vh] w-full object-contain"
              />
            ))}
        </DialogContent>
      </Dialog>

      {/* ── Bearbeiten-Dialog ── */}
      <Dialog open={bearbeiten !== null} onOpenChange={(o) => !o && setBearbeiten(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dokument bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Kategorie</Label>
              <Select
                value={bearbKategorie}
                onValueChange={(v) => setBearbKategorie(v as DokumentKategorie)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOKUMENT_KATEGORIEN).map(([wert, label]) => (
                    <SelectItem key={wert} value={wert}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notiz</Label>
              <Input
                value={bearbNotiz}
                onChange={(e) => setBearbNotiz(e.target.value)}
              />
            </div>
          </div>
          {aktualisieren.error && (
            <p className="text-sm text-red-600">{aktualisieren.error.message}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBearbeiten(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={aktualisieren.isPending}
              onClick={() =>
                bearbeiten &&
                aktualisieren.mutate({
                  id: bearbeiten.id,
                  data: {
                    kategorie: bearbKategorie,
                    notiz: bearbNotiz.trim() || null,
                  },
                })
              }
            >
              {aktualisieren.isPending ? "Speichere …" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lösch-Dialog ── */}
      <AlertDialog
        open={loeschKandidat !== null}
        onOpenChange={(o) => !o && setLoeschKandidat(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{loeschKandidat?.dateiname}“ wird endgültig gelöscht — die Datei
              wird auch vom Server entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {entfernen.error && (
            <p className="text-sm text-red-600">{entfernen.error.message}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={entfernen.isPending}
              onClick={() =>
                loeschKandidat && entfernen.mutate({ id: loeschKandidat.id })
              }
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
