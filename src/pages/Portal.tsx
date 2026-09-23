// ── PraxiOS: Patienten-Portal (öffentliche Seite) ────────────────────────────
// Zugang: Link (30 Tage) + Geburtsdatum als zweiter Faktor → Session (24 h,
// im Browser gemerkt). Der Patient sieht ausschließlich seine eigenen Daten.
// Layout v1.11.0: Sidebar (Personendaten + Menü) links, Detailansicht rechts;
// auf kleinen Bildschirmen klappt die Sidebar als Leiste nach oben.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock,
  FileDown,
  FileText,
  Lock,
  LogOut,
  PencilLine,
  ShieldCheck,
  UserRound,
  Video,
} from "lucide-react";

const KATEGORIE_LABEL: Record<string, string> = {
  befund: "Befund",
  arztbrief: "Arztbrief",
  rezept: "Rezept",
  einverstaendnis: "Einverständnis",
  anamnesebogen: "Anamnesebogen",
  sonstiges: "Sonstiges",
};

type BereichKey = "termine" | "plan" | "dokumente" | "atteste" | "daten" | "anfragen" | "online";

interface Bereiche {
  termine: boolean;
  therapieplan: boolean;
  dokumente: boolean;
  atteste: boolean;
  daten: boolean;
  terminanfragen: boolean;
  onlineTermine?: boolean;
}

function menuEintraege(b: Bereiche | undefined): { key: BereichKey; label: string; icon: typeof CalendarDays }[] {
  if (!b) return [];
  const alle = [
    { key: "termine" as const, label: "Termine", icon: CalendarDays, on: b.termine },
    { key: "online" as const, label: "Online-Termine", icon: Video, on: b.onlineTermine !== false },
    { key: "plan" as const, label: "Mein Verlauf", icon: ClipboardList, on: b.therapieplan },
    { key: "dokumente" as const, label: "Dokumente", icon: FileText, on: b.dokumente },
    { key: "atteste" as const, label: "Atteste & Rezepte", icon: FileDown, on: b.atteste },
    { key: "daten" as const, label: "Meine Daten", icon: PencilLine, on: b.daten },
    { key: "anfragen" as const, label: "Terminanfragen", icon: Clock, on: b.terminanfragen },
  ];
  return alle.filter((e) => e.on).map(({ key, label, icon }) => ({ key, label, icon }));
}

