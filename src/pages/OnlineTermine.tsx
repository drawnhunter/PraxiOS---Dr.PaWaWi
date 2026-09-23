// ── PraxiOS: Online-Termine (Video) — eigene Praxis-Seite (1.19.0) ─────────
// Erstellen, bearbeiten, absagen, Gäste verwalten, selbst beitreten.
// Der Patient sieht seine Termine im Portal (Bereich „Online-Termine"),
// Gäste bekommen eigene Token-Links (kein Portal nötig).
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { basisUrl } from "@/lib/links";
import { kopiereInZwischenablage } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  CalendarPlus,
  Check,
  ClipboardCopy,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Video,
  VideoOff,
  X,
} from "lucide-react";

interface TerminForm {
  patientId: number | null;
  patientName: string;
  titel: string;
  datum: string;
  zeitVon: string;
  zeitBis: string;
  notiz: string;
}

const leerForm: TerminForm = {
  patientId: null,
  patientName: "",
  titel: "Videosprechstunde",
  datum: new Date().toISOString().slice(0, 10),
  zeitVon: "10:00",
  zeitBis: "10:30",
  notiz: "",
};

export default function OnlineTermine() {
  const utils = trpc.useUtils();
  const einstellungen = trpc.settings.get.useQuery(undefined, { retry: false });
  const [nurKommende, setNurKommende] = useState(true);
  const liste = trpc.onlineTermine.liste.useQuery({ nurKommende });
  const [dialog, setDialog] = useState<"neu" | number | null>(null); // "neu" oder Termin-ID (bearbeiten)
  const [form, setForm] = useState<TerminForm>(leerForm);
  const [suche, setSuche] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [gastOffen, setGastOffen] = useState<number | null>(null);
  const [gastName, setGastName] = useState("");
  const [gastEmail, setGastEmail] = useState("");

  const patienten = trpc.customers.list.useQuery(
    { suche: suche.trim() || undefined },
    { enabled: dialog !== null && form.patientId === null },
  );

  const neuLaden = () => utils.onlineTermine.liste.invalidate();

  const erstellen = trpc.onlineTermine.erstellen.useMutation({
    onSuccess: () => {
      setDialog(null);
      setForm(leerForm);
      setSuche("");
      setFehler(null);
      neuLaden();
    },
    onError: (e) => setFehler(e.message),
  });
  const bearbeiten = trpc.onlineTermine.bearbeiten.useMutation({
    onSuccess: () => {
      setDialog(null);
      setForm(leerForm);
      setFehler(null);
      neuLaden();
    },
    onError: (e) => setFehler(e.message),
  });
  const statusSetzen = trpc.onlineTermine.statusSetzen.useMutation({ onSuccess: neuLaden });
  const loeschen = trpc.onlineTermine.loeschen.useMutation({ onSuccess: neuLaden });
  const gastAdd = trpc.onlineTermine.gastHinzufuegen.useMutation({
    onSuccess: () => {
      setGastName("");
      setGastEmail("");
      neuLaden();
    },
  });
  const gastDel = trpc.onlineTermine.gastLoeschen.useMutation({ onSuccess: neuLaden });

  const gastLink = (token: string) =>
    `${basisUrl(einstellungen.data?.oeffentlicheUrl)}/online/${token}`;

  const kopieren = async (key: string, text: string) => {
    await kopiereInZwischenablage(text);
    setKopiert(key);
    setTimeout(() => setKopiert(null), 1500);
  };

  const absenden = () => {
    setFehler(null);
    if (!form.patientId) {
      setFehler("Bitte einen Patienten wählen.");
      return;
    }
    const payload = {
      patientId: form.patientId,
      titel: form.titel.trim() || "Videosprechstunde",
      datum: form.datum,
      zeitVon: form.zeitVon,
      zeitBis: form.zeitBis || null,
      notiz: form.notiz.trim() || undefined,
    };
    if (dialog === "neu") erstellen.mutate(payload);
    else if (typeof dialog === "number") bearbeiten.mutate({ id: dialog, ...payload });
  };

  const beitreten = async (id: number) => {
    const r = await utils.onlineTermine.beitritt.fetch({ id });
    window.open(r.raumUrl, "_blank", "noopener");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Video className="h-5 w-5 text-teal-700" /> Online-Termine
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Videosprechstunden erstellen und verwalten. Der Patient sieht seinen Termin
            im Portal, Gäste bekommen eigene Links.
          </p>
        </div>
        <Button onClick={() => { setForm(leerForm); setFehler(null); setDialog("neu"); }}>
          <CalendarPlus className="mr-1 h-4 w-4" /> Online-Termin erstellen
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <button
          onClick={() => setNurKommende(true)}
          className={`rounded-full px-3 py-1 ${nurKommende ? "bg-teal-700/10 font-medium text-teal-800" : "text-neutral-500 hover:bg-neutral-100"}`}
        >
          Kommende
        </button>
        <button
          onClick={() => setNurKommende(false)}
          className={`rounded-full px-3 py-1 ${!nurKommende ? "bg-teal-700/10 font-medium text-teal-800" : "text-neutral-500 hover:bg-neutral-100"}`}
        >
          Alle
        </button>
      </div>

      {(liste.data ?? []).length === 0 && !liste.isLoading && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
          Keine Online-Termine {nurKommende ? "geplant" : "vorhanden"}.
        </div>
      )}

      <div className="space-y-3">
        {(liste.data ?? []).map((t) => {
          const vergangen = t.datum < new Date().toISOString().slice(0, 10);
          return (
            <div key={t.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.titel}</span>
                    {t.status === "abgesagt" && <Badge variant="outline" className="border-red-200 text-red-600">abgesagt</Badge>}
                    {t.status === "dokumentiert" && <Badge variant="outline">dokumentiert</Badge>}
                  </div>
                  <div className="mt-1 text-sm text-neutral-600">
                    {t.patient?.name ?? "—"} · {datum(t.datum)} · {t.zeitVon}{t.zeitBis ? `–${t.zeitBis}` : ""} Uhr
                    {vergangen && <span className="ml-1 text-neutral-400">(vergangen)</span>}
                  </div>
                  {t.notiz && <div className="mt-1 text-xs text-neutral-400">{t.notiz}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {t.status === "geplant" && (
                    <Button size="sm" onClick={() => beitreten(t.id)}>
                      <Video className="mr-1 h-4 w-4" /> Beitreten
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => {
                      setForm({
                        patientId: t.patientId ?? null,
                        patientName: t.patient?.name ?? "",
                        titel: t.titel,
                        datum: t.datum,
                        zeitVon: t.zeitVon,
                        zeitBis: t.zeitBis ?? "",
                        notiz: t.notiz ?? "",
                      });
                      setFehler(null);
                      setDialog(t.id);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {t.status === "geplant" ? (
                    <Button
                      variant="ghost" size="sm" className="text-amber-700"
                      onClick={() => window.confirm("Termin absagen? Patient/Gäste sehen ihn dann nicht mehr als aktiv.") && statusSetzen.mutate({ id: t.id, status: "abgesagt" })}
                    >
                      <VideoOff className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => statusSetzen.mutate({ id: t.id, status: "geplant" })}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="sm" className="text-red-600"
                    onClick={() => window.confirm("Termin endgültig löschen (inkl. Gäste-Links)?") && loeschen.mutate({ id: t.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* ── Gäste ── */}
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <button
                  className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
                  onClick={() => setGastOffen(gastOffen === t.id ? null : t.id)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Gäste ({t.gaeste.length}) {gastOffen === t.id ? "▾" : "▸"}
                </button>
                {gastOffen === t.id && (
                  <div className="mt-2 space-y-2">
                    {t.gaeste.map((g) => (
                      <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-neutral-50 px-2.5 py-1.5 text-sm">
                        <div>
                          <span className="font-medium">{g.name}</span>
                          {g.email && <span className="ml-2 text-xs text-neutral-400">{g.email}</span>}
                          {g.zugegriffenAm && (
                            <span className="ml-2 text-xs text-teal-700">
                              ✓ aufgerufen {new Date(g.zugegriffenAm).toLocaleString("de-DE")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => kopieren(`g${g.id}`, gastLink(g.token))}>
                            <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
                            {kopiert === `g${g.id}` ? "kopiert!" : "Gast-Link"}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => gastDel.mutate({ id: g.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input value={gastName} onChange={(e) => setGastName(e.target.value)} placeholder="z. B. Angehörige/r" />
                      </div>
                      <div>
                        <Label className="text-xs">E-Mail (optional)</Label>
                        <Input value={gastEmail} onChange={(e) => setGastEmail(e.target.value)} placeholder="optional" />
                      </div>
                      <Button
                        variant="outline" size="sm"
                        disabled={!gastName.trim() || gastAdd.isPending}
                        onClick={() => gastAdd.mutate({ terminId: t.id, name: gastName.trim(), email: gastEmail.trim() || undefined })}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Gast hinzufügen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Erstellen/Bearbeiten-Dialog ── */}
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog === "neu" ? "Online-Termin erstellen" : "Online-Termin bearbeiten"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient *</Label>
              {form.patientId ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-medium">{form.patientName}</span>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setForm({ ...form, patientId: null, patientName: "" })}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> ändern
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    autoFocus
                    placeholder="Name eingeben …"
                    value={suche}
                    onChange={(e) => setSuche(e.target.value)}
                  />
                  <div className="mt-1 max-h-44 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-100">
                    {(patienten.data ?? []).slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm hover:bg-teal-50"
                        onClick={() => { setForm({ ...form, patientId: p.id, patientName: p.name }); setSuche(""); }}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-neutral-400">{p.plz} {p.ort}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div>
              <Label>Titel</Label>
              <Input value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Datum *</Label>
                <Input type="date" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} />
              </div>
              <div>
                <Label>Von *</Label>
                <Input type="time" value={form.zeitVon} onChange={(e) => setForm({ ...form, zeitVon: e.target.value })} />
              </div>
              <div>
                <Label>Bis</Label>
                <Input type="time" value={form.zeitBis} onChange={(e) => setForm({ ...form, zeitBis: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notiz (intern, optional)</Label>
              <Textarea rows={2} value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} />
            </div>
            <p className="text-xs text-neutral-400">
              Der Video-Raum wird beim Erstellen automatisch erzeugt. Der Patient sieht den
              Termin im Portal (Bereich „Online-Termine"); Gäste fügen Sie nach dem Erstellen
              hinzu und erhalten eigene Links.
            </p>
            {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button onClick={absenden} disabled={erstellen.isPending || bearbeiten.isPending}>
              {erstellen.isPending || bearbeiten.isPending ? "Speichere …" : dialog === "neu" ? "Erstellen" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
