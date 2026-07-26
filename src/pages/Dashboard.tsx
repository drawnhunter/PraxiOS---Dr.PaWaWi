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
