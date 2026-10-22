// ── PraxiOS: Kostenplan — Detail-Seite (1.27.0) ────────────────────────────
// Direktes Öffnen über die Nummer (Register). Alle Sektionen + Aktionen.
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { pdfHerunterladen } from "@/lib/downloads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KostenplanEditorDialog } from "@/components/KostenplanEditor";
import {
  ArrowLeft,
  Copy,
  FileDown,
  FileText,
  Lock,
  Pencil,
  Trash2,
} from "lucide-react";

const geld = (v: number | string) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));

export default function KostenplanDetail() {
  const { id } = useParams();
  const planId = Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const p = trpc.kostenplaene.byId.useQuery({ id: planId }, { enabled: Number.isFinite(planId) });
  const [bearbeiten, setBearbeiten] = useState(false);
  const [loeschenOffen, setLoeschenOffen] = useState(false);

  const neuLaden = () => utils.kostenplaene.byId.invalidate({ id: planId });
  const finalisieren = trpc.kostenplaene.finalisieren.useMutation({ onSuccess: neuLaden });
  const duplizieren = trpc.kostenplaene.duplizieren.useMutation({
    onSuccess: (r) => navigate(`/kostenplaene/${r.id}`),
  });
  const loeschen = trpc.kostenplaene.loeschen.useMutation({
    onSuccess: () => navigate("/kostenplaene"),
  });

  if (p.isLoading) return <p className="text-sm text-neutral-500">Lade …</p>;
  if (p.isError || !p.data) return <p className="text-sm text-red-600">{p.error?.message ?? "Kostenplan nicht gefunden."}</p>;

  const plan = p.data;
  const diagnosen = plan.diagnosenJson ? JSON.parse(plan.diagnosenJson) : [];
  const istHkp = diagnosen.length > 0 || Boolean(plan.begruendung);
  const summeNetto = plan.positionen.reduce((a, x) => a + Number(x.menge) * Number(x.einzelpreis), 0);
  const summeUst = plan.positionen.reduce((a, x) => a + Number(x.menge) * Number(x.einzelpreis) * (x.ustSatz / 100), 0);

  const herunterladen = async (art: "pdf" | "docx") => {
    const r = art === "pdf"
      ? await utils.kostenplaene.pdf.fetch({ id: planId })
      : await utils.kostenplaene.docx.fetch({ id: planId });
    pdfHerunterladen({ dateiname: r.dateiname, base64: r.base64 });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/kostenplaene")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Register
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{plan.titel}</h1>
            {istHkp && <Badge variant="outline" className="border-amber-300 text-amber-800">HKP</Badge>}
            <Badge variant="outline" className={plan.status === "finalisiert" ? "border-amber-300 text-amber-800" : ""}>
              {plan.status === "finalisiert" ? `final ${plan.nummer}` : "Entwurf"}
            </Badge>
          </div>
          <div className="mt-0.5 text-xs text-neutral-400">
            {plan.patient?.name} · {plan.nummer ?? `Entwurf #${plan.id}`} · erstellt {new Date(plan.createdAt).toLocaleDateString("de-DE")}
            {(plan.zeitraumVon || plan.zeitraumBis) && ` · Zeitraum ${datum(plan.zeitraumVon)}–${datum(plan.zeitraumBis)}`}
          </div>
        </div>
      </div>

      <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6">
        {diagnosen.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-sm font-medium text-neutral-700">Diagnosen (ICD-10)</h3>
            <div className="space-y-1.5">
              {diagnosen.map((d: { code: string; text: string; kurzbegruendung?: string }) => (
                <div key={d.code} className="text-sm">
                  <span className="font-mono font-semibold">{d.code}</span> — {d.text}
                  {d.kurzbegruendung && <div className="text-xs italic text-neutral-400">{d.kurzbegruendung}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {plan.begruendung && (
          <section>
            <h3 className="mb-1.5 text-sm font-medium text-neutral-700">Pathophysiologische Begründung</h3>
            <p className="whitespace-pre-line text-sm text-neutral-700">{plan.begruendung}</p>
          </section>
        )}

        <section>
          <h3 className="mb-1.5 text-sm font-medium text-neutral-700">Kostenaufstellung</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                <th className="py-1.5 font-medium">Bezeichnung</th>
                <th className="py-1.5 font-medium text-right">Menge</th>
                <th className="py-1.5 font-medium text-right">Preis</th>
                <th className="py-1.5 font-medium text-right">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {plan.positionen.map((x) => (
                <tr key={x.id} className="border-b border-neutral-50">
                  <td className="py-1.5">
                    <div className="font-medium">{x.bezeichnung}</div>
                    {(x.gruppe || x.goaeText || x.beschreibung) && (
                      <div className="text-xs text-neutral-400">
                        {[x.gruppe, x.goaeText, x.beschreibung].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(Number(x.menge))} {x.einheit}</td>
                  <td className="py-1.5 text-right tabular-nums">{geld(x.einzelpreis)} €</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{geld(Number(x.menge) * Number(x.einzelpreis))} €</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200">
                <td colSpan={3} className="py-1.5 text-right text-sm text-neutral-500">Summe netto</td>
                <td className="py-1.5 text-right font-medium tabular-nums">{geld(summeNetto)} €</td>
              </tr>
              {summeUst > 0.005 && (
                <tr>
                  <td colSpan={3} className="py-1.5 text-right text-sm text-neutral-500">Umsatzsteuer</td>
                  <td className="py-1.5 text-right tabular-nums">{geld(summeUst)} €</td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="py-1.5 text-right text-sm font-semibold text-amber-800">Gesamtkosten</td>
                <td className="py-1.5 text-right font-semibold tabular-nums">{geld(summeNetto + summeUst)} €</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {plan.klartextNote && (
          <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">{plan.klartextNote}</p>
        )}

        <p className="border-t border-neutral-100 pt-3 text-[11px] leading-snug text-neutral-400">
          Dieser Kostenplan wurde auf Wunsch des Patienten erstellt. Die aufgeführten Leistungen werden,
          soweit sie das Maß der medizinisch notwendigen Versorgung überschreiten, als privatärztliche
          Wunsch- und Verlangensleistung nach § 1 Abs. 2 GOÄ erbracht (vgl. § 630c Abs. 3 BGB). Eine
          Kostenübernahme durch die gesetzliche Krankenkasse ist nicht beantragt bzw. liegt nicht vor;
          eine vollständige oder teilweise Kostenübernahme durch gesetzliche oder private
          Krankenversicherungen kann nicht garantiert werden.
        </p>

        {/* Aktionen */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-4">
          <Button variant="outline" size="sm" onClick={() => herunterladen("pdf")}>
            <FileDown className="mr-1 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => herunterladen("docx")}>
            <FileText className="mr-1 h-4 w-4" /> Word
          </Button>
          {plan.status === "entwurf" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setBearbeiten(true)}>
                <Pencil className="mr-1 h-4 w-4" /> Bearbeiten
              </Button>
              <Button size="sm" className="bg-amber-700 hover:bg-amber-800"
                onClick={() => window.confirm("Kostenplan finalisieren? Er wird unveränderbar, bekommt eine HKP-Nummer und liegt als PDF in der Akte.") && finalisieren.mutate({ id: planId })}>
                <Lock className="mr-1 h-4 w-4" /> Finalisieren
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setLoeschenOffen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => duplizieren.mutate({ id: planId })}>
              <Copy className="mr-1 h-4 w-4" /> Als Vorlage duplizieren
            </Button>
          )}
        </div>
      </div>

      <KostenplanEditorDialog
        offen={bearbeiten ? planId : null}
        onSchliessen={() => setBearbeiten(false)}
        onGespeichert={() => { setBearbeiten(false); neuLaden(); }}
      />

      {loeschenOffen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold">Entwurf löschen?</h3>
            <p className="mt-1 text-sm text-neutral-500">Der Kostenplan-Entwurf wird entfernt.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setLoeschenOffen(false)}>Abbrechen</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => loeschen.mutate({ id: planId })}>Löschen</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
