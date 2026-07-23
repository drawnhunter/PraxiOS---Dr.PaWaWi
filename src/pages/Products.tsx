import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { geld, parseGeldInput } from "@/lib/format";
import { UST_SAETZE, EINHEITEN } from "@contracts/invoicing";
import { Button } from "@/components/ui/button";
import { CsvButton } from "@/components/CsvButton";
import { deZahl } from "@/lib/downloads";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Search } from "lucide-react";
import ImportDialog from "@/components/ImportDialog";

interface FormState {
  id?: number;
  name: string;
  beschreibung: string;
  einheit: string;
  preisNetto: string;
  ekPreisNetto: string;
  kategorie: "leistung" | "auslage";
  importNamen: string;
  ustSatz: number;
}

// Dr.ReWaWi: Heilbehandlungen sind § 4 Nr. 14a UStG-befreit -> USt-Standard 0 %
const leeresFormular: FormState = {
  name: "",
  beschreibung: "",
  einheit: "Stück",
  preisNetto: "",
  ekPreisNetto: "",
  kategorie: "leistung",
  importNamen: "",
  ustSatz: 0,
};

export default function Products() {
  const [suche, setSuche] = useState("");
  const [dialogOffen, setDialogOffen] = useState(false);
  const [form, setForm] = useState<FormState>(leeresFormular);

  const utils = trpc.useUtils();
  const liste = trpc.products.list.useQuery({ suche: suche || undefined });
  const speichern = trpc.products.create.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setDialogOffen(false);
    },
  });
  const aktualisieren = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setDialogOffen(false);
    },
  });
  const setAktiv = trpc.products.setAktiv.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
  });

  const oeffneBearbeiten = (p: NonNullable<typeof liste.data>[number]) => {
    setForm({
      id: p.id,
      name: p.name,
      beschreibung: p.beschreibung ?? "",
      einheit: p.einheit,
      preisNetto: new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
      }).format(Number(p.preisNetto)),
      ekPreisNetto: p.ekPreisNetto
        ? new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2 }).format(
            Number(p.ekPreisNetto),
          )
        : "",
      kategorie: p.kategorie,
      importNamen: p.importNamen ?? "",
      ustSatz: p.ustSatz,
    });
    setDialogOffen(true);
  };

  const absenden = () => {
    const daten = {
      name: form.name,
      beschreibung: form.beschreibung || null,
      einheit: form.einheit,
      preisNetto: parseGeldInput(form.preisNetto),
      ekPreisNetto: form.ekPreisNetto ? parseGeldInput(form.ekPreisNetto) : null,
      kategorie: form.kategorie,
      importNamen: form.importNamen.trim() ? form.importNamen.trim() : null,
      ustSatz: form.ustSatz,
    };
    if (form.id) {
      aktualisieren.mutate({ id: form.id, data: daten });
    } else {
      speichern.mutate(daten);
    }
  };

  const fehler = speichern.error ?? aktualisieren.error;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Leistungskatalog</h1>
        <div className="flex items-center gap-2">
          <CsvButton
            dateiname="produkte.csv"
            zeilen={[
              ["Name", "Beschreibung", "Einheit", "Kategorie", "VK netto", "EK netto", "USt-Satz %", "Import-Namen", "Aktiv"],
              ...(liste.data ?? []).map((p) => [
                p.name, p.beschreibung, p.einheit, p.kategorie === "auslage" ? "Auslage § 10" : "GOÄ-Leistung", deZahl(p.preisNetto), p.ekPreisNetto ? deZahl(p.ekPreisNetto) : "", p.ustSatz, p.importNamen ?? "", p.aktiv ? "ja" : "nein",
              ]),
            ]}
          />
          <ImportDialog typ="produkte" onFertig={() => utils.products.list.invalidate()} />
          <Button
            onClick={() => {
              setForm(leeresFormular);
              setDialogOffen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Neues Produkt
          </Button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <Input
          className="pl-9"
          placeholder="Suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Bezeichnung</th>
              <th className="px-4 py-2.5 font-medium">Einheit</th>
              <th className="px-4 py-2.5 font-medium">USt</th>
              <th className="px-4 py-2.5 text-right font-medium">VK netto</th>
              <th className="px-4 py-2.5 text-right font-medium">EK netto</th>
              <th className="px-4 py-2.5 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {(liste.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  Keine Produkte gefunden.
                </td>
              </tr>
            )}
            {(liste.data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-neutral-900">
                    {p.name} {!p.aktiv && <Badge variant="secondary">inaktiv</Badge>}{" "}
                    {p.kategorie === "auslage" && (
                      <Badge variant="outline" className="border-sky-400 text-sky-700">§ 10 Auslage</Badge>
                    )}
                  </div>
                  {p.beschreibung && (
                    <div className="max-w-md truncate text-xs text-neutral-500">
                      {p.beschreibung}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{p.einheit}</td>
                <td className="px-4 py-2.5 text-neutral-600">{p.ustSatz} %</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{geld(p.preisNetto)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">
                  {p.ekPreisNetto ? geld(p.ekPreisNetto) : "–"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="sm" onClick={() => oeffneBearbeiten(p)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAktiv.mutate({ id: p.id, aktiv: !p.aktiv })}
                  >
                    {p.aktiv ? "Deaktivieren" : "Aktivieren"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={dialogOffen} onOpenChange={setDialogOffen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Produkt bearbeiten" : "Neues Produkt"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2">
              <Label>Bezeichnung *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z. B. Systemgestellung HHH-Blutreinigungsverfahren"
              />
            </div>
            <div className="col-span-2">
              <Label>Beschreibungstext (erscheint auf der Rechnung)</Label>
              <Textarea
                value={form.beschreibung}
                onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                rows={3}
                placeholder="Pauschale für die Bereitstellung der Systemtechnologie …"
              />
            </div>
            <div>
              <Label>Kategorie (Rechnungsabschnitt)</Label>
              <Select
                value={form.kategorie}
                onValueChange={(v) => setForm({ ...form, kategorie: v as "leistung" | "auslage" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leistung">1. Ärztliche Leistung (GOÄ, VK)</SelectItem>
                  <SelectItem value="auslage">2. Auslage § 10 GOÄ (EK)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Einheit</Label>
              <Select
                value={form.einheit}
                onValueChange={(v) => setForm({ ...form, einheit: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EINHEITEN.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>USt-Satz</Label>
              <Select
                value={String(form.ustSatz)}
                onValueChange={(v) => setForm({ ...form, ustSatz: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UST_SAETZE.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s} %
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Verkaufspreis (VK) netto *</Label>
              <Input
                value={form.preisNetto}
                onChange={(e) => setForm({ ...form, preisNetto: e.target.value })}
                placeholder="4.117,65"
              />
            </div>
            <div>
              <Label>Einkaufspreis (EK) netto{form.kategorie === "auslage" ? " *" : ""}</Label>
              <Input
                value={form.ekPreisNetto}
                onChange={(e) => setForm({ ...form, ekPreisNetto: e.target.value })}
                placeholder={form.kategorie === "auslage" ? "Pflicht für Auslagen § 10" : "optional"}
              />
            </div>
            <div className="col-span-2">
              <Label>Import-Namen (Schreibweisen im Therapieplan, eine pro Zeile)</Label>
              <Textarea
                value={form.importNamen}
                onChange={(e) => setForm({ ...form, importNamen: e.target.value })}
                rows={2}
                placeholder={"z. B.:\n250 ml Ringer\nRinger 250ml"}
              />
            </div>
          </div>
          {fehler && <p className="text-sm text-red-600">{fehler.message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOffen(false)}>
              Abbrechen
            </Button>
            <Button onClick={absenden} disabled={!form.name || !form.preisNetto}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
