import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import type { Patient } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { KonditionenSection } from "@/components/KonditionenSection";
import { ZAHLUNGSZIELE_TAGE } from "@contracts/invoicing";

// PraxisWerk: vereinigtes Patienten-Formular (Akte + Abrechnung).
// Name im Format „Nachname, Vorname" (Therapieplan-Konvention).
interface PatientFormular {
  name: string;
  patientenNr: string;
  geburtsdatum: string; // „JJJJ-MM-TT“ oder ""
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  telefon: string;
  email: string;
  krankenkasse: string;
  versichertennummer: string;
  aerztlicherAnsprechpartner: string;
  tags: string; // kommagetrennt
  ustIdNr: string;
  zahlungszielTage: string;
  notizen: string;
}

const leeresFormular: PatientFormular = {
  name: "",
  patientenNr: "",
  geburtsdatum: "",
  strasse: "",
  plz: "",
  ort: "",
  land: "Deutschland",
  telefon: "",
  email: "",
  krankenkasse: "",
  versichertennummer: "",
  aerztlicherAnsprechpartner: "",
  tags: "",
  ustIdNr: "",
  zahlungszielTage: "",
  notizen: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  offen: boolean;
  onOpenChange: (offen: boolean) => void;
  /** Vorhandener Patient → Bearbeiten; undefined → Neuanlage */
  patient?: Patient;
}

export function PatientForm({ offen, onOpenChange, patient }: Props) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<PatientFormular>(leeresFormular);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    if (!offen) return;
    setFehler("");
    if (patient) {
      setForm({
        name: patient.name,
        patientenNr: patient.patientenNr ?? "",
        geburtsdatum: patient.geburtsdatum ?? "",
        strasse: patient.strasse ?? "",
        plz: patient.plz ?? "",
        ort: patient.ort ?? "",
        land: patient.land ?? "Deutschland",
        telefon: patient.telefon ?? "",
        email: patient.email ?? "",
        krankenkasse: patient.krankenkasse ?? "",
        versichertennummer: patient.versichertennummer ?? "",
        aerztlicherAnsprechpartner: patient.aerztlicherAnsprechpartner ?? "",
        tags: patient.tags ?? "",
        ustIdNr: patient.ustIdNr ?? "",
        zahlungszielTage:
          patient.zahlungszielTage != null ? String(patient.zahlungszielTage) : "",
        notizen: patient.notizen ?? "",
      });
    } else {
      setForm(leeresFormular);
    }
  }, [offen, patient]);

  const nachErfolg = () => {
    utils.customers.list.invalidate();
    if (patient) utils.customers.get.invalidate({ id: patient.id });
    onOpenChange(false);
  };

  const anlegen = trpc.customers.create.useMutation({ onSuccess: nachErfolg });
  const aktualisieren = trpc.customers.update.useMutation({ onSuccess: nachErfolg });
  const laeuft = anlegen.isPending || aktualisieren.isPending;

  const absenden = () => {
    if (!form.name.trim()) {
      setFehler("Name ist Pflichtfeld (Format: „Nachname, Vorname“).");
      return;
    }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      setFehler("Bitte eine gültige E-Mail-Adresse angeben (oder das Feld leer lassen).");
      return;
    }
    setFehler("");
    const leer = (s: string) => (s.trim() ? s.trim() : null);
    const daten = {
      name: form.name.trim(),
      patientenNr: leer(form.patientenNr),
      geburtsdatum: form.geburtsdatum || null,
      strasse: form.strasse.trim(),
      plz: form.plz.trim(),
      ort: form.ort.trim(),
      land: form.land.trim() || "Deutschland",
      telefon: leer(form.telefon),
      email: leer(form.email),
      krankenkasse: leer(form.krankenkasse),
      versichertennummer: leer(form.versichertennummer),
      aerztlicherAnsprechpartner: leer(form.aerztlicherAnsprechpartner),
      tags: leer(form.tags),
      ustIdNr: leer(form.ustIdNr),
      zahlungszielTage:
        form.zahlungszielTage === "" ? null : Number(form.zahlungszielTage),
      notizen: leer(form.notizen),
    };
    if (patient) {
      aktualisieren.mutate({ id: patient.id, data: daten });
    } else {
      anlegen.mutate(daten);
    }
  };

  const apiFehler = anlegen.error ?? aktualisieren.error;

  return (
    <Dialog open={offen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {patient ? "Patient bearbeiten" : "Neuer Patient"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          <div className="col-span-2">
            <Label>Name * (Format: „Nachname, Vorname“)</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Mustermann, Max"
            />
          </div>
          <div>
            <Label>Patienten-Nr.</Label>
            <Input
              value={form.patientenNr}
              onChange={(e) => setForm({ ...form, patientenNr: e.target.value })}
              placeholder="z. B. IMTZ26001"
            />
          </div>
          <div>
            <Label>Geburtsdatum</Label>
            <Input
              type="date"
              value={form.geburtsdatum}
              onChange={(e) => setForm({ ...form, geburtsdatum: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label>Straße</Label>
            <Input
              value={form.strasse}
              onChange={(e) => setForm({ ...form, strasse: e.target.value })}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={form.plz}
              onChange={(e) => setForm({ ...form, plz: e.target.value })}
            />
          </div>
          <div>
            <Label>Ort</Label>
            <Input
              value={form.ort}
              onChange={(e) => setForm({ ...form, ort: e.target.value })}
            />
          </div>
          <div>
            <Label>Land</Label>
            <Input
              placeholder="Deutschland"
              value={form.land}
              onChange={(e) => setForm({ ...form, land: e.target.value })}
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
          <div>
            <Label>Krankenkasse</Label>
            <Input
              value={form.krankenkasse}
              onChange={(e) => setForm({ ...form, krankenkasse: e.target.value })}
            />
          </div>
          <div>
            <Label>Versichertennummer</Label>
            <Input
              value={form.versichertennummer}
              onChange={(e) =>
                setForm({ ...form, versichertennummer: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <Label>Ärztlicher Ansprechpartner</Label>
            <Input
              value={form.aerztlicherAnsprechpartner}
              onChange={(e) =>
                setForm({ ...form, aerztlicherAnsprechpartner: e.target.value })
              }
              placeholder="z. B. Hausarzt, mitweisender Arzt"
            />
          </div>
          <div className="col-span-2">
            <Label>Tags (kommagetrennt)</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="z. B. borreliose, apherese"
            />
          </div>
          <div>
            <Label>USt-IdNr. (bei Firmenkunden)</Label>
            <Input
              value={form.ustIdNr}
              onChange={(e) => setForm({ ...form, ustIdNr: e.target.value })}
              placeholder="DE123456789"
            />
          </div>
          <div>
            <Label>Zahlungsziel (abweichend)</Label>
            <Select
              value={form.zahlungszielTage || "standard"}
              onValueChange={(v) =>
                setForm({ ...form, zahlungszielTage: v === "standard" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                {ZAHLUNGSZIELE_TAGE.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {t === 0 ? "sofort" : `${t} Tage`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Notizen</Label>
            <Textarea
              rows={3}
              value={form.notizen}
              onChange={(e) => setForm({ ...form, notizen: e.target.value })}
              placeholder="Interne Hinweise zum Patienten …"
            />
          </div>
        </div>
        {patient && <KonditionenSection typ="kunde" partnerId={patient.id} />}
        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
        {apiFehler && <p className="text-sm text-red-600">{apiFehler.message}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={absenden} disabled={laeuft}>
            {laeuft ? "Speichere …" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
