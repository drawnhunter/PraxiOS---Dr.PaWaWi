// ── PraxiOS: Patienten-Portal (öffentliche Seite) ────────────────────────────
// Zugang: Link (30 Tage) + Geburtsdatum als zweiter Faktor → Session (24 h,
// im Browser gemerkt). Der Patient sieht ausschließlich seine eigenen Daten.
import { useState } from "react";
import { useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { pdfHerunterladen } from "@/lib/downloads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  ClipboardList,
  FileDown,
  FileText,
  Lock,
  LogOut,
  PencilLine,
  ShieldCheck,
} from "lucide-react";

const KATEGORIE_LABEL: Record<string, string> = {
  befund: "Befund",
  arztbrief: "Arztbrief",
  rezept: "Rezept",
  einverstaendnis: "Einverständnis",
};

export default function Portal() {
  const { token = "" } = useParams();
  const [session, setSession] = useState<string | null>(
    () => localStorage.getItem(`portal-session-${token}`),
  );

  const info = trpc.portal.info.useQuery({ token }, { retry: false });
  const einloggen = trpc.portal.einloggen.useMutation();
  const abmelden = trpc.portal.abmelden.useMutation();
  const [geb, setGeb] = useState("");

  if (info.isLoading) {
    return <Rahmen><p className="text-center text-sm text-neutral-500">Lade …</p></Rahmen>;
  }
  if (info.isError) {
    return (
      <Rahmen>
        <div className="text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
          <h1 className="text-lg font-semibold">Zugang nicht möglich</h1>
          <p className="mt-2 text-sm text-neutral-500">{info.error.message}</p>
        </div>
      </Rahmen>
    );
  }

  if (!session) {
    return (
      <Rahmen>
        <div className="text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-teal-700" />
          <h1 className="text-lg font-semibold">Patientenportal</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Guten Tag{info.data?.patientenName ? `, ${info.data.patientenName}` : ""}! Bitte melden Sie sich mit
            Ihrem Geburtsdatum an (Sicherheitsprüfung).
          </p>
        </div>
        <div className="mt-5 space-y-3">
          <div>
            <Label>Ihr Geburtsdatum (TT.MM.JJJJ)</Label>
            <Input
              placeholder="z. B. 01.02.1980"
              value={geb}
              onChange={(e) => setGeb(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && absenden()}
            />
          </div>
          <Button
            className="w-full"
            disabled={einloggen.isPending || geb.trim().length < 8}
            onClick={absenden}
          >
            {einloggen.isPending ? "Prüfe …" : "Anmelden"}
          </Button>
          {einloggen.error && (
            <p className="text-center text-sm text-red-600">{einloggen.error.message}</p>
          )}
          <p className="text-center text-xs text-neutral-400">
            Ihre Zugänge werden aus Sicherheitsgründen protokolliert (DSGVO). Nach {5} Fehlversuchen
            wird der Zugang 60 Minuten gesperrt.
          </p>
        </div>
      </Rahmen>
    );

    function absenden() {
      einloggen.mutate(
        { token, geburtsdatum: geb.trim() },
        {
          onSuccess: (r) => {
            localStorage.setItem(`portal-session-${token}`, r.session);
            setSession(r.session);
          },
        },
      );
    }
  }

  const bereiche = info.data?.bereiche;
  return (
    <Rahmen gross>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Patientenportal{info.data?.patientenName ? ` — ${info.data.patientenName}` : ""}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            abmelden.mutate({ session });
            localStorage.removeItem(`portal-session-${token}`);
            setSession(null);
          }}
        >
          <LogOut className="mr-1 h-4 w-4" /> Abmelden
        </Button>
      </div>

      <Tabs defaultValue={bereiche?.termine ? "termine" : "plan"}>
        <TabsList className="flex-wrap">
          {bereiche?.termine && <TabsTrigger value="termine"><CalendarDays className="mr-1 h-4 w-4" />Termine</TabsTrigger>}
          {bereiche?.therapieplan && <TabsTrigger value="plan"><ClipboardList className="mr-1 h-4 w-4" />Mein Verlauf</TabsTrigger>}
          {bereiche?.dokumente && <TabsTrigger value="dokumente"><FileText className="mr-1 h-4 w-4" />Dokumente</TabsTrigger>}
          {bereiche?.atteste && <TabsTrigger value="atteste"><FileDown className="mr-1 h-4 w-4" />Atteste</TabsTrigger>}
          {bereiche?.daten && <TabsTrigger value="daten"><PencilLine className="mr-1 h-4 w-4" />Meine Daten</TabsTrigger>}
          {bereiche?.terminanfragen && <TabsTrigger value="anfragen">Terminanfragen</TabsTrigger>}
        </TabsList>

        {bereiche?.termine && (
          <TabsContent value="termine"><Termine session={session} /></TabsContent>
        )}
        {bereiche?.therapieplan && (
          <TabsContent value="plan"><Therapieplan session={session} /></TabsContent>
        )}
        {bereiche?.dokumente && (
          <TabsContent value="dokumente"><Dokumente session={session} /></TabsContent>
        )}
        {bereiche?.atteste && (
          <TabsContent value="atteste"><Atteste session={session} /></TabsContent>
        )}
        {bereiche?.daten && (
          <TabsContent value="daten"><Daten session={session} /></TabsContent>
        )}
        {bereiche?.terminanfragen && (
          <TabsContent value="anfragen"><Anfragen session={session} /></TabsContent>
        )}
      </Tabs>

      <p className="mt-6 text-center text-xs text-neutral-400">
        Geschützter Bereich: Sie sehen ausschließlich Ihre eigenen Daten. Jeder Zugriff wird
        aus Sicherheitsgründen protokolliert (DSGVO, Art. 9). Die Session endet nach 24 Stunden.
      </p>
    </Rahmen>
  );
}

