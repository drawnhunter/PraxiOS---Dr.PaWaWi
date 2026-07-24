import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { datum, geld } from "@/lib/format";
import { alterAm } from "@/pages/Patients";
import { PLAN_STATUS } from "@contracts/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Pencil,
  Trash2,
} from "lucide-react";
import { PatientForm } from "@/components/PatientForm";
import { TimelineList } from "@/components/TimelineList";
import { KontakteSection } from "@/components/KontakteSection";
import { DokumentenAblage } from "@/components/DokumentenAblage";

function Zeile({ label, wert }: { label: string; wert: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm text-neutral-900">{wert?.trim() ? wert : "–"}</div>
    </div>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams();
  const patientId = Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const patient = trpc.customers.get.useQuery(
    { id: patientId },
    { enabled: Number.isInteger(patientId) && patientId > 0 },
  );
  const quote = trpc.customers.ausfallquote.useQuery(
    { id: patientId },
    { enabled: Number.isInteger(patientId) && patientId > 0 },
  );
  const plaene = trpc.plaene.list.useQuery(
    { patientId },
    { enabled: Number.isInteger(patientId) && patientId > 0 },
  );
  const ich = trpc.auth.me.useQuery(undefined, { retry: false });
  const istAdmin = ich.data?.role === "admin";

  // Rechnungen des Patienten (PraxisWerk: Akte + Abrechnung an einem Ort)
  const rechnungenAlle = trpc.invoices.list.useQuery(undefined, {
    enabled: Number.isInteger(patientId) && patientId > 0,
  });
  const rechnungen = {
    data: (rechnungenAlle.data ?? []).filter((r) => r.customerId === patientId),
  };

  const [bearbeitenOffen, setBearbeitenOffen] = useState(false);
  const [archivDialog, setArchivDialog] = useState(false);
  const [loeschDialog, setLoeschDialog] = useState(false);
  const [loeschGrund, setLoeschGrund] = useState("");

  const archivieren = trpc.customers.setArchiviert.useMutation({
    onSuccess: () => {
      utils.customers.get.invalidate({ id: patientId });
      utils.customers.list.invalidate();
      setArchivDialog(false);
    },
  });
  const loeschen = trpc.customers.loeschen.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      navigate("/patienten");
    },
  });

  if (patient.isLoading) {
    return <p className="text-sm text-neutral-500">Lade Patientenakte …</p>;
  }
  if (patient.error || !patient.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">
          {patient.error?.message ?? "Patient nicht gefunden."}
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/patienten")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  const p = patient.data;
  const alter = alterAm(p.geburtsdatum);
  const adresse = [p.strasse, [p.plz, p.ort].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const tags = (p.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* ── Kopf ── */}
      <div>
        <Link
          to="/patienten"
          className="mb-2 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Alle Patienten
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {p.name}
              {p.archiviert && (
                <>
                  {" "}
                  <Badge variant="secondary">archiviert</Badge>
                </>
              )}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <span>Patienten-Nr.: {p.patientenNr ?? "–"}</span>
              {tags.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setBearbeitenOffen(true)}>
              <Pencil className="mr-1 h-4 w-4" /> Bearbeiten
            </Button>
            <Button variant="outline" size="sm" onClick={() => setArchivDialog(true)}>
              {p.archiviert ? (
                <>
                  <ArchiveRestore className="mr-1 h-4 w-4" /> Wiederherstellen
                </>
              ) : (
                <>
                  <Archive className="mr-1 h-4 w-4" /> Archivieren
                </>
              )}
            </Button>
            {istAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setLoeschDialog(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Löschen
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stammdaten ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-neutral-700">Stammdaten</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Zeile
            label="Geburtsdatum"
            wert={
              p.geburtsdatum
                ? `${datum(p.geburtsdatum)}${alter !== null ? ` (${alter} Jahre)` : ""}`
                : null
            }
          />
          <Zeile label="Adresse" wert={adresse || null} />
          <Zeile label="Telefon" wert={p.telefon} />
          <Zeile label="E-Mail" wert={p.email} />
          <Zeile label="Krankenkasse" wert={p.krankenkasse} />
          <Zeile label="Versichertennummer" wert={p.versichertennummer} />
          <Zeile
            label="Ärztlicher Ansprechpartner"
            wert={p.aerztlicherAnsprechpartner}
          />
        </div>
        {p.notizen && (
          <div className="mt-4 border-t border-neutral-100 pt-3">
            <div className="text-xs text-neutral-500">Notizen</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
              {p.notizen}
            </p>
          </div>
        )}
      </section>

      {/* ── Ausfallquote ── */}
      {quote.data && quote.data.gesamt > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-medium text-neutral-700">Ausfallquote</h2>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold tracking-tight">
              {quote.data.quoteProzent} %
            </span>
            <span className="text-sm text-neutral-500">
              {quote.data.abgesagt + quote.data.ausgefallen} von {quote.data.gesamt}{" "}
              Terminen abgesagt/ausgefallen
            </span>
          </div>
        </section>
      )}

      {/* ── Sektionen ── */}
      <Tabs defaultValue="verlauf">
        <TabsList>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
          <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
          <TabsTrigger value="kontakte">Kontakte</TabsTrigger>
          <TabsTrigger value="plaene">Therapiepläne</TabsTrigger>
          <TabsTrigger value="rechnungen">Rechnungen</TabsTrigger>
        </TabsList>

        <TabsContent value="verlauf">
          <TimelineList patientId={patientId} ereignisse={p.timeline} />
        </TabsContent>

        <TabsContent value="dokumente">
          <DokumentenAblage patientId={patientId} />
        </TabsContent>

        <TabsContent value="kontakte">
          <KontakteSection patientId={patientId} kontakte={p.kontakte} />
        </TabsContent>

        <TabsContent value="plaene">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            {plaene.isLoading ? (
              <p className="text-sm text-neutral-500">Lade Therapiepläne …</p>
            ) : (plaene.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">
                Noch keine Therapiepläne für diesen Patienten.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                      <th className="px-2 py-2 font-medium">Titel</th>
                      <th className="px-2 py-2 font-medium">Zeitraum</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(plaene.data ?? []).map((plan) => (
                      <tr
                        key={plan.id}
                        className="border-b border-neutral-100 last:border-0"
                      >
                        <td className="px-2 py-2.5 font-medium">
                          <Link
                            to={`/plaene/${plan.id}`}
                            className="text-neutral-900 underline-offset-2 hover:underline"
                          >
                            {plan.titel?.trim() || `Therapieplan #${plan.id}`}
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 text-neutral-600">
                          {datum(plan.vonDatum)} – {datum(plan.bisDatum)}
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge
                            variant={
                              plan.status === "aktiv" ? "default" : "secondary"
                            }
                          >
                            {PLAN_STATUS[plan.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="rechnungen">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            {(rechnungen.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">
                Noch keine Rechnungen für diesen Patienten.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                      <th className="px-2 py-2 font-medium">Nummer</th>
                      <th className="px-2 py-2 font-medium">Datum</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 text-right font-medium">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rechnungen.data ?? []).map((r) => (
                      <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-2 py-2.5 font-medium">
                          <Link
                            to={`/rechnungen/${r.id}`}
                            className="text-neutral-900 underline-offset-2 hover:underline"
                          >
                            {r.nummer ?? `Entwurf #${r.id}`}
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 text-neutral-600">{datum(r.rechnungsdatum)}</td>
                        <td className="px-2 py-2.5">
                          <Badge variant={r.status === "entwurf" ? "secondary" : "default"}>
                            {r.status === "entwurf"
                              ? "Entwurf"
                              : r.status === "storniert"
                                ? "Storniert"
                                : Number(r.bezahltBetrag) >= Number(r.brutto)
                                  ? "Bezahlt"
                                  : "Offen"}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{geld(r.brutto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {/* ── Dialoge ── */}
      <PatientForm
        offen={bearbeitenOffen}
        onOpenChange={setBearbeitenOffen}
        patient={p}
      />

      <AlertDialog open={archivDialog} onOpenChange={setArchivDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {p.archiviert ? "Patient wiederherstellen?" : "Patient archivieren?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {p.archiviert
                ? `${p.name} erscheint wieder in der aktiven Patientenliste.`
                : `${p.name} wird aus der aktiven Patientenliste ausgeblendet. Alle Daten bleiben erhalten und können jederzeit wiederhergestellt werden.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                archivieren.mutate({ id: patientId, archiviert: !p.archiviert })
              }
              disabled={archivieren.isPending}
            >
              {p.archiviert ? "Wiederherstellen" : "Archivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={loeschDialog} onOpenChange={setLoeschDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Patient endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-red-700">
                Achtung: Das Löschen ist endgültig und unwiderruflich (DSGVO,
                Art. 17).
              </strong>{" "}
              Die komplette Patientenakte von {p.name} wird
              entfernt — inklusive aller Therapiepläne, Termine, Dokumente
              (Dateien), Kontakte und Verlaufseinträge. Im Löschprotokoll
              verbleibt nur ein pseudonymisierter Nachweis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label>Grund der Löschung (optional, fürs Löschprotokoll)</Label>
            <Input
              value={loeschGrund}
              onChange={(e) => setLoeschGrund(e.target.value)}
              placeholder="z. B. Löschantrag des Patienten vom …"
            />
          </div>
          {loeschen.error && (
            <p className="text-sm text-red-600">{loeschen.error.message}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                loeschen.mutate({
                  id: patientId,
                  grund: loeschGrund.trim() || undefined,
                })
              }
              disabled={loeschen.isPending}
            >
              {loeschen.isPending ? "Lösche …" : "Endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
