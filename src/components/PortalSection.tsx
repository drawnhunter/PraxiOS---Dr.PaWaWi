// ── PraxiOS: Patienten-Portal — Verwaltung in der Patientenakte ─────────────
import { useState } from "react";
import { kopiereInZwischenablage } from "@/lib/clipboard";
import { trpc } from "@/providers/trpc";
import { basisUrl } from "@/lib/links";
import { datum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ClipboardCopy,
  Link2,
  ShieldCheck,
  Trash2,
} from "lucide-react";

export function PortalSection({ patientId }: { patientId: number }) {
  const utils = trpc.useUtils();
  const links = trpc.portalAdmin.links.useQuery({ patientId });
  const antraege = trpc.portalAdmin.antraege.useQuery({ patientId });
  const zugriffe = trpc.portalAdmin.zugriffe.useQuery({ patientId, limit: 20 });
  const erstellen = trpc.portalAdmin.linkErstellen.useMutation({
    onSuccess: () => utils.portalAdmin.links.invalidate({ patientId }),
  });
  const loeschen = trpc.portalAdmin.linkLoeschen.useMutation({
    onSuccess: () => utils.portalAdmin.links.invalidate({ patientId }),
  });
  const bestaetigen = trpc.portalAdmin.antragBestaetigen.useMutation({
    onSuccess: () => utils.portalAdmin.antraege.invalidate({ patientId }),
  });
  const ablehnen = trpc.portalAdmin.antragAblehnen.useMutation({
    onSuccess: () => utils.portalAdmin.antraege.invalidate({ patientId }),
  });
  const [kopiert, setKopiert] = useState<number | null>(null);
  const [ablehnKommentar, setAblehnKommentar] = useState("");

  const einstellungen = trpc.settings.get.useQuery(undefined, { retry: false });
  const portalUrl = (token: string) =>
    `${basisUrl(einstellungen.data?.oeffentlicheUrl)}/portal/${token}`;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-neutral-700">
            <ShieldCheck className="h-4 w-4 text-teal-700" /> Patienten-Portal
          </h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            Link erstellen → Patient meldet sich mit Geburtsdatum an → sieht nur eigene
            Daten (Termine, Verlauf, Dokumente, Atteste, Daten, Terminanfragen). Zugriffe
            werden auditiert (DSGVO Art. 9).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={erstellen.isPending}
          onClick={() => erstellen.mutate({ patientId })}
        >
          <Link2 className="mr-1 h-4 w-4" />
          {erstellen.isPending ? "Erstelle …" : "Neuen Link erstellen (30 Tage)"}
        </Button>
      </div>

      {/* ── Links ── */}
      <div className="space-y-1.5">
        {(links.data ?? []).length === 0 && (
          <p className="text-sm text-neutral-400">Noch kein Portal-Link für diesen Patienten.</p>
        )}
        {(links.data ?? []).map((l) => {
          const abgelaufen = l.gueltigBis < new Date().toISOString().slice(0, 10);
          return (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-100 px-3 py-2">
              <div className="min-w-0 text-sm">
                <span className="font-mono text-xs text-neutral-500">{portalUrl(l.token).slice(0, 64)}…</span>
                <div className="text-xs text-neutral-400">
                  gültig bis {datum(l.gueltigBis)}
                  {abgelaufen && <span className="ml-1 text-red-500">(abgelaufen)</span>}
                  {l.letzterZugriffAm && ` · letzter Zugriff ${new Date(l.letzterZugriffAm).toLocaleString("de-DE")}`}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    kopiereInZwischenablage(portalUrl(l.token));
                    setKopiert(l.id);
                    setTimeout(() => setKopiert(null), 1500);
                  }}
                >
                  <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
                  {kopiert === l.id ? "kopiert!" : "Link kopieren"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => window.confirm("Link wirklich löschen? Der Patient kommt damit nicht mehr rein.") && loeschen.mutate({ id: l.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Datenänderungs-Anträge ── */}
      <h3 className="mb-1.5 mt-6 text-sm font-medium text-neutral-700">Datenänderungs-Anträge</h3>
      {(antraege.data ?? []).length === 0 ? (
        <p className="text-sm text-neutral-400">Keine Anträge vorhanden.</p>
      ) : (
        <div className="space-y-1.5">
          {antraege.data!.map((a) => (
            <div key={a.id} className="rounded-md border border-neutral-100 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {(JSON.parse(a.felder) as { feld: string; alt: string; neu: string }[]).map(
                    (f, i) => (
                      <span key={i} className="mr-2 inline-block">
                        <span className="text-neutral-500">{f.feld}:</span> „{f.alt || "—"}" → „{f.neu}"
                      </span>
                    ),
                  )}
                </span>
                <Badge variant={a.status === "bestaetigt" ? "default" : "outline"}>
                  {a.status === "offen" ? "offen" : a.status === "bestaetigt" ? "übernommen" : "abgelehnt"}
                </Badge>
              </div>
              {a.status === "offen" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => bestaetigen.mutate({ id: a.id })}>
                    Übernehmen (in Stammdaten)
                  </Button>
                  <Input
                    placeholder="Ablehn-Kommentar (optional)"
                    className="h-8 max-w-55 text-xs"
                    value={ablehnKommentar}
                    onChange={(e) => setAblehnKommentar(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => ablehnen.mutate({ id: a.id, kommentar: ablehnKommentar || undefined })}
                  >
                    Ablehnen
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Audit ── */}
      <h3 className="mb-1.5 mt-6 text-sm font-medium text-neutral-700">Zugriffs-Protokoll (DSGVO)</h3>
      {(zugriffe.data ?? []).length === 0 ? (
        <p className="text-sm text-neutral-400">Noch keine Zugriffe.</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto text-xs text-neutral-500">
          {zugriffe.data!.map((z) => (
            <div key={z.id} className="tabular-nums">
              {new Date(z.zeitpunkt).toLocaleString("de-DE")} — {z.bereich}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