export default function Portal() {
  const { token = "" } = useParams();
  const [session, setSession] = useState<string | null>(
    () => localStorage.getItem(`portal-session-${token}`),
  );
  const [sessionBis, setSessionBis] = useState<string | null>(
    () => localStorage.getItem(`portal-session-bis-${token}`),
  );
  const [bereich, setBereich] = useState<BereichKey | null>(null);

  const info = trpc.portal.info.useQuery({ token }, { retry: false });
  const einloggen = trpc.portal.einloggen.useMutation();
  const abmelden = trpc.portal.abmelden.useMutation();
  const [geb, setGeb] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinFehler, setPinFehler] = useState<string | null>(null);

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
    const hatPin = info.data?.hatPin === true;
    return (
      <Rahmen>
        <div className="text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-teal-700" />
          <h1 className="text-lg font-semibold">Patientenportal</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Guten Tag{info.data?.patientenName ? `, ${info.data.patientenName}` : ""}!{" "}
            {hatPin
              ? "Bitte melden Sie sich mit Ihrer PIN an."
              : "Bitte melden Sie sich mit Ihrem Geburtsdatum an (Sicherheitsprüfung)."}
          </p>
        </div>
        <div className="mt-5 space-y-3">
          {hatPin ? (
            <div>
              <Label>Ihre 4-stellige PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="····"
                className="text-center text-lg tracking-[0.5em]"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && absenden()}
              />
              <p className="mt-2 text-center text-xs text-neutral-400">
                Sie haben noch keine PIN gewählt, werden aber danach gefragt? Dann war
                möglicherweise jemand vor Ihnen auf diesem Link — bitte informieren Sie
                die Praxis.
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label>Ihr Geburtsdatum (TT.MM.JJJJ)</Label>
                <Input
                  placeholder="z. B. 01.02.1980"
                  value={geb}
                  onChange={(e) => setGeb(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && absenden()}
                />
              </div>
              <div className="rounded-md border border-teal-100 bg-teal-50/50 p-3">
                <Label>Wählen Sie jetzt Ihre PIN (4 Ziffern)</Label>
                <p className="mb-2 mt-0.5 text-xs text-neutral-500">
                  Ab dem nächsten Besuch melden Sie sich nur noch mit dieser PIN an.
                  Gut merken — die Praxis kann sie nicht einsehen, nur zurücksetzen.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    placeholder="PIN"
                    className="text-center tracking-[0.4em]"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    placeholder="Wiederholung"
                    className="text-center tracking-[0.4em]"
                    value={pin2}
                    onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onKeyDown={(e) => e.key === "Enter" && absenden()}
                  />
                </div>
              </div>
            </>
          )}
          {pinFehler && <p className="text-center text-sm text-red-600">{pinFehler}</p>}
          <Button
            className="w-full"
            disabled={
              einloggen.isPending ||
              (hatPin
                ? pin.length !== 4
                : geb.trim().length < 8 || pin.length !== 4 || pin2.length !== 4)
            }
            onClick={absenden}
          >
            {einloggen.isPending ? "Prüfe …" : hatPin ? "Anmelden" : "Anmelden und PIN festlegen"}
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
      setPinFehler(null);
      if (!info.data?.hatPin) {
        if (pin !== pin2) {
          setPinFehler("Die PINs stimmen nicht überein.");
          return;
        }
        einloggen.mutate(
          { token, geburtsdatum: geb.trim(), neuePin: pin },
          { onSuccess: (r) => sessionStarten(r) },
        );
      } else {
        einloggen.mutate({ token, pin }, { onSuccess: (r) => sessionStarten(r) });
      }
    }

    function sessionStarten(r: { session: string; gueltigBis: string }) {
      localStorage.setItem(`portal-session-${token}`, r.session);
      localStorage.setItem(`portal-session-bis-${token}`, r.gueltigBis);
      setSession(r.session);
      setSessionBis(r.gueltigBis);
    }
  }

  const menu = menuEintraege(info.data?.bereiche);
  const aktiv: BereichKey | null =
    bereich && menu.some((m) => m.key === bereich) ? bereich : (menu[0]?.key ?? null);

  function logout() {
    abmelden.mutate({ session: session! });
    localStorage.removeItem(`portal-session-${token}`);
    localStorage.removeItem(`portal-session-bis-${token}`);
    setSession(null);
  }

  const bisText = sessionBis
    ? new Date(sessionBis).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Rahmen gross>
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
        {/* ── Sidebar: Person + Menü ─────────────────────────────────────── */}
        <aside className="mb-5 md:mb-0">
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-700/10">
              <UserRound className="h-5 w-5 text-teal-700" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{info.data?.patientenName ?? "Patientin/Patient"}</div>
              <div className="text-xs text-neutral-400">Patientenportal</div>
              {bisText && (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
                  <Clock className="h-3 w-3" /> angemeldet bis {bisText} Uhr
                </div>
              )}
            </div>
          </div>

          {/* Menü: mobil horizontale Leiste, ab md vertikal */}
          <nav className="mt-3 flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {menu.map((m) => (
              <button
                key={m.key}
                onClick={() => setBereich(m.key)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  aktiv === m.key
                    ? "bg-teal-700/10 font-medium text-teal-800"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <m.icon className="h-4 w-4 shrink-0" />
                {m.label}
              </button>
            ))}
          </nav>

          <div className="mt-3 border-t border-neutral-100 pt-3">
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100"
            >
              <LogOut className="h-4 w-4" /> Abmelden
            </button>
            <p className="mt-2 px-3 text-[11px] leading-snug text-neutral-400">
              Geschützter Bereich: Sie sehen ausschließlich Ihre eigenen Daten. Jeder Zugriff wird
              protokolliert (DSGVO, Art. 9). Die Session endet nach 24 Stunden.
            </p>
          </div>
        </aside>

        {/* ── Detailansicht ──────────────────────────────────────────────── */}
        <main className="min-w-0">
          {aktiv === "termine" && <Termine session={session} />}
          {aktiv === "online" && <OnlineTerminePortal session={session} />}
          {aktiv === "plan" && <Therapieplan session={session} />}
          {aktiv === "dokumente" && <Dokumente session={session} />}
          {aktiv === "atteste" && <Atteste session={session} />}
          {aktiv === "daten" && <Daten session={session} />}
          {aktiv === "anfragen" && <Anfragen session={session} />}
        </main>
      </div>
    </Rahmen>
  );
}

