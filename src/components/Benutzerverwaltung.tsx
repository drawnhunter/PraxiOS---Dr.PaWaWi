import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RECHTE, type Recht } from "@contracts/constants";
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
import { Plus, KeyRound, Trash2, Palette } from "lucide-react";

// Vordefinierte Therapeuten-Farben (Kalender). „keine" = null.
const THERAPEUT_FARBEN = [
  { hex: "#0F766E", label: "Petrol" },
  { hex: "#B45309", label: "Bernstein" },
  { hex: "#1D4ED8", label: "Blau" },
  { hex: "#15803D", label: "Grün" },
  { hex: "#7C3AED", label: "Violett" },
  { hex: "#B91C1C", label: "Rot" },
  { hex: "#0E7490", label: "Cyan" },
  { hex: "#A21CAF", label: "Magenta" },
];

function FarbPunkt({ farbe }: { farbe: string | null | undefined }) {
  if (!farbe) return null;
  return (
    <span
      className="mr-2 inline-block h-3 w-3 rounded-full align-middle ring-1 ring-black/10"
      style={{ backgroundColor: farbe }}
      title={`Kalenderfarbe ${farbe}`}
    />
  );
}

/** Klickbare Farb-Palette: 8 Swatches + „keine". */
function FarbAuswahl({
  wert,
  onWahl,
}: {
  wert: string | null;
  onWahl: (farbe: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {THERAPEUT_FARBEN.map((f) => (
        <button
          key={f.hex}
          type="button"
          title={f.label}
          onClick={() => onWahl(f.hex)}
          className={`h-7 w-7 rounded-full transition-all ${
            wert === f.hex
              ? "ring-2 ring-neutral-800 ring-offset-2"
              : "hover:scale-110"
          }`}
          style={{ backgroundColor: f.hex }}
        />
      ))}
      <button
        type="button"
        onClick={() => onWahl(null)}
        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
          wert === null
            ? "border-neutral-800 bg-neutral-100 text-neutral-800"
            : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
        }`}
      >
        keine
      </button>
    </div>
  );
}

export function Benutzerverwaltung() {
  const utils = trpc.useUtils();
  const ich = trpc.auth.me.useQuery();
  const istAdmin = ich.data?.role === "admin";

  const benutzer = trpc.auth.benutzer.useQuery(undefined, {
    enabled: istAdmin,
    retry: false,
  });
  const gruppen = trpc.auth.gruppenListe.useQuery(undefined, {
    enabled: istAdmin,
    retry: false,
  });
  const benutzerGruppe = trpc.auth.benutzerGruppe.useMutation({
    onSuccess: () => utils.auth.benutzer.invalidate(),
    onError: (e) => alert(e.message),
  });
  const gruppeAnlegen = trpc.auth.gruppeAnlegen.useMutation({
    onSuccess: () => {
      utils.auth.gruppenListe.invalidate();
      setGruppenDialog(null);
      setFehler(null);
    },
    onError: (e) => setFehler(e.message),
  });
  const gruppeLoeschen = trpc.auth.gruppeLoeschen.useMutation({
    onSuccess: () => utils.auth.gruppenListe.invalidate(),
    onError: (e) => alert(e.message),
  });

  const [anlegenOffen, setAnlegenOffen] = useState(false);
  const [passwortZiel, setPasswortZiel] = useState<{ id: number; name: string } | null>(null);
  const [farbeZiel, setFarbeZiel] = useState<{
    id: number;
    name: string;
    farbe: string | null;
  } | null>(null);
  const [form, setForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "user" as "user" | "admin",
    gruppeId: null as number | null,
    kalenderFarbe: null as string | null,
  });
  const [gruppenDialog, setGruppenDialog] = useState<{ name: string; rechte: Recht[] } | null>(null);
  const [neuesPasswort, setNeuesPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  const invalid = () => utils.auth.benutzer.invalidate();

  const anlegen = trpc.auth.benutzerAnlegen.useMutation({
    onSuccess: () => {
      invalid();
      setAnlegenOffen(false);
      setForm({ username: "", name: "", password: "", role: "user", gruppeId: null, kalenderFarbe: null });
      setFehler(null);
    },
    onError: (e) => setFehler(e.message),
  });

  const passwort = trpc.auth.benutzerPasswort.useMutation({
    onSuccess: () => {
      setPasswortZiel(null);
      setNeuesPasswort("");
      setFehler(null);
    },
    onError: (e) => setFehler(e.message),
  });

  const farbe = trpc.auth.benutzerFarbe.useMutation({
    onSuccess: () => {
      invalid();
      setFarbeZiel(null);
      setFehler(null);
    },
    onError: (e) => setFehler(e.message),
  });

  const loeschen = trpc.auth.benutzerLoeschen.useMutation({
    onSuccess: invalid,
    onError: (e) => alert(e.message),
  });

  if (!istAdmin) return null;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-700">Benutzer</h2>
        <Button variant="outline" size="sm" onClick={() => { setFehler(null); setAnlegenOffen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Benutzer anlegen
        </Button>
      </div>
      <p className="mb-4 text-xs text-neutral-500">
        Wer sich anmelden darf. Die Praxisleitung kann zusätzlich Benutzer
        verwalten und alle Einstellungen ändern. Die Kalenderfarbe kennzeichnet
        Therapeut:innen im Terminkalender.
      </p>

            <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-2 font-medium">Benutzername</th>
            <th className="px-2 py-2 font-medium">Name</th>
            <th className="px-2 py-2 font-medium">Rolle</th>
            <th className="px-2 py-2 font-medium">Letzte Anmeldung</th>
            <th className="px-2 py-2 text-right font-medium">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {(benutzer.data ?? []).map((b) => (
            <tr key={b.id} className="border-b border-neutral-100 last:border-0">
              <td className="px-2 py-2.5 font-medium">
                {b.username ?? <span className="text-neutral-400">–</span>}
                {b.id === ich.data?.id && (
                  <span className="ml-2 text-xs text-neutral-400">(du)</span>
                )}
              </td>
              <td className="px-2 py-2.5 text-neutral-600">
                <FarbPunkt farbe={b.kalenderFarbe} />
                {b.name ?? "–"}
              </td>
              <td className="px-2 py-2.5">
                {b.role === "admin" ? (
                  <Badge>Leitung/Arzt</Badge>
                ) : (
                  <Select
                    value={b.gruppeId != null ? String(b.gruppeId) : "keine"}
                    onValueChange={(v) =>
                      benutzerGruppe.mutate({
                        userId: b.id,
                        gruppeId: v === "keine" ? null : Number(v),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keine">— keine Rechte —</SelectItem>
                      {(gruppen.data ?? []).map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!b.hatPasswort && (
                  <Badge variant="outline" className="ml-1.5 text-neutral-400">
                    kein Login
                  </Badge>
                )}
              </td>
              <td className="px-2 py-2.5 text-neutral-600">
                {b.lastSignInAt
                  ? new Date(b.lastSignInAt).toLocaleDateString("de-DE")
                  : "–"}
              </td>
              <td className="px-2 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Kalenderfarbe setzen"
                    onClick={() => {
                      setFehler(null);
                      setFarbeZiel({
                        id: b.id,
                        name: b.name ?? b.username ?? `#${b.id}`,
                        farbe: b.kalenderFarbe ?? null,
                      });
                    }}
                  >
                    <Palette className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Neues Passwort setzen"
                    onClick={() => {
                      setFehler(null);
                      setNeuesPasswort("");
                      setPasswortZiel({ id: b.id, name: b.name ?? b.username ?? `#${b.id}` });
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  {b.id !== ich.data?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Benutzer löschen"
                      onClick={() => {
                        if (confirm(`Benutzer „${b.name ?? b.username}" wirklich löschen?`))
                          loeschen.mutate({ id: b.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* ── Gruppen (Rollen-System) ── */}
      <div className="mt-6 border-t border-neutral-100 pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-neutral-700">Gruppen (Rechte)</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFehler(null);
              setGruppenDialog({ name: "", rechte: [] });
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Neue Gruppe
          </Button>
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          „Leitung/Arzt" darf alles (inkl. dieser Verwaltung). Allen anderen Benutzern
          wird eine Gruppe mit Bereichs-Rechten zugewiesen.
        </p>
        <div className="space-y-2">
          {(gruppen.data ?? []).map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-100 px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium">{g.name}</span>
                <span className="ml-2 text-xs text-neutral-400">
                  {g.mitglieder} Benutzer
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {g.rechte.map((r) => (
                    <Badge key={r} variant="secondary" className="text-xs">
                      {RECHTE[r]}
                    </Badge>
                  ))}
                </div>
              </div>
              {g.mitglieder === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => gruppeLoeschen.mutate({ id: g.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gruppen-Dialog */}
      <Dialog open={gruppenDialog !== null} onOpenChange={(o) => !o && setGruppenDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Gruppe</DialogTitle>
          </DialogHeader>
          {gruppenDialog && (
            <div className="space-y-3">
              <div>
                <Label>Name *</Label>
                <Input
                  value={gruppenDialog.name}
                  onChange={(e) => setGruppenDialog({ ...gruppenDialog, name: e.target.value })}
                  placeholder="z. B. Empfang"
                />
              </div>
              <div>
                <Label className="mb-2 block">Rechte *</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(Object.keys(RECHTE) as Recht[]).map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={gruppenDialog.rechte.includes(r)}
                        onCheckedChange={(v) =>
                          setGruppenDialog({
                            ...gruppenDialog,
                            rechte: v
                              ? [...gruppenDialog.rechte, r]
                              : gruppenDialog.rechte.filter((x) => x !== r),
                          })
                        }
                      />
                      {RECHTE[r]}
                    </label>
                  ))}
                </div>
              </div>
              {fehler && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{fehler}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGruppenDialog(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={!gruppenDialog?.name.trim() || gruppenDialog?.rechte.length === 0 || gruppeAnlegen.isPending}
              onClick={() =>
                gruppenDialog &&
                gruppeAnlegen.mutate({
                  name: gruppenDialog.name.trim(),
                  rechte: gruppenDialog.rechte,
                })
              }
            >
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anlegen-Dialog */}
      <Dialog open={anlegenOffen} onOpenChange={setAnlegenOffen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Benutzername *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="z. B. mmueller"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z. B. Maria Müller"
              />
            </div>
            <div>
              <Label>Passwort * (mindestens 8 Zeichen)</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label>Rolle</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as "user" | "admin" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Mit Gruppe (Personal)</SelectItem>
                  <SelectItem value="admin">Leitung/Arzt (alles)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "user" && (
              <div>
                <Label>Gruppe *</Label>
                <Select
                  value={form.gruppeId != null ? String(form.gruppeId) : ""}
                  onValueChange={(v) => setForm({ ...form, gruppeId: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Gruppe wählen …" />
                  </SelectTrigger>
                  <SelectContent>
                    {(gruppen.data ?? []).map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-neutral-400">
                  Rechte der Gruppe:{" "}
                  {(gruppen.data ?? [])
                    .find((g) => g.id === form.gruppeId)
                    ?.rechte.map((r) => RECHTE[r])
                    .join(", ") ?? "—"}
                </p>
              </div>
            )}
            <div>
              <Label className="mb-2 block">Kalenderfarbe (optional)</Label>
              <FarbAuswahl
                wert={form.kalenderFarbe}
                onWahl={(f) => setForm({ ...form, kalenderFarbe: f })}
              />
            </div>
            {fehler && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{fehler}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnlegenOffen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={
                !form.username ||
                form.password.length < 8 ||
                (form.role === "user" && form.gruppeId === null) ||
                anlegen.isPending
              }
              onClick={() =>
                anlegen.mutate({
                  username: form.username,
                  password: form.password,
                  name: form.name.trim() || undefined,
                  role: form.role,
                  gruppeId: form.role === "user" ? form.gruppeId : null,
                  kalenderFarbe: form.kalenderFarbe,
                })
              }
            >
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passwort-Dialog */}
      <Dialog open={!!passwortZiel} onOpenChange={(o) => !o && setPasswortZiel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neues Passwort für {passwortZiel?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Neues Passwort (mindestens 8 Zeichen)</Label>
              <Input
                type="password"
                value={neuesPasswort}
                onChange={(e) => setNeuesPasswort(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {fehler && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{fehler}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswortZiel(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={neuesPasswort.length < 8 || passwort.isPending}
              onClick={() =>
                passwortZiel &&
                passwort.mutate({ id: passwortZiel.id, password: neuesPasswort })
              }
            >
              Passwort setzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Farb-Dialog */}
      <Dialog open={!!farbeZiel} onOpenChange={(o) => !o && setFarbeZiel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kalenderfarbe für {farbeZiel?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <FarbAuswahl
              wert={farbeZiel?.farbe ?? null}
              onWahl={(f) => farbeZiel && setFarbeZiel({ ...farbeZiel, farbe: f })}
            />
            {fehler && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{fehler}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFarbeZiel(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={farbe.isPending}
              onClick={() =>
                farbeZiel &&
                farbe.mutate({ userId: farbeZiel.id, kalenderFarbe: farbeZiel.farbe })
              }
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