// ── Rahmen ──────────────────────────────────────────────────────────────────
function Rahmen({ children, gross }: { children: React.ReactNode; gross?: boolean }) {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-6 sm:py-10">
      <div className={`mx-auto ${gross ? "max-w-3xl" : "max-w-md"}`}>
        <div className="mb-4 text-center">
          <div className="text-xl font-extrabold tracking-tight">
            Dr.<span className="text-teal-700">PaWaWi</span>
          </div>
          <div className="mt-0.5 text-xs text-neutral-400">Patientenportal</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}

function Fehler({ e }: { e: { message: string } }) {
  return <p className="text-sm text-red-600">{e.message}</p>;
}

// ── Termine ─────────────────────────────────────────────────────────────────
function Termine({ session }: { session: string }) {
  const q = trpc.portal.termine.useQuery({ session }, { retry: false });
  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Termine …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const eintraege = q.data?.eintraege ?? [];
  if (eintraege.length === 0) {
    return <p className="text-sm text-neutral-400">Derzeit keine kommenden Termine.</p>;
  }
  return (
    <div className="space-y-1.5">
      {eintraege.map((t, i) => (
        <div key={i} className="flex items-center justify-between rounded-md border border-neutral-100 px-3 py-2 text-sm">
          <span className="font-medium tabular-nums">{datum(t.datum)}</span>
          <span className="text-neutral-600 tabular-nums">
            {[t.zeitVon, t.zeitBis].filter(Boolean).join("–") || "—"}
          </span>
          <span className="text-neutral-700">{t.leistung ?? "Termin"}</span>
          {t.raum && <span className="text-xs text-neutral-400">{t.raum}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Therapieplan ────────────────────────────────────────────────────────────
function Therapieplan({ session }: { session: string }) {
  const q = trpc.portal.therapieplan.useQuery({ session }, { retry: false });
  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Verlauf …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const plaene = q.data?.plaene ?? [];
  if (plaene.length === 0) {
    return <p className="text-sm text-neutral-400">Noch kein Therapieverlauf dokumentiert.</p>;
  }
  return (
    <div className="space-y-4">
      {plaene.map((p, i) => (
        <section key={i}>
          <h3 className="mb-1.5 text-sm font-semibold">
            {p.titel ?? "Therapieplan"}{" "}
            <span className="font-normal text-neutral-500">
              ({datum(p.vonDatum)}–{datum(p.bisDatum)})
            </span>
          </h3>
          <div className="space-y-1">
            {p.eintraege.map((e, j) => (
              <div key={j} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 tabular-nums text-neutral-500">{datum(e.datum)}</span>
                <span className="w-20 shrink-0 tabular-nums text-neutral-500">
                  {[e.zeitVon, e.zeitBis].filter(Boolean).join("–") || "—"}
                </span>
                <span className="flex-1">{e.leistung ?? "Leistung"}</span>
                <Badge variant="outline" className={
                  e.status === "stattgefunden" ? "border-green-300 text-green-700"
                  : e.status === "ausgefallen" || e.status === "abgesagt" ? "border-red-300 text-red-600"
                  : ""
                }>
                  {e.status === "stattgefunden" ? "erledigt" : e.status === "ausgefallen" ? "ausgefallen" : e.status === "abgesagt" ? "abgesagt" : "geplant"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Dokumente ───────────────────────────────────────────────────────────────
function Dokumente({ session }: { session: string }) {
  const utils = trpc.useUtils();
  const q = trpc.portal.dokumente.useQuery({ session }, { retry: false });
  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Dokumente …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const dokus = q.data?.dokumente ?? [];
  if (dokus.length === 0) {
    return <p className="text-sm text-neutral-400">Keine Dokumente freigegeben.</p>;
  }
  return (
    <div className="space-y-1.5">
      {dokus.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-100 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{d.dateiname}</div>
            <div className="text-xs text-neutral-400">
              {KATEGORIE_LABEL[d.kategorie] ?? d.kategorie} · {new Date(d.erstelltAm).toLocaleDateString("de-DE")}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const r = await utils.portal.dokumentDatei.fetch({ session, id: d.id });
              pdfHerunterladen({ dateiname: r.dateiname, base64: r.base64 });
            }}
          >
            <FileDown className="mr-1 h-4 w-4" /> PDF
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── Atteste ─────────────────────────────────────────────────────────────────
function Atteste({ session }: { session: string }) {
  const utils = trpc.useUtils();
  const q = trpc.portal.atteste.useQuery({ session }, { retry: false });
  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Atteste …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const atteste = q.data?.atteste ?? [];
  if (atteste.length === 0) {
    return <p className="text-sm text-neutral-400">Keine Atteste vorhanden.</p>;
  }
  return (
    <div className="space-y-1.5">
      {atteste.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-100 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {a.typ === "rezept" ? "Rezept" : "Attest/AU"} — {a.zusammenfassung}
            </div>
            <div className="text-xs text-neutral-400">
              {new Date(a.erstelltAm).toLocaleDateString("de-DE")}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const r = await utils.portal.attestPdf.fetch({ session, id: a.id });
              pdfHerunterladen(r);
            }}
          >
            <FileDown className="mr-1 h-4 w-4" /> PDF
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── Daten + Antrag ──────────────────────────────────────────────────────────
function Daten({ session }: { session: string }) {
  const q = trpc.portal.daten.useQuery({ session }, { retry: false });
  const utils = trpc.useUtils();
  const erstellen = trpc.portal.datenAntrag.useMutation({
    onSuccess: () => utils.portal.daten.invalidate({ session }),
  });
  const [feld, setFeld] = useState<"strasse" | "plz" | "ort" | "email" | "telefon">("email");
  const [neu, setNeu] = useState("");

  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Daten …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const p = q.data!.patient;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(
          [
            ["Name", p.name],
            ["Straße", p.strasse],
            ["PLZ", p.plz],
            ["Ort", p.ort],
            ["E-Mail", p.email],
            ["Telefon", p.telefon],
          ] as const
        ).map(([label, wert]) => (
          <div key={label}>
            <div className="text-xs text-neutral-400">{label}</div>
            <div className="text-sm">{wert?.trim() ? wert : "—"}</div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h3 className="mb-2 text-sm font-medium">Änderung vorschlagen</h3>
        <p className="mb-3 text-xs text-neutral-400">
          Änderungen werden erst nach Bestätigung durch die Praxis übernommen.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Feld</Label>
            <Select value={feld} onValueChange={(v) => setFeld(v as typeof feld)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strasse">Straße</SelectItem>
                <SelectItem value="plz">PLZ</SelectItem>
                <SelectItem value="ort">Ort</SelectItem>
                <SelectItem value="email">E-Mail</SelectItem>
                <SelectItem value="telefon">Telefon</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-44 flex-1">
            <Label className="text-xs">Neuer Wert</Label>
            <Input value={neu} onChange={(e) => setNeu(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={!neu.trim() || erstellen.isPending}
            onClick={() => {
              erstellen.mutate({ session, felder: [{ feld, neu: neu.trim() }] });
              setNeu("");
            }}
          >
            Vorschlagen
          </Button>
        </div>
        {erstellen.data && <p className="mt-2 text-xs text-green-700">{erstellen.data.hinweis}</p>}
        {erstellen.error && <p className="mt-2 text-xs text-red-600">{erstellen.error.message}</p>}
      </section>

      {(q.data!.antraege ?? []).length > 0 && (
        <section>
          <h3 className="mb-1.5 text-sm font-medium">Meine bisherigen Anträge</h3>
          <div className="space-y-1.5">
            {q.data!.antraege.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-neutral-700">
                  {a.felder.map((f) => `${f.feld}: „${f.alt || "—"}" → „${f.neu}"`).join(" · ")}
                </span>
                <Badge variant={a.status === "bestaetigt" ? "default" : "outline"}>
                  {a.status === "offen" ? "in Prüfung" : a.status === "bestaetigt" ? "übernommen" : "abgelehnt"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Terminanfragen ──────────────────────────────────────────────────────────
function Anfragen({ session }: { session: string }) {
  const q = trpc.portal.terminAnfragen.useQuery({ session }, { retry: false });
  const utils = trpc.useUtils();
  const erstellen = trpc.portal.terminAnfrageErstellen.useMutation({
    onSuccess: () => utils.portal.terminAnfragen.invalidate({ session }),
  });
  const [wunschDatum, setWunschDatum] = useState("");
  const [wunschVon, setWunschVon] = useState("");
  const [wunschBis, setWunschBis] = useState("");
  const [notiz, setNotiz] = useState("");

  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Anfragen …</p>;
  if (q.isError) return <Fehler e={q.error} />;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-neutral-200 p-4">
        <h3 className="mb-2 text-sm font-medium">Neue Terminanfrage</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Wunschdatum *</Label>
            <Input type="date" value={wunschDatum} onChange={(e) => setWunschDatum(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Von (optional)</Label>
            <Input type="time" value={wunschVon} onChange={(e) => setWunschVon(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Bis (optional)</Label>
            <Input type="time" value={wunschBis} onChange={(e) => setWunschBis(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <Label className="text-xs">Notiz (optional)</Label>
          <Textarea rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} />
        </div>
        <Button
          size="sm"
          className="mt-3"
          disabled={!wunschDatum || erstellen.isPending}
          onClick={() =>
            erstellen.mutate({
              session,
              wunschDatum,
              wunschVon: wunschVon || undefined,
              wunschBis: wunschBis || undefined,
              notiz: notiz.trim() || undefined,
            })
          }
        >
          Anfrage senden
        </Button>
        {erstellen.data && <p className="mt-2 text-xs text-green-700">{erstellen.data.hinweis}</p>}
        {erstellen.error && <p className="mt-2 text-xs text-red-600">{erstellen.error.message}</p>}
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-medium">Meine Anfragen</h3>
        {(q.data?.anfragen ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">Noch keine Anfragen gestellt.</p>
        ) : (
          <div className="space-y-1.5">
            {q.data!.anfragen.map((a) => (
              <div key={a.id} className="rounded-md border border-neutral-100 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium tabular-nums">
                    {datum(a.wunschDatum)}
                    {a.wunschVon || a.wunschBis ? ` · ${[a.wunschVon, a.wunschBis].filter(Boolean).join("–")}` : ""}
                  </span>
                  <Badge variant={a.status === "bestaetigt" ? "default" : "outline"}>
                    {a.status === "offen" ? "in Prüfung" : a.status === "bestaetigt" ? "bestätigt" : "abgelehnt"}
                  </Badge>
                </div>
                {a.notiz && <div className="mt-1 text-xs text-neutral-500">{a.notiz}</div>}
                {a.praxisKommentar && (
                  <div className="mt-1 text-xs text-teal-700">Praxis: {a.praxisKommentar}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
