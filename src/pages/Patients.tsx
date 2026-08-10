import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useSortierung } from "@/lib/sortierung";
import { datum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Search, Users } from "lucide-react";
import { PatientForm } from "@/components/PatientForm";

/** Alter in Jahren zum heutigen Tag; null wenn kein Geburtsdatum. */
export function alterAm(geburtsdatum: string | null | undefined): number | null {
  if (!geburtsdatum) return null;
  const [j, m, t] = geburtsdatum.split("-").map(Number);
  if (!j || !m || !t) return null;
  const heute = new Date();
  let alter = heute.getFullYear() - j;
  const monatDiff = heute.getMonth() + 1 - m;
  if (monatDiff < 0 || (monatDiff === 0 && heute.getDate() < t)) alter -= 1;
  return alter;
}

export default function PatientsPage() {
  const [suche, setSuche] = useState("");
  const [tag, setTag] = useState("");
  const [inklArchiviert, setInklArchiviert] = useState(false);
  const [dialogOffen, setDialogOffen] = useState(false);

  const sort = useSortierung<NonNullable<typeof patienten.data>[number]>("name");
  const patienten = trpc.customers.list.useQuery({
    suche: suche || undefined,
    tag: tag || undefined,
    inklArchivierte: inklArchiviert,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Patienten</h1>
        <Button onClick={() => setDialogOffen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Neuer Patient
        </Button>
      </div>

      {/* ── Suche & Filter ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <Label>Suche (Name oder Patienten-Nr.)</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
              <Input
                className="pl-8"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Nachname, Vorname oder Nr. …"
              />
            </div>
          </div>
          <div className="w-48">
            <Label>Tag-Filter</Label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="z. B. borreliose"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
            <Checkbox
              checked={inklArchiviert}
              onCheckedChange={(v) => setInklArchiviert(v === true)}
            />
            Archivierte anzeigen
          </label>
        </div>
      </section>

      {/* ── Liste ── */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        {patienten.isLoading ? (
          <p className="text-sm text-neutral-500">Lade Patienten …</p>
        ) : patienten.error ? (
          <p className="text-sm text-red-600">{patienten.error.message}</p>
        ) : (patienten.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-700">
              {suche || tag
                ? "Keine Patienten gefunden — Suche oder Filter anpassen."
                : "Noch keine Patienten angelegt."}
            </p>
            {!suche && !tag && (
              <Button variant="outline" size="sm" onClick={() => setDialogOffen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Ersten Patienten anlegen
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="cursor-pointer select-none px-2 py-2 font-medium" onClick={() => sort.umschalten("name")}>Name<sort.KopfIcon k="name" /></th>
                  <th className="cursor-pointer select-none px-2 py-2 font-medium" onClick={() => sort.umschalten("patientenNr")}>Patienten-Nr.<sort.KopfIcon k="patientenNr" /></th>
                  <th className="px-2 py-2 font-medium">Geburtsdatum</th>
                  <th className="cursor-pointer select-none px-2 py-2 font-medium" onClick={() => sort.umschalten("ort")}>Ort<sort.KopfIcon k="ort" /></th>
                  <th className="px-2 py-2 font-medium">Telefon</th>
                  <th className="px-2 py-2 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody>
                {sort.sortiere(patienten.data ?? [], (p, key) =>
                  key === "name" ? p.name : key === "ort" ? p.ort : key === "patientenNr" ? p.patientenNr : key === "geburtsdatum" ? p.geburtsdatum : null,
                ).map((p) => {
                  const alter = alterAm(p.geburtsdatum);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-2 py-2.5 font-medium">
                        <Link
                          to={`/patienten/${p.id}`}
                          className="text-neutral-900 underline-offset-2 hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.archiviert && (
                          <>
                            {" "}
                            <Badge variant="secondary">archiviert</Badge>
                          </>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-neutral-600">
                        {p.patientenNr ?? "–"}
                      </td>
                      <td className="px-2 py-2.5 text-neutral-600">
                        {datum(p.geburtsdatum)}
                        {alter !== null && (
                          <span className="text-neutral-400"> ({alter} J.)</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-neutral-600">
                        {[p.plz, p.ort].filter(Boolean).join(" ") || "–"}
                      </td>
                      <td className="px-2 py-2.5 text-neutral-600">
                        {p.telefon ?? "–"}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(p.tags ?? "")
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean)
                            .map((t) => (
                              <Badge key={t} variant="secondary">
                                {t}
                              </Badge>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PatientForm offen={dialogOffen} onOpenChange={setDialogOffen} />
    </div>
  );
}
