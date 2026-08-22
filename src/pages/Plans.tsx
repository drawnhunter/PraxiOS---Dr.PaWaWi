import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { PLAN_STATUS, type PlanStatus } from "@contracts/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import { datumZuKw, heuteIso } from "./Kalender";

/** Badge-Farben je Planstatus (geplant neutral, aktiv petrol, dokumentiert blau, abgerechnet dezent). */
export function planStatusKlasse(status: PlanStatus): string {
  switch (status) {
    case "aktiv":
      return "bg-primary/10 text-primary border-primary/30";
    case "dokumentiert":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "abgerechnet":
      return "bg-neutral-100 text-neutral-500 border-neutral-200";
    default:
      return "bg-neutral-50 text-neutral-700 border-neutral-200";
  }
}

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", planStatusKlasse(status))}>
      {PLAN_STATUS[status]}
    </Badge>
  );
}

interface PlanForm {
  patientId: string;
  vonDatum: string;
  bisDatum: string;
  titel: string;
  diagnoseZiele: string;
  abweichend: boolean;
  abweichenderEmpfaenger: string;
  notizen: string;
}

export default function Plans() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [suche, setSuche] = useState("");
  const [dialogOffen, setDialogOffen] = useState(false);

  const heute = heuteIso();
  const [form, setForm] = useState<PlanForm>({
    patientId: "",
    vonDatum: heute,
    bisDatum: heute,
    titel: "",
    diagnoseZiele: "",
    abweichend: false,
    abweichenderEmpfaenger: "",
    notizen: "",
  });

  const utils = trpc.useUtils();
  const istPapierkorb = statusFilter === "geloescht";
  const plaene = trpc.plaene.list.useQuery({
    status: istPapierkorb || statusFilter === "alle" ? undefined : (statusFilter as PlanStatus),
    geloescht: istPapierkorb,
  });
  const loeschen = trpc.plaene.loeschen.useMutation({
    onSuccess: () => utils.plaene.list.invalidate(),
  });

  // ── Plan duplizieren (Patient + Zeitfenster vorab wählbar) ──
  const [dup, setDup] = useState<{
    planId: number;
    titel: string;
    patientId: string;
    vonDatum: string;
    bisDatum: string;
  } | null>(null);
  const duplizieren = trpc.plaene.planDuplizieren.useMutation({
    onSuccess: (r) => {
      setDup(null);
      utils.plaene.list.invalidate();
      navigate(`/plaene/${r.id}`);
    },
  });
  const patientenListe = trpc.customers.list.useQuery();
  const wiederherstellen = trpc.plaene.wiederherstellen.useMutation({
    onSuccess: () => utils.plaene.list.invalidate(),
  });
  const patienten = trpc.customers.list.useQuery({});

  const anlegen = trpc.plaene.create.useMutation({
    onSuccess: (r) => {
      utils.plaene.list.invalidate();
      setDialogOffen(false);
      navigate(`/plaene/${r.id}`);
    },
  });

  const gefiltert = useMemo(() => {
    const liste = plaene.data ?? [];
    const q = suche.trim().toLowerCase();
    if (!q) return liste;
    return liste.filter((p) =>
      p.patient.name.toLowerCase().includes(q),
    );
  }, [plaene.data, suche]);

  const titelPlatzhalter = `Therapieplan KW ${datumZuKw(heute).kw}`;

  const absenden = () => {
    anlegen.mutate({
      patientId: Number(form.patientId),
      vonDatum: form.vonDatum,
      bisDatum: form.bisDatum,
      // Leer = automatischer Titel („Therapieplan KW n“)
      titel: form.titel || titelPlatzhalter,
      diagnoseZiele: form.diagnoseZiele || null,
      rechnungsempfaengerAbweichend: form.abweichend,
      abweichenderEmpfaenger: form.abweichend
        ? form.abweichenderEmpfaenger || null
        : null,
      notizen: form.notizen || null,
    });
  };

  const formGueltig =
    form.patientId !== "" && form.vonDatum !== "" && form.bisDatum !== "";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Therapiepläne</h1>
        <Button onClick={() => setDialogOffen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Neuer Therapieplan
        </Button>
      </div>

      {/* ── Filter ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            className="pl-9"
            placeholder="Patient suchen …"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            <SelectItem value="geloescht">Gelöschte (Papierkorb)</SelectItem>
            {(Object.keys(PLAN_STATUS) as PlanStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {PLAN_STATUS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabelle ── */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Titel</th>
              <th className="px-4 py-2.5 font-medium">Patient</th>
              <th className="px-4 py-2.5 font-medium">Zeitraum</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  {istPapierkorb ? "Papierkorb ist leer." : "Keine Therapiepläne gefunden."}
                </td>
              </tr>
            )}
            {gefiltert.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2.5">
                  <Link
                    to={`/plaene/${p.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {p.titel ?? `Therapieplan #${p.id}`}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-neutral-700">
                  {p.patient.name}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                  {datum(p.vonDatum)}–{datum(p.bisDatum)}
                </td>
                <td className="px-4 py-2.5">
                  <PlanStatusBadge status={p.status} />
                  {p.geloeschtAm && (
                    <div className="mt-1 text-xs text-neutral-400">
                      gelöscht {new Date(p.geloeschtAm).toLocaleString("de-DE")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {!p.geloeschtAm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Plan duplizieren (Patient/Zeitfenster wählbar)"
                      onClick={() =>
                        setDup({
                          planId: p.id,
                          titel: p.titel ?? `Therapieplan #${p.id}`,
                          patientId: String(p.patient.id),
                          vonDatum: p.vonDatum,
                          bisDatum: p.bisDatum,
                        })
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  {p.geloeschtAm ? (
                    p.restorable && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => wiederherstellen.mutate({ id: p.id })}
                      >
                        Wiederherstellen
                      </Button>
                    )
                  ) : p.status !== "abgerechnet" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      title="In den Papierkorb legen (48 h wiederherstellbar)"
                      onClick={() => {
                        if (window.confirm(`Plan „${p.titel ?? `#${p.id}`}“ in den Papierkorb legen? (48 h wiederherstellbar)`)) {
                          loeschen.mutate({ id: p.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Dialog: Neuer Therapieplan ── */}
      <Dialog open={dialogOffen} onOpenChange={setDialogOffen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuer Therapieplan</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2">
              <Label>Patient *</Label>
              <Select
                value={form.patientId}
                onValueChange={(v) => setForm({ ...form, patientId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Patient auswählen …" />
                </SelectTrigger>
                <SelectContent>
                  {(patienten.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                      {p.patientenNr ? ` (Nr. ${p.patientenNr})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Von *</Label>
              <Input
                type="date"
                value={form.vonDatum}
                onChange={(e) => setForm({ ...form, vonDatum: e.target.value })}
              />
            </div>
            <div>
              <Label>Bis *</Label>
              <Input
                type="date"
                value={form.bisDatum}
                onChange={(e) => setForm({ ...form, bisDatum: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Titel</Label>
              <Input
                value={form.titel}
                onChange={(e) => setForm({ ...form, titel: e.target.value })}
                placeholder={titelPlatzhalter}
              />
              <p className="mt-1 text-xs text-neutral-400">
                Leer lassen — der Titel wird automatisch vergeben.
              </p>
            </div>
            <div className="col-span-2">
              <Label>Diagnose / Ziele</Label>
              <Textarea
                rows={3}
                value={form.diagnoseZiele}
                onChange={(e) => setForm({ ...form, diagnoseZiele: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Checkbox
                id="abweichend"
                checked={form.abweichend}
                onCheckedChange={(v) => setForm({ ...form, abweichend: v === true })}
              />
              <Label htmlFor="abweichend" className="cursor-pointer">
                Rechnungsempfänger abweichend
              </Label>
            </div>
            {form.abweichend && (
              <div className="col-span-2">
                <Label>Abweichender Empfänger (Name, Straße, PLZ Ort)</Label>
                <Textarea
                  rows={3}
                  value={form.abweichenderEmpfaenger}
                  onChange={(e) =>
                    setForm({ ...form, abweichenderEmpfaenger: e.target.value })
                  }
                />
              </div>
            )}
            <div className="col-span-2">
              <Label>Notizen</Label>
              <Textarea
                rows={2}
                value={form.notizen}
                onChange={(e) => setForm({ ...form, notizen: e.target.value })}
              />
            </div>
          </div>
          {anlegen.error && (
            <p className="text-sm text-red-600">{anlegen.error.message}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOffen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={absenden}
              disabled={!formGueltig || anlegen.isPending}
            >
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Plan duplizieren ── */}
      <Dialog open={dup !== null} onOpenChange={(o) => !o && setDup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Plan duplizieren</DialogTitle>
          </DialogHeader>
          {dup && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">
                „{dup.titel}" wird mit allen Einträgen kopiert — Patient und
                Zeitfenster kannst du vorab ändern (Einträge werden verschoben;
                außerhalb des Fensters liegende bleiben weg). Status startet bei
                „geplant".
              </p>
              <div>
                <Label>Patient</Label>
                <Select value={dup.patientId} onValueChange={(v) => setDup({ ...dup, patientId: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(patientenListe.data ?? []).map((k) => (
                      <SelectItem key={k.id} value={String(k.id)}>
                        {k.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Von</Label>
                  <Input
                    type="date"
                    value={dup.vonDatum}
                    onChange={(e) => setDup({ ...dup, vonDatum: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bis</Label>
                  <Input
                    type="date"
                    value={dup.bisDatum}
                    onChange={(e) => setDup({ ...dup, bisDatum: e.target.value })}
                  />
                </div>
              </div>
              {duplizieren.error && (
                <p className="text-sm text-red-600">{duplizieren.error.message}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDup(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={duplizieren.isPending || !dup?.vonDatum || !dup?.bisDatum}
              onClick={() =>
                dup &&
                duplizieren.mutate({
                  id: dup.planId,
                  patientId: Number(dup.patientId),
                  vonDatum: dup.vonDatum,
                  bisDatum: dup.bisDatum,
                })
              }
            >
              {duplizieren.isPending ? "Dupliziere …" : "Duplizieren & öffnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