// ── Rahmen ──────────────────────────────────────────────────────────────────
function Rahmen({ children, gross }: { children: React.ReactNode; gross?: boolean }) {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-6 sm:py-10">
      <div className={`mx-auto ${gross ? "max-w-5xl" : "max-w-md"}`}>
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

// ── Status-Darstellung (Termine & Verlauf) ──────────────────────────────────
function statusInfo(status: string | null | undefined): { label: string; cls: string } {
  switch (status) {
    case "stattgefunden":
      return { label: "erledigt", cls: "border-green-200 bg-green-50 text-green-700" };
    case "ausgefallen":
      return { label: "ausgefallen", cls: "border-red-200 bg-red-50 text-red-600" };
    case "abgesagt":
      return { label: "abgesagt", cls: "border-red-200 bg-red-50 text-red-600" };
    default:
      return { label: "geplant", cls: "border-neutral-200 bg-neutral-50 text-neutral-500" };
  }
}

function wochentag(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("de-DE", { weekday: "long" });
}

// ── Termine (nach Tagen gruppiert) ──────────────────────────────────────────
function Termine({ session }: { session: string }) {
  const q = trpc.portal.termine.useQuery({ session }, { retry: false });
  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Termine …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const eintraege = q.data?.eintraege ?? [];
  if (eintraege.length === 0) {
    return <p className="text-sm text-neutral-400">Derzeit keine kommenden Termine.</p>;
  }
  const tage = new Map<string, typeof eintraege>();
  for (const t of eintraege) {
    const k = t.datum;
    tage.set(k, [...(tage.get(k) ?? []), t]);
  }
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Ihre kommenden Termine</h2>
      <div className="space-y-3">
        {[...tage.entries()].map(([tag, liste]) => (
          <section key={tag} className="rounded-xl border border-neutral-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {wochentag(tag)}, {datum(tag)}
              </h3>
              <Badge variant="outline">{liste.length === 1 ? "1 Termin" : `${liste.length} Termine`}</Badge>
            </div>
            <div className="space-y-1.5">
              {liste.map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 font-medium tabular-nums text-teal-800">
                    {[t.zeitVon, t.zeitBis].filter(Boolean).join("–") || "—"}
                  </span>
                  <span className="flex-1 text-neutral-700">{t.leistung ?? "Termin"}</span>
                  {t.raum && <span className="text-xs text-neutral-400">{t.raum}</span>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ── Therapieplan (Tageskarten statt Einzelzeilen) ───────────────────────────
interface PlanEintrag {
  datum: string;
  zeitVon?: string | null;
  zeitBis?: string | null;
  leistung?: string | null;
  status?: string | null;
}

function Therapieplan({ session }: { session: string }) {
  const q = trpc.portal.therapieplan.useQuery({ session }, { retry: false });
  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Verlauf …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const plaene = q.data?.plaene ?? [];
  if (plaene.length === 0) {
    return <p className="text-sm text-neutral-400">Noch kein Therapieverlauf dokumentiert.</p>;
  }
  return (
    <div className="space-y-6">
      {plaene.map((p, i) => {
        const eintraege = p.eintraege as PlanEintrag[];
        const tage = new Map<string, PlanEintrag[]>();
        for (const e of eintraege) {
          tage.set(e.datum, [...(tage.get(e.datum) ?? []), e]);
        }
        const gesamt = eintraege.length;
        const erledigt = eintraege.filter((e) => e.status === "stattgefunden").length;
        return (
          <section key={i}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">
                {p.titel ?? "Therapieplan"}{" "}
                <span className="font-normal text-neutral-500">
                  ({datum(p.vonDatum)}–{datum(p.bisDatum)})
                </span>
              </h2>
              <span className="text-xs text-neutral-400">
                {gesamt} Anwendungen · {erledigt} erledigt
              </span>
            </div>
            <div className="space-y-3">
              {[...tage.entries()].map(([tag, liste]) => {
                const tagErledigt = liste.filter((e) => e.status === "stattgefunden").length;
                const alleErledigt = tagErledigt === liste.length;
                const keiner = tagErledigt === 0 && liste.every((e) => !e.status || e.status === "geplant");
                return (
                  <div key={tag} className="rounded-xl border border-neutral-200 p-4">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">
                        {wochentag(tag)}, {datum(tag)}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs">
                        {alleErledigt ? (
                          <span className="flex items-center gap-1 text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> abgeschlossen
                          </span>
                        ) : keiner ? (
                          <span className="flex items-center gap-1 text-neutral-400">
                            <CircleDashed className="h-3.5 w-3.5" /> geplant
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-700">
                            <CircleDashed className="h-3.5 w-3.5" /> {tagErledigt}/{liste.length} erledigt
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {liste.map((e, j) => {
                        const s = statusInfo(e.status);
                        return (
                          <div
                            key={j}
                            className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-sm"
                          >
                            <span className="min-w-0 truncate text-neutral-700">
                              {e.zeitVon && <span className="mr-1.5 tabular-nums text-neutral-400">{e.zeitVon}</span>}
                              {e.leistung ?? "Leistung"}
                            </span>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${s.cls}`}>
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── Dokumente ───────────────────────────────────────────────────────────────
function Dokumente({ session }: { session: string }) {
  const utils = trpc.useUtils();
  const q = trpc.portal.dokumente.useQuery({ session }, { retry: false });
  const [ladend, setLadend] = useState<number | null>(null);
  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Dokumente …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const dokus = q.data?.dokumente ?? [];
  if (dokus.length === 0) {
    return <p className="text-sm text-neutral-400">Keine Dokumente vorhanden.</p>;
  }
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Ihre Dokumente</h2>
      <div className="space-y-1.5">
        {dokus.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{d.dateiname}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                <Badge variant="outline" className="text-[10px]">
                  {KATEGORIE_LABEL[d.kategorie] ?? d.kategorie}
                </Badge>
                {new Date(d.erstelltAm).toLocaleDateString("de-DE")}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={ladend === d.id}
              onClick={async () => {
                setLadend(d.id);
                try {
                  const r = await utils.portal.dokumentDatei.fetch({ session, id: d.id });
                  pdfHerunterladen({ dateiname: r.dateiname, base64: r.base64 });
                } finally {
                  setLadend(null);
                }
              }}
            >
              <FileDown className="mr-1 h-4 w-4" /> {ladend === d.id ? "Lade …" : "PDF"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Atteste ─────────────────────────────────────────────────────────────────
function Atteste({ session }: { session: string }) {
  const utils = trpc.useUtils();
  const q = trpc.portal.atteste.useQuery({ session }, { retry: false });
  const [ladend, setLadend] = useState<number | null>(null);
  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Atteste …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const atteste = q.data?.atteste ?? [];
  if (atteste.length === 0) {
    return <p className="text-sm text-neutral-400">Keine Atteste vorhanden.</p>;
  }
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Atteste & Rezepte</h2>
      <div className="space-y-1.5">
        {atteste.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2.5">
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
              disabled={ladend === a.id}
              onClick={async () => {
                setLadend(a.id);
                try {
                  const r = await utils.portal.attestPdf.fetch({ session, id: a.id });
                  pdfHerunterladen(r);
                } finally {
                  setLadend(null);
                }
              }}
            >
              <FileDown className="mr-1 h-4 w-4" /> {ladend === a.id ? "Lade …" : "PDF"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Online-Termine (Video, 1.19.0) ─────────────────────────────────────────
function OnlineTerminePortal({ session }: { session: string }) {
  const utils = trpc.useUtils();
  const q = trpc.portal.onlineTermine.useQuery({ session }, { retry: false });
  const [beitritt, setBeitritt] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  if (q.isLoading) return <p className="text-sm text-neutral-500">Lade Online-Termine …</p>;
  if (q.isError) return <Fehler e={q.error} />;
  const termine = q.data?.termine ?? [];
  if (termine.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-base font-semibold">Online-Termine</h2>
        <p className="text-sm text-neutral-400">Derzeit sind keine Video-Termine geplant.</p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Ihre Online-Termine</h2>
      <div className="space-y-3">
        {termine.map((t) => {
          const heute = new Date().toISOString().slice(0, 10);
          const istHeute = t.datum === heute;
          return (
            <div key={t.id} className={`rounded-xl border p-4 ${istHeute ? "border-teal-300 bg-teal-50/40" : "border-neutral-200"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{t.titel}</div>
                  <div className="mt-0.5 text-sm text-neutral-600">
                    {istHeute ? <span className="font-medium text-teal-800">Heute, </span> : null}
                    {datum(t.datum)} · <span className="tabular-nums">{t.zeitVon}{t.zeitBis ? `–${t.zeitBis}` : ""} Uhr</span>
                  </div>
                  {t.notiz && <div className="mt-1 text-xs text-neutral-400">{t.notiz}</div>}
                </div>
                <Button
                  disabled={beitritt === t.id}
                  onClick={async () => {
                    setBeitritt(t.id);
                    setFehler(null);
                    try {
                      const r = await utils.portal.onlineTerminBeitritt.fetch({ session, id: t.id });
                      window.open(r.raumUrl, "_blank", "noopener");
                    } catch (e) {
                      setFehler(e instanceof Error ? e.message : String(e));
                    } finally {
                      setBeitritt(null);
                    }
                  }}
                >
                  <Video className="mr-1.5 h-4 w-4" />
                  {beitritt === t.id ? "Öffne …" : "Beitreten"}
                </Button>
              </div>
              {istHeute && (
                <p className="mt-2 text-xs text-teal-700">
                  Tipp: treten Sie ein paar Minuten früher bei und erlauben Sie Kamera &amp; Mikrofon.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {fehler && <p className="mt-2 text-sm text-red-600">{fehler}</p>}
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
      <h2 className="text-base font-semibold">Meine Daten</h2>
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
      <h2 className="text-base font-semibold">Terminanfragen</h2>
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
