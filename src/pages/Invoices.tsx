import { SerienDialog } from "@/components/SerienDialog";
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { geld, datum } from "@/lib/format";
import { STATUS_LABELS, type InvoiceStatus } from "@contracts/invoicing";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { CsvButton } from "@/components/CsvButton";
import RechnungsPanel from "@/components/RechnungsPanel";
import { deZahl } from "@/lib/downloads";
import { Button } from "@/components/ui/button";
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
import { Plus, Repeat, Search, UserPlus } from "lucide-react";

export function statusBadge(status: InvoiceStatus) {
  const variant =
    status === "finalisiert"
      ? "default"
      : status === "storniert"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>;
}

interface NeukundeForm {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  email: string;
}

export default function Invoices() {
  const [serienOffen, setSerienOffen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [q, setQ] = useState("");
  const [panelId, setPanelId] = useState<number | null>(null);
  const [neuDialog, setNeuDialog] = useState(false);
  const [modus, setModus] = useState<"bestehend" | "neu">("bestehend");
  const [belegTyp, setBelegTyp] = useState<"standard" | "proforma">("standard");
  const [kundenId, setKundenId] = useState<string>("");
  const [neukunde, setNeukunde] = useState<NeukundeForm>({
    name: "",
    strasse: "",
    plz: "",
    ort: "",
    land: "Deutschland",
    email: "",
  });
  const navigate = useNavigate();

  const utils = trpc.useUtils();
  const liste = trpc.invoices.list.useQuery(
    statusFilter === "archiviert"
      ? { archiviert: true }
      : statusFilter === "alle" || statusFilter === "ueberfaellig"
        ? { archiviert: false }
        : { status: statusFilter as InvoiceStatus, archiviert: false },
  );

  const heute = new Date().toISOString().slice(0, 10);
  const zeilenListe = (liste.data ?? []).filter((r) => {
    const passtStatus =
      statusFilter === "ueberfaellig"
        ? r.status === "finalisiert" &&
          Number(r.brutto) - Number(r.bezahltBetrag) > 0.004 &&
          r.faelligkeitsdatum < heute
        : true;
    const passtSuche =
      !q.trim() ||
      (r.nummer ?? "").toLowerCase().includes(q.toLowerCase()) ||
      r.kundeName.toLowerCase().includes(q.toLowerCase());
    return passtStatus && passtSuche;
  });
  const kunden = trpc.customers.list.useQuery();

  const erstellen = trpc.invoices.createDraft.useMutation({
    onSuccess: (res) => {
      setNeuDialog(false);
      navigate(`/rechnungen/${res.id}`);
    },
  });
  const kundeErstellen = trpc.customers.create.useMutation();

  const weiter = async () => {
    if (modus === "bestehend") {
      if (!kundenId) return;
      erstellen.mutate({ customerId: Number(kundenId), typ: belegTyp });
      return;
    }
    // Neukunde zuerst anlegen, dann Rechnung damit öffnen
    const res = await kundeErstellen.mutateAsync({
      name: neukunde.name,
      strasse: neukunde.strasse,
      plz: neukunde.plz,
      ort: neukunde.ort,
      land: neukunde.land || "Deutschland",
      email: neukunde.email || null,
    });
    utils.customers.list.invalidate();
    erstellen.mutate({ customerId: res.id, typ: belegTyp });
  };

  const fehler = erstellen.error ?? kundeErstellen.error;
  const kannWeiter =
    modus === "bestehend"
      ? !!kundenId
      : !!(neukunde.name && neukunde.strasse && neukunde.plz && neukunde.ort);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Rechnungen</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSerienOffen(true)}>
            <Repeat className="mr-1.5 h-4 w-4" /> Serien
          </Button>
          <CsvButton
            dateiname="rechnungen.csv"
            zeilen={[
              ["Nummer", "Status", "Rechnungsdatum", "Fälligkeitsdatum", "Kunde", "PLZ", "Ort", "Netto", "USt", "Brutto", "Bezahlt", "Bezahlt am"],
              ...zeilenListe.map((r) => [
                r.nummer ?? `Entwurf #${r.id}`, r.status, r.rechnungsdatum, r.faelligkeitsdatum,
                r.kundeName, r.kundePlz, r.kundeOrt, deZahl(r.netto), deZahl(r.ust), deZahl(r.brutto),
                deZahl(r.bezahltBetrag), r.bezahltAm,
              ]),
            ]}
          />
          <Button variant="outline" onClick={() => navigate("/rechnungen/importieren")}>
            Import
          </Button>
          <Button
            onClick={() => {
              setNeuDialog(true);
              setModus("bestehend");
              setKundenId("");
              setNeukunde({
                name: "",
                strasse: "",
                plz: "",
                ort: "",
                land: "Deutschland",
                email: "",
              });
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Neue Rechnung
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nummer / Patient suchen …"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            <SelectItem value="entwurf">Entwurf</SelectItem>
            <SelectItem value="finalisiert">Finalisiert</SelectItem>
            <SelectItem value="ueberfaellig">Überfällig</SelectItem>
            <SelectItem value="storniert">Storniert</SelectItem>
            <SelectItem value="archiviert">Archiviert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Nummer</th>
              <th className="px-4 py-2.5 font-medium">Kunde</th>
              <th className="px-4 py-2.5 font-medium">Datum</th>
              <th className="px-4 py-2.5 font-medium">Fällig</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Brutto</th>
              <th className="px-4 py-2.5 text-right font-medium">Offen</th>
            </tr>
          </thead>
          <tbody>
            {zeilenListe.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-400">
                  Keine Rechnungen vorhanden.
                </td>
              </tr>
            )}
            {zeilenListe.map((r) => {
              const offen =
                r.status === "finalisiert"
                  ? Number(r.brutto) - Number(r.bezahltBetrag)
                  : 0;
              const ueberfaellig = offen > 0.004 && r.faelligkeitsdatum < heute;
              return (
                <tr key={r.id} className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50" onClick={() => setPanelId(r.id)}>
                  <td className="px-4 py-2.5">
                    <span
                      className="font-medium text-neutral-900 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/rechnungen/${r.id}`);
                      }}
                    >
                      {r.nummer ??
                        (r.typ === "proforma" ? `Proforma #${r.id}` : `Entwurf #${r.id}`)}
                    </span>
                    {r.typ === "proforma" && (
                      <Badge variant="outline" className="ml-2 border-teal-300 text-teal-700">
                        Vorkasse
                      </Badge>
                    )}
                    {r.creditNotes.length > 0 && (
                      <span className="ml-2 text-xs text-neutral-400">
                        ({r.creditNotes.length} Gutschrift(en))
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{r.kundeName}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{datum(r.rechnungsdatum)}</td>
                  <td
                    className={`px-4 py-2.5 ${ueberfaellig ? "font-medium text-red-600" : "text-neutral-600"}`}
                  >
                    {datum(r.faelligkeitsdatum)}
                  </td>
                  <td className="px-4 py-2.5">
                    {statusBadge(r.status)}
                    {ueberfaellig && (
                      <Badge variant="destructive" className="ml-1.5">
                        Überfällig
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{geld(r.brutto)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.status === "finalisiert" && offen > 0.004 ? geld(offen) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={neuDialog} onOpenChange={setNeuDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {belegTyp === "proforma" ? "Neue Proforma / Vorkasse" : "Neue Rechnung"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-neutral-100 p-1 text-sm">
            <button
              className={`rounded px-3 py-1.5 transition-colors ${
                belegTyp === "standard" ? "bg-white font-medium shadow-sm" : "text-neutral-500"
              }`}
              onClick={() => setBelegTyp("standard")}
            >
              Rechnung
            </button>
            <button
              className={`rounded px-3 py-1.5 transition-colors ${
                belegTyp === "proforma" ? "bg-white font-medium shadow-sm" : "text-neutral-500"
              }`}
              onClick={() => setBelegTyp("proforma")}
            >
              Proforma / Vorkasse
            </button>
          </div>
          {belegTyp === "proforma" && (
            <p className="rounded-md bg-teal-50 px-3 py-2 text-xs text-teal-800">
              Zahlungsaufforderung ohne Rechnungsnummer (kein GoBD-Beleg) — z. B.
              als Therapiedepot. Nach Zahlungseingang über „In Rechnung umwandeln"
              verrechnen; der gezahlte Betrag wird auf der Schlussrechnung
              automatisch abgezogen.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 rounded-md bg-neutral-100 p-1 text-sm">
            <button
              className={`rounded px-3 py-1.5 transition-colors ${
                modus === "bestehend" ? "bg-white font-medium shadow-sm" : "text-neutral-500"
              }`}
              onClick={() => setModus("bestehend")}
            >
              Bestehender Kunde
            </button>
            <button
              className={`flex items-center justify-center gap-1.5 rounded px-3 py-1.5 transition-colors ${
                modus === "neu" ? "bg-white font-medium shadow-sm" : "text-neutral-500"
              }`}
              onClick={() => setModus("neu")}
            >
              <UserPlus className="h-3.5 w-3.5" /> Neuer Kunde
            </button>
          </div>

          {modus === "bestehend" ? (
            <div className="space-y-2">
              <p className="text-sm text-neutral-500">
                Kunde auswählen — die Rechnung wird als Entwurf angelegt; die Daten
                kannst du dort noch prüfen und anpassen.
              </p>
              <Select value={kundenId} onValueChange={setKundenId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kunde auswählen …" />
                </SelectTrigger>
                <SelectContent>
                  {(kunden.data ?? []).map((k) => (
                    <SelectItem key={k.id} value={String(k.id)}>
                      {k.name} — {k.plz} {k.ort}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(kunden.data ?? []).length === 0 && (
                <p className="text-sm text-amber-600">
                  Noch keine Kunden vorhanden — wechsle auf „Neuer Kunde“.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">
                Der Kunde wird im Kundenstamm angelegt und direkt für die Rechnung
                übernommen.
              </p>
              <div>
                <Label>Name *</Label>
                <Input
                  value={neukunde.name}
                  onChange={(e) => setNeukunde({ ...neukunde, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Straße *</Label>
                <Input
                  value={neukunde.strasse}
                  onChange={(e) => setNeukunde({ ...neukunde, strasse: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label>PLZ *</Label>
                  <Input
                    value={neukunde.plz}
                    onChange={(e) => setNeukunde({ ...neukunde, plz: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Ort *</Label>
                  <Input
                    value={neukunde.ort}
                    onChange={(e) => setNeukunde({ ...neukunde, ort: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>E-Mail</Label>
                <Input
                  value={neukunde.email}
                  onChange={(e) => setNeukunde({ ...neukunde, email: e.target.value })}
                />
              </div>
            </div>
          )}

          {fehler && <p className="text-sm text-red-600">{fehler.message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNeuDialog(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={!kannWeiter || erstellen.isPending || kundeErstellen.isPending}
              onClick={weiter}
            >
              {erstellen.isPending || kundeErstellen.isPending
                ? "Lege an …"
                : "Rechnung anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {panelId !== null && (
        <RechnungsPanel
          id={panelId}
          onClose={() => setPanelId(null)}
          onChanged={() => liste.refetch()}
        />
      )}
      <SerienDialog offen={serienOffen} onSchliessen={() => setSerienOffen(false)} />
    </div>
  );
}
