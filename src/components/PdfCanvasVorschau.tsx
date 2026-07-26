import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * PDF-Vorschau per pdf.js (Canvas) — funktioniert auch auf dem Handy,
 * wo iframes keine PDFs rendern. Worker wird lokal gebündelt (offline-fähig).
 */
export function PdfCanvasVorschau({ bytes }: { bytes: Uint8Array }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [seiten, setSeiten] = useState(0);
  const [seite, setSeite] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [laedt, setLaedt] = useState(true);
  const docRef = useRef<{ getPage: (n: number) => Promise<unknown>; numPages: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dokument laden (dynamischer Import — hält das Anfangsbundle klein)
  useEffect(() => {
    let abbruch = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const kopie = new Uint8Array(bytes); // pdf.js übernimmt den Buffer (transfer)
        const doc = await pdfjs.getDocument({ data: kopie }).promise;
        if (abbruch) return;
        docRef.current = doc as unknown as typeof docRef.current;
        setSeiten(doc.numPages);
        setLaedt(false);
      } catch (e) {
        if (!abbruch) {
          setFehler(e instanceof Error ? e.message : "PDF konnte nicht gelesen werden.");
          setLaedt(false);
        }
      }
    })();
    return () => {
      abbruch = true;
    };
  }, [bytes]);

  // Seite rendern
  useEffect(() => {
    if (!docRef.current || seiten === 0) return;
    let abbruch = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seite_ = (await docRef.current!.getPage(seite)) as any;
      if (abbruch || !canvasRef.current || !containerRef.current) return;
      const breite = containerRef.current.clientWidth;
      const basis = seite_.getViewport({ scale: 1 });
      const skala = (breite / basis.width) * zoom * (window.devicePixelRatio || 1);
      const viewport = seite_.getViewport({ scale: skala });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${Math.floor(basis.width * (breite / basis.width) * zoom)}px`;
      canvas.style.height = "auto";
      const ctx = canvas.getContext("2d")!;
      await seite_.render({ canvasContext: ctx, viewport, canvas }).promise;
    })();
    return () => {
      abbruch = true;
    };
  }, [seite, seiten, zoom, bytes]);

  if (fehler) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-600">
        {fehler}
      </div>
    );
  }
  if (laedt) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> PDF wird gerendert …
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={seite <= 1}
            onClick={() => setSeite(seite - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums text-neutral-600">
            Seite {seite} / {seiten}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={seite >= seiten}
            onClick={() => setSeite(seite + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={zoom <= 0.6}
            onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={zoom >= 2.6}
            onClick={() => setZoom(Math.min(2.8, zoom + 0.2))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto rounded-md bg-neutral-200 p-2">
        <canvas ref={canvasRef} className="mx-auto block rounded shadow" />
      </div>
    </div>
  );
}
