// ── PraxiOS: Rezepte & Atteste (eigene Menü-Seite) ─────────────────────────
// Patient aussuchen → direkt Privatrezept oder Attest erstellen. Alternativ
// über die zuletzt erstellten Einträge wieder aufnehmen.
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { RezepteSection } from "@/components/RezepteSection";
import { REZEPT_TYP_LABEL } from "@contracts/rezepte";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSignature, X } from "lucide-react";

export default function Rezepte() {
  const [suche, setSuche] = useState("");
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientName, setPatientName] = useState<string>("");

  const treffer = trpc.customers.list.useQuery(
    { suche: suche.trim() || undefined },
    { enabled: patientId === null },
  );
  const letzte = trpc.rezepte.letzte.useQuery({ limit: 15 });

  const waehlen = (id: number, name: string) => {
    setPatientId(id);
    setPatientName(name);
    setSuche("");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Rezepte &amp; Atteste</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Patient aussuchen und direkt ein Privatrezept, eine Krankschreibung oder
          ein Attest erstellen — mit der hinterlegten Unterschrift auf dem PDF.
        </p>
      </div>

      {patientId === null ? (
        <div className="max-w-2xl">
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-medium text-neutral-700">
              1. Patient aussuchen
            </h2>
            <Input
              autoFocus
              placeholder="Name eingeben …"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
            <div className="mt-2 divide-y divide-neutral-100">
              {(treffer.data ?? []).slice(0, 8).map((k) => (
                <button
                  key={k.id}
                  className="flex w-full items-center justify-between px-2 py-2 text-left text-sm hover:bg-teal-50"
                  onClick={() => waehlen(k.id, k.name)}
                >
                  <span className="font-medium text-neutral-800">{k.name}</span>
                  <span className="text-xs text-neutral-400">
                    {k.plz} {k.ort}
                  </span>
                </button>
              ))}
              {suche.trim() && (treffer.data ?? []).length === 0 && (
                <p className="px-2 py-3 text-sm text-neutral-400">
                  Kein Patient gefunden — zuerst unter „Patienten" anlegen.
                </p>
              )}
              {!suche.trim() && (
                <p className="px-2 py-3 text-sm text-neutral-400">
                  Tippen, um im Patientenstamm zu suchen …
                </p>
              )}
            </div>
          </div>

          {(letzte.data ?? []).length > 0 && (
            <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-medium text-neutral-700">
                Zuletzt erstellt
              </h2>
              <div className="divide-y divide-neutral-100">
                {(letzte.data ?? []).map((r) => (
                  <button
                    key={r.id}
                    className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-teal-50"
                    onClick={() => r.patient && waehlen(r.patient.id, r.patient.name)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{REZEPT_TYP_LABEL[r.typ]}</Badge>
                      <span className="text-sm font-medium text-neutral-800">
                        {r.patient?.name ?? "—"}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-400">
                      {new Date(r.createdAt).toLocaleDateString("de-DE")}
                      {r.ersteller?.name ? ` · ${r.ersteller.name}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <FileSignature className="h-5 w-5 text-teal-700" />
            <span className="font-medium">{patientName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPatientId(null);
                setPatientName("");
              }}
            >
              <X className="mr-1 h-4 w-4" /> anderen Patienten wählen
            </Button>
          </div>
          <RezepteSection patientId={patientId} />
        </div>
      )}
    </div>
  );
}
