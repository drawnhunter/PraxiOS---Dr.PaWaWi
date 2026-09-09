import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { ZAHLUNGSZIELE_TAGE } from "@contracts/invoicing";
import { Button } from "@/components/ui/button";
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
import { Plus } from "lucide-react";
import { DatevExport } from "@/components/DatevExport";
import { Benutzerverwaltung } from "@/components/Benutzerverwaltung";
import { KategorienVerwaltung } from "@/components/KategorienVerwaltung";
import { AKZENTFARBEN, PDF_LAYOUTS, akzentAnwenden } from "@/lib/design";

interface FirmenForm {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  handelsregister: string;
  steuernummer: string;
  ustIdNr: string;
  email: string;
  telefon: string;
  webseite: string;
  standardZahlungsziel: number;
  fussText: string;
  datevBeraternummer: string;
  kreditorStartnummer: number;
  aufwandskontoDefault: string;
  datevMandantennummer: string;
  datevKontenrahmen: string;
  erloeskonto19: string;
  erloeskonto7: string;
  erloeskonto0: string;
  debitorStartnummer: number;
  akzentfarbe: string;
  pdfLayout: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpAbsender: string;
  smtpPasswort: string;
  erinnerungAktiv: boolean;
  erinnerungTageVorher: number;
  patientenNrStart: number;
  patientenNrPrefixAktiv: boolean;
  patientenNrPrefix: string;
  waehrung: string;
}

interface BankForm {
  id?: number;
  bezeichnung: string;
  bankName: string;
  kontoinhaber: string;
  iban: string;
  bic: string;
}

