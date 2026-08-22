import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { geld, datum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TerminKarte } from "./Kalender";
import {
  CalendarDays,
  ClipboardList,
  FileWarning,
  UserPlus,
  Users,
  FileText,
  FileUp,
  CircleAlert,
} from "lucide-react";

export default function Dashboard() {
  const uebersicht = trpc.dashboard.uebersicht.useQuery();
  const heute = trpc.dashboard.heute.useQuery();
  const stats = trpc.dashboard.stats.useQuery();

  const kennzahlen = [
    {
      label: "Patienten gesamt",
      wert: uebersicht.data?.patientenGesamt,
      icon: Users,
      warn: false,
      zu: "/patienten",
    },
    {
      label: "Aktive Pläne",
      wert: uebersicht.data?.aktivePlaene,
      icon: ClipboardList,
      warn: false,
      zu: "/plaene",
    },
    {
      label: "Dokumentationsfällig",
      wert: uebersicht.data?.dokumentationsfaellig,
      icon: FileWarning,
      warn: (uebersicht.data?.dokumentationsfaellig ?? 0) > 0,
      zu: "/plaene",
    },
    {
      label: "Termine heute",
      wert: uebersicht.data?.termineHeute,
      icon: CalendarDays,
      warn: false,
      zu: "/kalender",
    },
  ];

  const abrechnung = stats.data
    ? [
        {
          label: "Entwürfe (Prüfliste)",
          wert: stats.data.anzahlEntwuerfe,
          icon: FileUp,
          warn: stats.data.anzahlEntwuerfe > 0,
          zu: "/rechnungen",
        },
        {
          label: "Offene Rechnungen",
          wert: geld(stats.data.offenGesamt),
          icon: FileText,
          warn: false,
          zu: "/rechnungen",
        },
        {
          label: "Überfällig",
          wert: stats.data.anzahlUeberfaellig,
          icon: CircleAlert,
          warn: stats.data.anzahlUeberfaellig > 0,
          zu: "/rechnungen",
        },
      ]
    : [];

  const termine = [...(heute.data ?? [])].sort((a, b) =>
    (a.entry.zeitVon ?? "99:99").localeCompare(b.entry.zeitVon ?? "99:99"),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Übersicht</h1>

      <BackupErinnerung />

      {/* ── Praxis-Kennzahlen ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kennzahlen.map((k) => (
          <Link
            key={k.label}
            to={k.zu}
            className={cn(
              "rounded-lg border bg-white p-4 transition-colors hover:bg-neutral-50",
              k.warn ? "border-amber-300" : "border-neutral-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">{k.label}</span>
              <k.icon
                className={cn("h-4 w-4", k.warn ? "text-amber-600" : "text-neutral-300")}
              />
            </div>
            <div
              className={cn(
                "mt-2 text-2xl font-semibold tabular-nums",
                k.warn ? "text-amber-700" : "text-neutral-900",
              )}
            >
              {k.wert ?? "–"}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Heutige Termine ── */}
        <section className="rounded-lg border border-neutral-200 bg-white lg:col-span-2">
          <h2 className="border-b border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700">
            Heutige Termine
          </h2>
          <div className="space-y-2 p-3">
            {heute.isLoading && (
              <p className="px-1 py-4 text-sm text-neutral-400">Lade …</p>
            )}
            {!heute.isLoading && termine.length === 0 && (
              <p className="px-1 py-4 text-sm text-neutral-400">Heute keine Termine</p>
            )}
            {termine.map((eintrag) => (
              <TerminKarte key={eintrag.entry.id} eintrag={eintrag} />
            ))}
          </div>
        </section>

        {/* ── Schnellaktionen ── */}
        <section className="rounded-lg border border-neutral-200 bg-white">
          <h2 className="border-b border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700">
            Schnellaktionen
          </h2>
          <div className="flex flex-col gap-2 p-3">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/patienten">
                <UserPlus className="mr-2 h-4 w-4" /> Neuer Patient
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/plaene">
                <ClipboardList className="mr-2 h-4 w-4" /> Neuer Therapieplan
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/therapie-import">
                <FileUp className="mr-2 h-4 w-4" /> Abrechnung importieren
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/kalender">
                <CalendarDays className="mr-2 h-4 w-4" /> Wochenkalender
              </Link>
            </Button>
          </div>
        </section>
      </div>

      {/* ── Abrechnung ── */}
      {abrechnung.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white">
          <h2 className="border-b border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700">
            Abrechnung
          </h2>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            {abrechnung.map((k) => (
              <Link
                key={k.label}
                to={k.zu}
                className={cn(
                  "rounded-lg border bg-white p-4 transition-colors hover:bg-neutral-50",
                  k.warn ? "border-amber-300" : "border-neutral-200",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">{k.label}</span>
                  <k.icon
                    className={cn(
                      "h-4 w-4",
                      k.warn ? "text-amber-600" : "text-neutral-300",
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "mt-2 text-2xl font-semibold tabular-nums",
                    k.warn ? "text-amber-700" : "text-neutral-900",
                  )}
                >
                  {k.wert}
                </div>
              </Link>
            ))}
          </div>
          {stats.data && stats.data.letzteRechnungen.length > 0 && (
            <div className="border-t border-neutral-100 px-4 py-3">
              <div className="space-y-1">
                {stats.data.letzteRechnungen.slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    to={`/rechnungen/${r.id}`}
                    className="flex items-center justify-between text-sm hover:bg-neutral-50 rounded px-1 py-1"
                  >
                    <span className="text-neutral-700">
                      {r.nummer ?? `Entwurf #${r.id}`} · {r.kundeName}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {datum(r.rechnungsdatum)} · {geld(r.brutto)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Backup-Erinnerung (Banner, wenn letzte Sicherung > 14 Tage her) ─────────
function BackupErinnerung() {
  const settings = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const erledigt = trpc.settings.backupErledigt.useMutation({
    onSuccess: () => utils.settings.get.invalidate(),
  });
  const [wege, setWege] = useState(false);

  if (wege || !settings.data) return null;
  const letzte = settings.data.backupZuletztAm
    ? new Date(settings.data.backupZuletztAm as unknown as string)
    : null;
  const tage = letzte
    ? Math.floor((Date.now() - letzte.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  if (tage !== null && tage <= 14) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-amber-900">
          {tage === null
            ? "Noch kein Backup bestätigt — Datenbank & Dokumente sichern!"
            : `Letztes Backup vor ${tage} Tagen — Zeit für eine neue Sicherung.`}
        </div>
        <div className="mt-0.5 text-xs text-amber-800">
          Auf dem Server einmalig: <code className="rounded bg-amber-100 px-1">~/praxiswerk/scripts/backup.sh</code>{" "}
          (oder den täglichen Cron aus der Server-Anleitung prüfen). Danach hier bestätigen.
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={erledigt.isPending}
        onClick={() => erledigt.mutate()}
      >
        {erledigt.isPending ? "Merke …" : "Habe ich erledigt"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setWege(true)}>
        Später
      </Button>
    </div>
  );
}
