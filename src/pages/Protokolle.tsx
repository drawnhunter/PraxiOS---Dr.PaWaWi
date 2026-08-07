// ── PraxiOS: Behandlungsprotokolle (Menü-Seite) ────────────────────────────
// Zwei Tabs: Patienten-Protokolle (Patient wählen → anlegen/ausfüllen) und
// die volle Vorlagen-Verwaltung.
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { BLOCK_TYP_LABEL } from "@contracts/protokolle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BookMarked, Lock, Plus, Trash2, X } from "lucide-react";

export default function Protokolle() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "vorlagen" ? "vorlagen" : "patienten";
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Behandlungsprotokolle</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Protokolle aus Blöcken zusammenstellen und pro Patient ausfüllen —
            48 h editierbar, danach automatisch gesperrt (Nachträge bleiben möglich).
          </p>
        </div>
        <div className="flex gap-1 rounded-md bg-neutral-100 p-1 text-sm">
          <button
            className={`rounded px-3 py-1.5 transition-colors ${tab === "patienten" ? "bg-white font-medium shadow-sm" : "text-neutral-500"}`}
            onClick={() => setParams({})}
          >
            Patienten
          </button>
          <button
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors ${tab === "vorlagen" ? "bg-white font-medium shadow-sm" : "text-neutral-500"}`}
            onClick={() => setParams({ tab: "vorlagen" })}
          >
            <BookMarked className="h-3.5 w-3.5" /> Vorlagen
          </button>
        </div>
      </div>
      {tab === "patienten" ? <PatientenTab /> : <VorlagenTab />}
    </div>
  );
}

// ── Patienten-Protokolle ─────────────────────────────────────────────────────
function PatientenTab() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [suche, setSuche] = useState("");
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientName, setPatientName] = useState("");
  const [neuDialog, setNeuDialog] = useState(false);
  const [titel, setTitel] = useState("");
  const [vorlageId, setVorlageId] = useState<string>("");

  const treffer = trpc.customers.list.useQuery(
    { suche: suche.trim() || undefined },
    { enabled: patientId === null },
  );
  const letzte = trpc.protokolle.letzte.useQuery({ limit: 15 });
  const liste = trpc.protokolle.liste.useQuery(
    { patientId: patientId ?? 0 },
    { enabled: patientId !== null },
  );
  const vorlagen = trpc.protokolle.vorlagen.useQuery();

  const erstellen = trpc.protokolle.erstellen.useMutation({
    onSuccess: (r) => {
      utils.protokolle.liste.invalidate();
      navigate(`/protokolle/${r.id}`);
    },
  });

  const waehlen = (id: number, name: string) => {
    setPatientId(id);
    setPatientName(name);
    setSuche("");
  };

  if (patientId === null) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-neutral-700">1. Patient aussuchen</h2>
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
            {!suche.trim() && (
              <p className="px-2 py-3 text-sm text-neutral-400">
                Tippen, um im Patientenstamm zu suchen …
              </p>
            )}
            {suche.trim() && (treffer.data ?? []).length === 0 && (
              <p className="px-2 py-3 text-sm text-neutral-400">Kein Patient gefunden.</p>
            )}
          </div>
        </div>

        {(letzte.data ?? []).length > 0 && (
          <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-medium text-neutral-700">Zuletzt bearbeitet</h2>
            <div className="divide-y divide-neutral-100">
              {(letzte.data ?? []).map((p) => (
                <Link
                  key={p.id}
                  to={`/protokolle/${p.id}`}
                  className="flex items-center justify-between gap-2 px-2 py-2 hover:bg-teal-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-800">{p.titel}</span>
                    <span className="text-xs text-neutral-400">{p.patient?.name}</span>
                    {p.gesperrt && <Lock className="h-3 w-3 text-amber-600" />}
                  </div>
                  <span className="text-xs text-neutral-400">{new Date(p.createdAt).toLocaleDateString("de-DE")}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
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
        <Button onClick={() => setNeuDialog(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Neues Protokoll
        </Button>
      </div>

      <div className="space-y-2">
        {(liste.data ?? []).length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-400">
            Noch keine Protokolle für diesen Patienten.
          </p>
        )}
        {(liste.data ?? []).map((p) => (
          <Link
            key={p.id}
            to={`/protokolle/${p.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-teal-300"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{p.titel}</span>
              {p.vorlage && <Badge variant="outline">{p.vorlage.titel}</Badge>}
              {p.gesperrt && (
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  <Lock className="mr-1 h-3 w-3" /> gesperrt
                </Badge>
              )}
            </div>
            <span className="text-xs text-neutral-400">
              {new Date(p.createdAt).toLocaleDateString("de-DE")}
              {p.ersteller?.name ? ` · ${p.ersteller.name}` : ""}
            </span>
          </Link>
        ))}
      </div>

      {/* ── Neues Protokoll ── */}
      <Dialog open={neuDialog} onOpenChange={setNeuDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neues Protokoll für {patientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titel *</Label>
              <Input
                autoFocus
                placeholder="z. B. Infusion 04.08., Wundkontrolle …"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
              />
            </div>
            <div>
              <Label>Aus Vorlage (optional)</Label>
              <Select value={vorlageId} onValueChange={setVorlageId}>
                <SelectTrigger>
                  <SelectValue placeholder="— Ohne Vorlage (leer starten) —" />
                </SelectTrigger>
                <SelectContent>
                  {(vorlagen.data ?? []).map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.titel} ({v.bloecke.length} Blöcke)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(vorlagen.data ?? []).length === 0 && (
                <p className="mt-1 text-xs text-neutral-400">
                  Noch keine Vorlagen — im Tab „Vorlagen" anlegbar oder aus einem
                  fertigen Protokoll heraus speichern.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNeuDialog(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={!titel.trim() || erstellen.isPending}
              onClick={() =>
                patientId &&
                erstellen.mutate({
                  patientId,
                  titel: titel.trim(),
                  vorlageId: vorlageId ? Number(vorlageId) : undefined,
                })
              }
            >
              {erstellen.isPending ? "Lege an …" : "Anlegen & ausfüllen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Vorlagen-Verwaltung ──────────────────────────────────────────────────────
function VorlagenTab() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const vorlagen = trpc.protokolle.vorlagen.useQuery();
  const loeschen = trpc.protokolle.vorlageLoeschen.useMutation({
    onSuccess: () => utils.protokolle.vorlagen.invalidate(),
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => navigate("/protokolle/vorlagen/neu")}>
          <Plus className="mr-1.5 h-4 w-4" /> Neue Vorlage
        </Button>
      </div>
      <div className="space-y-2">
        {(vorlagen.data ?? []).length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-400">
            Noch keine Vorlagen. Tipp: Ein fertiges Protokoll kann per Klick auf
            „Als Vorlage speichern" hierher kopiert werden.
          </p>
        )}
        {(vorlagen.data ?? []).map((v) => (
          <section
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{v.titel}</span>
                <Badge variant="outline">{v.bloecke.length} Blöcke</Badge>
              </div>
              {v.beschreibung && (
                <div className="mt-0.5 max-w-lg truncate text-xs text-neutral-500">
                  {v.beschreibung}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1">
                {[...new Set(v.bloecke.map((b) => b.typ))].map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    {BLOCK_TYP_LABEL[t]}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/protokolle/vorlagen/${v.id}`)}>
                Bearbeiten
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => {
                  if (window.confirm(`Vorlage „${v.titel}" löschen? Bestehende Protokolle bleiben erhalten.`)) {
                    loeschen.mutate({ id: v.id });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