const leereBank: BankForm = {
  bezeichnung: "",
  bankName: "",
  kontoinhaber: "",
  iban: "",
  bic: "",
};

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const settings = trpc.settings.get.useQuery();
  const sequenzen = trpc.settings.sequences.useQuery();
  const banken = trpc.bank.list.useQuery();

  const [firma, setFirma] = useState<FirmenForm | null>(null);
  const [bankDialog, setBankDialog] = useState(false);
  const [bankForm, setBankForm] = useState<BankForm>(leereBank);
  const [meldung, setMeldung] = useState("");
  const [seqWerte, setSeqWerte] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!settings.data || firma) return;
    const s = settings.data;
    setFirma({
      name: s.name,
      strasse: s.strasse,
      plz: s.plz,
      ort: s.ort,
      land: s.land,
      smtpHost: s.smtpHost ?? "",
      smtpPort: s.smtpPort,
      smtpUser: s.smtpUser ?? "",
      smtpAbsender: s.smtpAbsender ?? "",
      smtpPasswort: "",
      erinnerungAktiv: s.erinnerungAktiv ?? false,
      erinnerungTageVorher: s.erinnerungTageVorher,
      patientenNrStart: s.patientenNrStart ?? 1,
      patientenNrPrefixAktiv: s.patientenNrPrefixAktiv ?? false,
      patientenNrPrefix: s.patientenNrPrefix ?? "P",
      waehrung: s.waehrung ?? "€",
      handelsregister: s.handelsregister ?? "",
      steuernummer: s.steuernummer ?? "",
      ustIdNr: s.ustIdNr ?? "",
      email: s.email ?? "",
      telefon: s.telefon ?? "",
      webseite: s.webseite ?? "",
      standardZahlungsziel: s.standardZahlungsziel,
      fussText: s.fussText ?? "",
      datevBeraternummer: s.datevBeraternummer ?? "",
      kreditorStartnummer: s.kreditorStartnummer,
      aufwandskontoDefault: s.aufwandskontoDefault ?? "",
      datevMandantennummer: s.datevMandantennummer ?? "",
      datevKontenrahmen: s.datevKontenrahmen,
      erloeskonto19: s.erloeskonto19,
      erloeskonto7: s.erloeskonto7,
      erloeskonto0: s.erloeskonto0,
      debitorStartnummer: s.debitorStartnummer,
      akzentfarbe: s.akzentfarbe,
      pdfLayout: s.pdfLayout,
    });
  }, [settings.data, firma]);

  const smtpTest = trpc.mail.smtpTest.useMutation();
  const pruefeErinnerung = trpc.settings.erinnerungPruefen.useMutation();
  const speichernFirma = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      setMeldung("Firmendaten gespeichert.");
      setTimeout(() => setMeldung(""), 3000);
    },
  });

  const speichernBank = trpc.bank.create.useMutation({
    onSuccess: () => {
      utils.bank.list.invalidate();
      setBankDialog(false);
    },
  });
  const updateBank = trpc.bank.update.useMutation({
    onSuccess: () => {
      utils.bank.list.invalidate();
      setBankDialog(false);
    },
  });
  const setStandard = trpc.bank.setStandard.useMutation({
    onSuccess: () => utils.bank.list.invalidate(),
  });
  const setAktiv = trpc.bank.setAktiv.useMutation({
    onSuccess: () => utils.bank.list.invalidate(),
  });
  const setSeq = trpc.settings.setSequenceStart.useMutation({
    onSuccess: () => utils.settings.sequences.invalidate(),
  });

  if (!firma) return <p className="text-sm text-neutral-500">Lade …</p>;

  const bankAbsenden = () => {
    const daten = {
      bezeichnung: bankForm.bezeichnung,
      bankName: bankForm.bankName,
      kontoinhaber: bankForm.kontoinhaber,
      iban: bankForm.iban.replace(/\s/g, ""),
      bic: bankForm.bic || null,
    };
    if (bankForm.id) {
      updateBank.mutate({ id: bankForm.id, data: daten });
    } else {
      speichernBank.mutate(daten);
    }
  };

  const bankFehler = speichernBank.error ?? updateBank.error;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Einstellungen</h1>

      {/* ── Firmendaten ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-neutral-700">
          Firmendaten (erscheinen auf allen Belegen)
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="col-span-3">
            <Label>Firmenname *</Label>
            <Input
              value={firma.name}
              onChange={(e) => setFirma({ ...firma, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Straße *</Label>
            <Input
              value={firma.strasse}
              onChange={(e) => setFirma({ ...firma, strasse: e.target.value })}
            />
          </div>
          <div>
            <Label>PLZ *</Label>
            <Input
              value={firma.plz}
              onChange={(e) => setFirma({ ...firma, plz: e.target.value })}
            />
          </div>
          <div>
            <Label>Ort *</Label>
            <Input
              value={firma.ort}
              onChange={(e) => setFirma({ ...firma, ort: e.target.value })}
            />
          </div>
          <div>
            <Label>Handelsregister</Label>
            <Input
              value={firma.handelsregister}
              onChange={(e) => setFirma({ ...firma, handelsregister: e.target.value })}
            />
          </div>
          <div>
            <Label>Steuernummer</Label>
            <Input
              value={firma.steuernummer}
              onChange={(e) => setFirma({ ...firma, steuernummer: e.target.value })}
            />
          </div>
          <div>
            <Label>USt-IdNr.</Label>
            <Input
              value={firma.ustIdNr}
              onChange={(e) => setFirma({ ...firma, ustIdNr: e.target.value })}
            />
          </div>
          <div>
            <Label>Währung (Symbol/Code)</Label>
            <Input
              className="w-28"
              value={firma.waehrung}
              onChange={(e) => setFirma({ ...firma, waehrung: e.target.value })}
              placeholder="€"
            />
            <p className="mt-1 text-xs text-neutral-400">Wird u. a. bei Rabatt-Festwerten angezeigt (€, $, CHF).</p>
          </div>
          <div>
            <Label>E-Mail</Label>
            <Input
              value={firma.email}
              onChange={(e) => setFirma({ ...firma, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input
              value={firma.telefon}
              onChange={(e) => setFirma({ ...firma, telefon: e.target.value })}
            />
          </div>
          <div>
            <Label>Webseite</Label>
            <Input
              value={firma.webseite}
              onChange={(e) => setFirma({ ...firma, webseite: e.target.value })}
            />
          </div>
          <div>
            <Label>Standard-Zahlungsziel</Label>
            <Select
              value={String(firma.standardZahlungsziel)}
              onValueChange={(v) =>
                setFirma({ ...firma, standardZahlungsziel: Number(v) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZAHLUNGSZIELE_TAGE.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {t === 0 ? "sofort" : `${t} Tage`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Fußtext auf Belegen (optional)</Label>
            <Textarea
              value={firma.fussText}
              onChange={(e) => setFirma({ ...firma, fussText: e.target.value })}
              rows={2}
              placeholder="z. B. Hinweis auf Terminabsagen, Versandinformationen …"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={() =>
              speichernFirma.mutate({
                ...firma,
                smtpHost: firma.smtpHost || null,
                smtpPort: firma.smtpPort,
                smtpUser: firma.smtpUser || null,
                smtpAbsender: firma.smtpAbsender || null,
                erinnerungAktiv: firma.erinnerungAktiv,
                erinnerungTageVorher: firma.erinnerungTageVorher,
                patientenNrStart: firma.patientenNrStart,
                patientenNrPrefixAktiv: firma.patientenNrPrefixAktiv,
                patientenNrPrefix: firma.patientenNrPrefix,
                waehrung: firma.waehrung || "€",
                ...(firma.smtpPasswort ? { smtpPasswort: firma.smtpPasswort } : {}),
                handelsregister: firma.handelsregister || null,
                steuernummer: firma.steuernummer || null,
                ustIdNr: firma.ustIdNr || null,
                email: firma.email || null,
                telefon: firma.telefon || null,
                webseite: firma.webseite || null,
                fussText: firma.fussText || null,
                kreditorStartnummer: firma.kreditorStartnummer,
                aufwandskontoDefault: firma.aufwandskontoDefault || null,
                datevBeraternummer: firma.datevBeraternummer || null,
                datevMandantennummer: firma.datevMandantennummer || null,
                datevKontenrahmen: firma.datevKontenrahmen as "SKR03" | "SKR04",
                akzentfarbe: firma.akzentfarbe as "neutral" | "blau" | "gruen" | "bernstein" | "violett" | "rot",
                pdfLayout: firma.pdfLayout as "klassisch" | "modern" | "kompakt",
              })
            }
            disabled={speichernFirma.isPending}
          >
            Firmendaten speichern
          </Button>
          {meldung && <span className="text-sm text-green-600">{meldung}</span>}
          {speichernFirma.error && (
            <span className="text-sm text-red-600">{speichernFirma.error.message}</span>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Hinweis: Bereits finalisierte Belege behalten ihre damaligen Firmendaten
          (Snapshot) — Änderungen wirken nur auf neue Belege.
        </p>
      </section>

      {/* ── E-Mail (SMTP) ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-medium text-neutral-700">E-Mail-Versand (SMTP)</h2>
        <p className="mb-4 text-xs text-neutral-400">
          Für den direkten Versand von Rechnungen und Gutschriften als PDF.
          Zugangsdaten deines Mail-Providers; das Passwort wird verschlüsselt
          gespeichert (AES-256-GCM). Speichern erfolgt oben über „Firmendaten speichern".
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>SMTP-Server</Label>
            <Input
              value={firma.smtpHost}
              onChange={(e) => setFirma({ ...firma, smtpHost: e.target.value })}
              placeholder="z. B. smtp.domain.de"
            />
          </div>
          <div>
            <Label>Port</Label>
            <Input
              type="number"
              value={firma.smtpPort}
              onChange={(e) => setFirma({ ...firma, smtpPort: Number(e.target.value) || 587 })}
              placeholder="587 (STARTTLS) oder 465 (SSL)"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Benutzername (meist die E-Mail-Adresse)</Label>
            <Input
              value={firma.smtpUser}
              onChange={(e) => setFirma({ ...firma, smtpUser: e.target.value })}
              placeholder="z. B. rechnung@deine-domain.de"
            />
          </div>
          <div>
            <Label>
              Passwort{" "}
              {settings.data?.smtpPasswortGesetzt && (
                <span className="text-neutral-400">(gesetzt — leer lassen = behalten)</span>
              )}
            </Label>
            <Input
              type="password"
              value={firma.smtpPasswort}
              onChange={(e) => setFirma({ ...firma, smtpPasswort: e.target.value })}
              autoComplete="new-password"
              placeholder={settings.data?.smtpPasswortGesetzt ? "••••••••" : "Passwort des Postfachs"}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Absendername (optional)</Label>
            <Input
              value={firma.smtpAbsender}
              onChange={(e) => setFirma({ ...firma, smtpAbsender: e.target.value })}
              placeholder="z. B. IMTZ GmbH — Buchhaltung"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={smtpTest.isPending || !firma.smtpHost || !firma.smtpUser}
              onClick={() => smtpTest.mutate()}
            >
              {smtpTest.isPending ? "Prüfe …" : "Verbindung testen"}
            </Button>
            {smtpTest.isSuccess && <span className="text-sm text-green-600">Verbindung ok ✓</span>}
            {smtpTest.error && (
              <span className="text-sm text-red-600">{smtpTest.error.message}</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Terminerinnerungen ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-medium text-neutral-700">Terminerinnerungen (E-Mail)</h2>
        <p className="mb-4 text-xs text-neutral-400">
          Patienten mit hinterlegter E-Mail-Adresse bekommen vor ihrem Termin
          automatisch eine Erinnerung (genau einmal je Termin, nur Status
          „geplant"). Voraussetzung: eingerichtetes SMTP oben.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={firma.erinnerungAktiv}
              onChange={(e) => setFirma({ ...firma, erinnerungAktiv: e.target.checked })}
              className="h-4 w-4 accent-[#0F766E]"
            />
            Terminerinnerungen aktivieren
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span>Erinnern</span>
            <Select
              value={String(firma.erinnerungTageVorher)}
              onValueChange={(v) => setFirma({ ...firma, erinnerungTageVorher: Number(v) })}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {t} {t === 1 ? "Tag" : "Tage"} vorher
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pruefeErinnerung.isPending || !firma.erinnerungAktiv}
            onClick={() => pruefeErinnerung.mutate()}
          >
            {pruefeErinnerung.isPending ? "Prüfe …" : "Jetzt prüfen"}
          </Button>
          {pruefeErinnerung.data && (
            <span className="text-sm text-green-700">
              {pruefeErinnerung.data.gesendet} gesendet, {pruefeErinnerung.data.uebersprungen} übersprungen
            </span>
          )}
          {pruefeErinnerung.error && (
            <span className="text-sm text-red-600">{pruefeErinnerung.error.message}</span>
          )}
        </div>
      </section>

      {/* ── Unterschrift (Rezepte/Atteste) ── */}
      <SignaturAbschnitt />

      {/* ── Patientennummern (Nummernkreis) ── */}
      <PatientenNrAbschnitt firma={firma} setFirma={setFirma} />

      {/* ── DATEV & Kontierung ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-medium text-neutral-700">DATEV &amp; Kontierung</h2>
        <p className="mb-4 text-xs text-neutral-400">
          Kontenrahmen (SKR03/SKR04), Debitor-/Kreditor-Startnummern und das
          Standard-Aufwandskonto für Eingangsrechnungen ohne eigene Kontierung.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Debitor-Startnummer</Label>
            <Input
              type="number"
              value={firma.debitorStartnummer}
              onChange={(e) => setFirma({ ...firma, debitorStartnummer: Number(e.target.value) || 10000 })}
            />
          </div>
          <div>
            <Label>Kreditor-Startnummer</Label>
            <Input
              type="number"
              value={firma.kreditorStartnummer}
              onChange={(e) => setFirma({ ...firma, kreditorStartnummer: Number(e.target.value) || 70000 })}
            />
          </div>
          <div>
            <Label>Standard-Aufwandskonto</Label>
            <Input
              value={firma.aufwandskontoDefault}
              onChange={(e) => setFirma({ ...firma, aufwandskontoDefault: e.target.value })}
              placeholder="z. B. 4900 (SKR03) / 6305 (SKR04)"
            />
          </div>
        </div>
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <KategorienVerwaltung />
        </div>
      </section>

      {/* ── Design ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-medium text-neutral-700">Design</h2>
        <p className="mb-4 text-xs text-neutral-400">
          Die Akzentfarbe färbt Buttons und Auswahlen im Programm; das Layout
          bestimmt das Aussehen der PDF-Belege (Rechnungen, Angebote …).
        </p>

        <Label className="mb-2 block">Akzentfarbe</Label>
        <div className="mb-5 flex flex-wrap gap-2.5">
          {AKZENTFARBEN.map((f) => (
            <button
              key={f.id}
              type="button"
              title={f.label}
              onClick={() => {
                setFirma({ ...firma, akzentfarbe: f.id });
                akzentAnwenden(f.id); // Live-Vorschau
              }}
              className={`h-9 w-9 rounded-full transition-all ${
                firma.akzentfarbe === f.id
                  ? "ring-2 ring-neutral-800 ring-offset-2"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: f.hex }}
            />
          ))}
          <span className="ml-1 self-center text-xs text-neutral-500">
            {AKZENTFARBEN.find((f) => f.id === firma.akzentfarbe)?.label}
          </span>
        </div>

        <Label className="mb-2 block">Rechnungs-Layout (PDF)</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PDF_LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setFirma({ ...firma, pdfLayout: l.id })}
              className={`rounded-lg border p-3 text-left transition-colors ${
                firma.pdfLayout === l.id
                  ? "border-neutral-800 bg-neutral-50"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="text-sm font-medium">{l.label}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                {l.beschreibung}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Wird mit „Firmendaten speichern" (oben) übernommen und gilt für alle
          neu erzeugten PDFs.
        </p>
      </section>

      {/* ── DATEV-Export ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-medium text-neutral-700">DATEV-Export (Buchungsstapel)</h2>
        <p className="mb-4 text-xs text-neutral-400">
          Die Werte erfragst du am besten kurz bei deinem Steuerberater (Berater-/Mandantennummer,
          Kontenrahmen, Erlöskonten). Sie stehen im Kopf jeder Export-Datei.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Beraternummer</Label>
            <Input
              value={firma.datevBeraternummer}
              onChange={(e) => setFirma({ ...firma, datevBeraternummer: e.target.value })}
              placeholder="z. B. 1234567"
            />
          </div>
          <div>
            <Label>Mandantennummer</Label>
            <Input
              value={firma.datevMandantennummer}
              onChange={(e) => setFirma({ ...firma, datevMandantennummer: e.target.value })}
              placeholder="z. B. 10001"
            />
          </div>
          <div>
            <Label>Kontenrahmen</Label>
            <Select
              value={firma.datevKontenrahmen}
              onValueChange={(v) => setFirma({ ...firma, datevKontenrahmen: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SKR03">SKR 03</SelectItem>
                <SelectItem value="SKR04">SKR 04</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Erlöskonto 19 %</Label>
            <Input
              value={firma.erloeskonto19}
              onChange={(e) => setFirma({ ...firma, erloeskonto19: e.target.value })}
            />
          </div>
          <div>
            <Label>Erlöskonto 7 %</Label>
            <Input
              value={firma.erloeskonto7}
              onChange={(e) => setFirma({ ...firma, erloeskonto7: e.target.value })}
            />
          </div>
          <div>
            <Label>Erlöskonto 0 % (steuerfrei)</Label>
            <Input
              value={firma.erloeskonto0}
              onChange={(e) => setFirma({ ...firma, erloeskonto0: e.target.value })}
            />
          </div>
          <div>
            <Label>Debitor-Startnummer</Label>
            <Input
              type="number"
              value={firma.debitorStartnummer}
              onChange={(e) =>
                setFirma({ ...firma, debitorStartnummer: Number(e.target.value) || 10000 })
              }
            />
          </div>
        </div>
        <div className="mt-4">
          <DatevExport />
        </div>
      </section>

      {/* ── Bankkonten ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-neutral-700">Bankkonten</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBankForm(leereBank);
              setBankDialog(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Konto hinzufügen
          </Button>
        </div>
                <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-2 py-2 font-medium">Bezeichnung</th>
              <th className="px-2 py-2 font-medium">Bank</th>
              <th className="px-2 py-2 font-medium">IBAN</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {(banken.data ?? []).map((b) => (
              <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-2 py-2.5 font-medium">{b.bezeichnung}</td>
                <td className="px-2 py-2.5 text-neutral-600">{b.bankName}</td>
                <td className="px-2 py-2.5 font-mono text-xs text-neutral-600">
                  {b.iban.replace(/(.{4})/g, "$1 ").trim()}
                </td>
                <td className="px-2 py-2.5">
                  {b.istStandard && <Badge>Standard</Badge>}{" "}
                  {!b.aktiv && <Badge variant="secondary">inaktiv</Badge>}
                </td>
                <td className="px-2 py-2.5 text-right">
                  {!b.istStandard && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStandard.mutate({ id: b.id })}
                    >
                      Als Standard
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBankForm({
                        id: b.id,
                        bezeichnung: b.bezeichnung,
                        bankName: b.bankName,
                        kontoinhaber: b.kontoinhaber,
                        iban: b.iban,
                        bic: b.bic ?? "",
                      });
                      setBankDialog(true);
                    }}
                  >
                    Bearbeiten
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAktiv.mutate({ id: b.id, aktiv: !b.aktiv })}
                  >
                    {b.aktiv ? "Deaktivieren" : "Aktivieren"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {/* ── Nummernkreise ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Nummernkreise</h2>
        <p className="mb-4 text-xs text-neutral-500">
          Zeigt die jeweils nächste vergebene Nummer. Korrektur nur aufwärts möglich
          (GoBD: keine Lücken, keine Rücksetzung).
        </p>
                <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-2 py-2 font-medium">Kreis</th>
              <th className="px-2 py-2 font-medium">Letzte Nummer</th>
              <th className="px-2 py-2 font-medium">Nächste Nummer</th>
              <th className="px-2 py-2 text-right font-medium">Korrektur</th>
            </tr>
          </thead>
          <tbody>
            {(sequenzen.data ?? []).map((s) => {
              const key = `${s.typ}-${s.jahr}`;
              const naechste =
                s.typ === "invoice"
                  ? `${s.jahr}-${String(s.letzteNummer + 1).padStart(3, "0")}`
                  : `ST/${String(s.letzteNummer + 1).padStart(4, "0")}`;
              return (
                <tr key={key} className="border-b border-neutral-100 last:border-0">
                  <td className="px-2 py-2.5 font-medium">
                    {s.typ === "invoice" ? `Rechnungen ${s.jahr}` : "Gutschriften"}
                  </td>
                  <td className="px-2 py-2.5 text-neutral-600">
                    {s.typ === "invoice"
                      ? `${s.jahr}-${String(s.letzteNummer).padStart(3, "0")}`
                      : `ST/${String(s.letzteNummer).padStart(4, "0")}`}
                  </td>
                  <td className="px-2 py-2.5 font-medium">{naechste}</td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        className="w-28 text-right"
                        placeholder={String(s.letzteNummer + 1)}
                        value={seqWerte[key] ?? ""}
                        onChange={(e) =>
                          setSeqWerte({ ...seqWerte, [key]: e.target.value })
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!seqWerte[key]}
                        onClick={() =>
                          setSeq.mutate(
                            {
                              typ: s.typ as "invoice" | "credit_note",
                              jahr: s.jahr,
                              naechsteNummer: Number(seqWerte[key]),
                            },
                            {
                              onSuccess: () =>
                                setSeqWerte({ ...seqWerte, [key]: "" }),
                            },
                          )
                        }
                      >
                        Setzen
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {setSeq.error && <p className="mt-2 text-sm text-red-600">{setSeq.error.message}</p>}
      </section>

      {/* ── Benutzerverwaltung (nur Admin sichtbar) ── */}
      <Benutzerverwaltung />

      {/* ── Bank-Dialog ── */}
      <Dialog open={bankDialog} onOpenChange={setBankDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {bankForm.id ? "Bankkonto bearbeiten" : "Neues Bankkonto"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Bezeichnung *</Label>
              <Input
                value={bankForm.bezeichnung}
                onChange={(e) =>
                  setBankForm({ ...bankForm, bezeichnung: e.target.value })
                }
                placeholder="z. B. Geschäftskonto"
              />
            </div>
            <div>
              <Label>Bank *</Label>
              <Input
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                placeholder="z. B. SUMUP LIMITED"
              />
            </div>
            <div className="col-span-2">
              <Label>Kontoinhaber *</Label>
              <Input
                value={bankForm.kontoinhaber}
                onChange={(e) =>
                  setBankForm({ ...bankForm, kontoinhaber: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>IBAN *</Label>
              <Input
                value={bankForm.iban}
                onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                placeholder="IE55 SUMU 9903 6512 1193 01"
              />
            </div>
            <div>
              <Label>BIC</Label>
              <Input
                value={bankForm.bic}
                onChange={(e) => setBankForm({ ...bankForm, bic: e.target.value })}
              />
            </div>
          </div>
          {bankFehler && <p className="text-sm text-red-600">{bankFehler.message}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={bankAbsenden}
              disabled={
                !bankForm.bezeichnung ||
                !bankForm.bankName ||
                !bankForm.kontoinhaber ||
                !bankForm.iban
              }
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Unterschriftsbild für Rezepte/Atteste ───────────────────────────────────
function SignaturAbschnitt() {
  const utils = trpc.useUtils();
  const signatur = trpc.settings.signatur.useQuery();
  const [fehler, setFehler] = useState<string | null>(null);
  const setzen = trpc.settings.signaturSetzen.useMutation({
    onSuccess: () => {
      setFehler(null);
      utils.settings.signatur.invalidate();
      utils.settings.get.invalidate();
    },
    onError: (e) => setFehler(e.message),
  });

  const dateiLesen = (f: File) => {
    if (!/^image\/(png|jpe?g)$/.test(f.type)) {
      setFehler("Nur PNG oder JPG.");
      return;
    }
    if (f.size > 1_400_000) {
      setFehler("Bild zu groß (max. ca. 1,4 MB) — bitte vorher zuschneiden/komprimieren.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setzen.mutate({ dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-medium text-neutral-700">
        Unterschrift (Privat-Rezepte &amp; Atteste)
      </h2>
      <p className="mb-4 text-xs text-neutral-400">
        Wird als Bild auf erstellte Rezepte und Atteste gestempelt. Tipp: schwarze
        Unterschrift auf weißem Papier, mit dem Handy scharf fotografieren und
        freistellen (zuschneiden). Liegt kein Bild vor, erscheint nur die
        Unterschriftszeile zum handschriftlichen Signieren.
      </p>
      <p className="mb-4 text-xs text-neutral-400">
        Rechtlich einordnen: Das ist eine eingescannte handschriftliche Unterschrift
        — auf dem Ausdruck völlig ausreichend. Es ist bewusst <em>keine</em>{" "}
        qualifizierte elektronische Signatur (die bräuchte ein Zertifikat eines
        Vertrauensdienstanbieters) — einen entsprechenden Hinweis auf dem Dokument
        lassen wir deshalb bewusst weg, er würde nur verwirren.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {signatur.data?.dataUrl ? (
          <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
            <img
              src={signatur.data.dataUrl}
              alt="Hinterlegte Unterschrift"
              className="h-16 max-w-[220px] object-contain"
            />
          </div>
        ) : (
          <span className="text-sm text-neutral-400">Keine Unterschrift hinterlegt.</span>
        )}
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) dateiLesen(f);
              e.target.value = "";
            }}
          />
          <span className="inline-flex h-9 items-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium hover:bg-neutral-50">
            {setzen.isPending ? "Speichere …" : "Bild hochladen"}
          </span>
        </label>
        {signatur.data?.dataUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600"
            onClick={() => setzen.mutate({ dataUrl: null })}
            disabled={setzen.isPending}
          >
            Entfernen
          </Button>
        )}
        {fehler && <span className="text-sm text-red-600">{fehler}</span>}
      </div>
    </section>
  );
}

// ── Patientennummern-Nummernkreis ───────────────────────────────────────────
function PatientenNrAbschnitt({
  firma,
  setFirma,
}: {
  firma: FirmenForm;
  setFirma: (f: FirmenForm) => void;
}) {
  const vorschau = trpc.settings.patientenNrVorschau.useQuery();
  const utils = trpc.useUtils();

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-medium text-neutral-700">
        Patientennummern (Nummernkreis)
      </h2>
      <p className="mb-4 text-xs text-neutral-400">
        Neue Patienten bekommen automatisch die nächste freie Nummer — geregelt
        fortlaufend, ohne Raten und Duplikate. Wer selbst eine Nummer einträgt,
        überschreibt die Automatik für diesen Patienten. Speichern erfolgt oben
        über „Firmendaten speichern".
      </p>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <Label>Startzahl</Label>
          <Input
            type="number"
            min={1}
            className="w-32"
            value={firma.patientenNrStart}
            onChange={(e) =>
              setFirma({ ...firma, patientenNrStart: Number(e.target.value) || 1 })
            }
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#0F766E]"
            checked={firma.patientenNrPrefixAktiv}
            onChange={(e) =>
              setFirma({ ...firma, patientenNrPrefixAktiv: e.target.checked })
            }
          />
          mit Präfix
        </label>
        {firma.patientenNrPrefixAktiv && (
          <div>
            <Label>Präfix (frei wählbar)</Label>
            <Input
              className="w-40"
              placeholder="P, IMTZ, Praxis2, Klinik …"
              value={firma.patientenNrPrefix}
              onChange={(e) =>
                setFirma({ ...firma, patientenNrPrefix: e.target.value })
              }
            />
          </div>
        )}
        <div className="pb-1 text-sm text-neutral-500">
          Nächste Nummer:{" "}
          <button
            type="button"
            className="font-mono font-semibold text-teal-700"
            title="Vorschau aktualisieren"
            onClick={() => utils.settings.patientenNrVorschau.invalidate()}
          >
            {vorschau.data?.vorschau ?? "…"}
          </button>
          <span className="ml-2 text-xs text-neutral-400">(Vorschau, wird nicht verbraucht)</span>
        </div>
      </div>
    </section>
  );
}
