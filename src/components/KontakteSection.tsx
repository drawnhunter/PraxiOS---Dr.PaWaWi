import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import type { PatientContact } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2, Users } from "lucide-react";

interface KontaktFormular {
  id?: number;
  name: string;
  verhaeltnis: string;
  telefon: string;
  email: string;
  adresse: string;
  istRechnungsempfaenger: boolean;
  notiz: string;
}

const leererKontakt: KontaktFormular = {
  name: "",
  verhaeltnis: "",
  telefon: "",
  email: "",
  adresse: "",
  istRechnungsempfaenger: false,
  notiz: "",
};

interface Props {
  patientId: number;
  kontakte: PatientContact[];
}

export function KontakteSection({ patientId, kontakte }: Props) {
  const utils = trpc.useUtils();
  const [dialogOffen, setDialogOffen] = useState(false);
  const [form, setForm] = useState<KontaktFormular>(leererKontakt);
  const [loeschKandidat, setLoeschKandidat] = useState<PatientContact | null>(null);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    if (!dialogOffen) setFehler("");
  }, [dialogOffen]);

  const nachErfolg = () => {
    utils.customers.get.invalidate({ id: patientId });
    setDialogOffen(false);
    setLoeschKandidat(null);
  };

  const anlegen = trpc.customers.addKontakt.useMutation({ onSuccess: nachErfolg });
  const aktualisieren = trpc.customers.updateKontakt.useMutation({ onSuccess: nachErfolg });
  const entfernen = trpc.customers.removeKontakt.useMutation({ onSuccess: nachErfolg });
  const laeuft = anlegen.isPending || aktualisieren.isPending;

  const bearbeiten = (k: PatientContact) => {
    setForm({
      id: k.id,
      name: k.name,
      verhaeltnis: k.verhaeltnis ?? "",
      telefon: k.telefon ?? "",
      email: k.email ?? "",
      adresse: k.adresse ?? "",
      istRechnungsempfaenger: k.istRechnungsempfaenger,
      notiz: k.notiz ?? "",
    });
    setDialogOffen(true);
  };

  const absenden = () => {
    if (!form.name.trim()) {
      setFehler("Name ist ein Pflichtfeld.");
      return;
    }
    setFehler("");
    const leer = (s: string) => (s.trim() ? s.trim() : null);
    const daten = {
      name: form.name.trim(),
      verhaeltnis: leer(form.verhaeltnis),
      telefon: leer(form.telefon),
      email: leer(form.email),
      adresse: leer(form.adresse),
      istRechnungsempfaenger: form.istRechnungsempfaenger,
      notiz: leer(form.notiz),
    };
    if (form.id) {
      aktualisieren.mutate({ id: form.id, data: daten });
    } else {
      anlegen.mutate({ patientId, ...daten });
    }
  };

  const apiFehler = anlegen.error ?? aktualisieren.error ?? entfernen.error;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-700">
          Kontaktpersonen / Angehörige
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setForm(leererKontakt);
            setDialogOffen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Kontakt hinzufügen
        </Button>
      </div>

      {kontakte.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Users className="h-8 w-8 text-neutral-300" />
          <p className="text-sm text-neutral-500">
            Noch keine Kontaktpersonen hinterlegt.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Verhältnis</th>
                <th className="px-2 py-2 font-medium">Telefon</th>
                <th className="px-2 py-2 font-medium">E-Mail</th>
                <th className="px-2 py-2 font-medium">Adresse</th>
                <th className="px-2 py-2 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {kontakte.map((k) => (
                <tr key={k.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-2 py-2.5 font-medium">
                    {k.name}{" "}
                    {k.istRechnungsempfaenger && (
                      <Badge>Rechnungsempfänger</Badge>
                    )}
                    {k.notiz && (
                      <div className="mt-0.5 text-xs font-normal text-neutral-500">
                        {k.notiz}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-neutral-600">
                    {k.verhaeltnis ?? "–"}
                  </td>
                  <td className="px-2 py-2.5 text-neutral-600">{k.telefon ?? "–"}</td>
                  <td className="px-2 py-2.5 text-neutral-600">{k.email ?? "–"}</td>
                  <td className="px-2 py-2.5 text-neutral-600">{k.adresse ?? "–"}</td>
                  <td className="px-2 py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => bearbeiten(k)}>
                      Bearbeiten
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setLoeschKandidat(k)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {apiFehler && <p className="mt-2 text-sm text-red-600">{apiFehler.message}</p>}

      {/* ── Anlegen-/Bearbeiten-Dialog ── */}
      <Dialog open={dialogOffen} onOpenChange={setDialogOffen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Kontakt bearbeiten" : "Neuer Kontakt"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Verhältnis</Label>
              <Input
                value={form.verhaeltnis}
                onChange={(e) => setForm({ ...form, verhaeltnis: e.target.value })}
                placeholder="z. B. Mutter, Ehepartner"
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={form.telefon}
                onChange={(e) => setForm({ ...form, telefon: e.target.value })}
              />
            </div>
            <div>
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Adresse</Label>
              <Input
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                placeholder="Straße, PLZ Ort"
              />
            </div>
            <div className="col-span-2">
              <Label>Notiz</Label>
              <Input
                value={form.notiz}
                onChange={(e) => setForm({ ...form, notiz: e.target.value })}
              />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-neutral-700">
              <Checkbox
                checked={form.istRechnungsempfaenger}
                onCheckedChange={(v) =>
                  setForm({ ...form, istRechnungsempfaenger: v === true })
                }
              />
              Ist Rechnungsempfänger (abweichend vom Patienten)
            </label>
          </div>
          {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOffen(false)}>
              Abbrechen
            </Button>
            <Button onClick={absenden} disabled={laeuft}>
              {laeuft ? "Speichere …" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lösch-Dialog ── */}
      <AlertDialog
        open={loeschKandidat !== null}
        onOpenChange={(offen) => !offen && setLoeschKandidat(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kontakt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {loeschKandidat?.name} wird als Kontaktperson entfernt. Der
              Patient selbst bleibt unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
