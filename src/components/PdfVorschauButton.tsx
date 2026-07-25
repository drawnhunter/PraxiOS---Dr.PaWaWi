import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { pdfHerunterladen } from "@/lib/downloads";
import { PdfCanvasVorschau } from "@/components/PdfCanvasVorschau";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, FileDown, Loader2, X } from "lucide-react";

/**
 * Beleg-Vorschau (Rechnung/Gutschrift): erzeugt das PDF per tRPC und zeigt
 * es per pdf.js-Canvas im Dialog — funktioniert auch auf dem Handy.
 */
export function PdfVorschauButton({
  art,
  id,
  titel,
}: {
  art: "invoice" | "credit";
  id: number;
  titel?: string;
}) {
  const utils = trpc.useUtils();
  const [offen, setOffen] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [antwort, setAntwort] = useState<{ dateiname: string; base64: string } | null>(null);

  useEffect(() => {
    if (!offen) {
      setBytes(null);
      setAntwort(null);
      setFehler(null);
    }
  }, [offen]);

  const laden = async () => {
    setOffen(true);
    setLaedt(true);
    setFehler(null);
    try {
      const r = await utils.pdf[art].fetch({ id });
      const bin = atob(r.base64);
      const b = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
      setAntwort(r);
      setBytes(b);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "PDF konnte nicht erzeugt werden.");
    } finally {
      setLaedt(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={laden}>
        <Eye className="mr-1.5 h-4 w-4" /> Vorschau
      </Button>
      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent className="flex h-[92vh] w-[95vw] max-w-4xl flex-col p-4">
          <DialogHeader className="flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-medium">
              {titel ?? "Beleg-Vorschau"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {antwort && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => antwort && pdfHerunterladen(antwort)}
                >
                  <FileDown className="mr-1 h-4 w-4" /> Herunterladen
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setOffen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {laedt && (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> PDF wird erzeugt …
              </div>
            )}
            {fehler && (
              <div className="flex h-full items-center justify-center text-sm text-red-600">
                {fehler}
              </div>
            )}
            {bytes && !laedt && <PdfCanvasVorschau bytes={bytes} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
