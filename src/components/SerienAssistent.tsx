import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WOCHENTAGE = [
  { wert: 1, kurz: "Mo", lang: "Montag" },
  { wert: 2, kurz: "Di", lang: "Dienstag" },
  { wert: 3, kurz: "Mi", lang: "Mittwoch" },
  { wert: 4, kurz: "Do", lang: "Donnerstag" },
  { wert: 5, kurz: "Fr", lang: "Freitag"},
];

/** Exakte Terminanzahl wie im Backend: Wochentage × Wochen, aber nur Tage ab startDatum. */
export function zaehleSerienTermine(
  startDatum: string,
  wochentage: number[],
  anzahlWochen: number,
): number {
  if (!startDatum) return 0;
  const start = new Date(startDatum + "T00:00:00Z");
  const startWt = start.getUTCDay() === 0 ? 7 : start.getUTCDay();
  const montag = new Date(start);
  montag.setUTCDate(start.getUTCDate() - (startWt - 1));
  let n = 0;
  for (let w = 0; w < anzahlWochen; w++) {
    for (const wt of [...new Set(wochentage)].sort((a, b) => a - b)) {
      const d = new Date(montag);
      d.setUTCDate(montag.getUTCDate() + w * 7 + (wt - 1));
      if (d.toISOString().slice(0, 10) >= startDatum) n++;
    }
  }
  return n;
}

export default function SerienAssistent({
  planId,
  open,
  onOpenChange,
  onSuccess,
}: {
  planId: number;
  open: boolean;
  onOpenChange: (offen: boolean) => void;
  onSuccess: (anzahl: number) => void;
}) {
  const heute = useMemo(() => {
    const j = new Date();
    return `${j.getFullYear()}-${String(j.getMonth() + 1).padStart(2, "0")}-${String(
      j.getDate(),
    ).padStart(2, "0")}`;
  }, []);

  const [leistungId, setLeistungId] = useState("keine");
  const [therapeutId, setTherapeutId] = useState("keiner");
  const [zeitVon, setZeitVon] = useState("");
  const [zeitBis, setZeitBis] = useState("");
  const [raum, setRaum] = useState("");
  const [wochentage, setWochentage] = useState<number[]>([]);
  const [startDatum, setStartDatum] = useState(heute);
  const [anzahlWochen, setAnzahlWochen] = useState(4);

  const utils = trpc.useUtils();
  const leistungen = trpc.leistungen.list.useQuery({});
  // Therapeuten-Liste (für alle eingeloggten Nutzer, ohne sensible Felder)
  const benutzer = trpc.auth.therapeuten.useQuery();

  const anlegen = trpc.plaene.serieAnlegen.useMutation({
    onSuccess: (r) => {
      utils.plaene.byId.invalidate({ id: planId });
      onOpenChange(false);
      onSuccess(r.anzahl);
    },
  });

  // Leistungen nach Kategorie gruppieren (Reihenfolge wie im Katalog)
  const gruppen = useMemo(() => {
    const map = new Map<string, NonNullable<typeof leistungen.data>>();
    for (const l of leistungen.data ?? []) {
      const kat = l.kategorie ?? "Sonstige";
      if (!map.has(kat)) map.set(kat, []);
      map.get(kat)!.push(l);
    }
    return [...map.entries()];
  }, [leistungen.data]);

  const gewaehlteLeistung = (leistungen.data ?? []).find(
    (l) => String(l.id) === leistungId,
  );

  const toggleWochentag = (wert: number) => {
    setWochentage((alt) =>
      alt.includes(wert) ? alt.filter((w) => w !== wert) : [...alt, wert],
    );
  };

  const anzahl = zaehleSerienTermine(startDatum, wochentage, anzahlWochen);
  const tageKurz = WOCHENTAGE.filter((t) => wochentage.includes(t.wert))
    .map((t) => t.kurz)
    .join(", ");

  const absenden = () => {
    anlegen.mutate({
      planId,
      leistungId: gewaehlteLeistung ? gewaehlteLeistung.id : null,
      leistungText: gewaehlteLeistung ? gewaehlteLeistung.name : null,
      therapeutId: therapeutId === "keiner" ? null : Number(therapeutId),
      raum: raum || null,
      zeitVon: zeitVon || null,
      zeitBis: zeitBis || null,
      wochentage,
      startDatum,
      anzahlWochen,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Serien-Termine anlegen</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="col-span-2">
            <Label>Leistung</Label>
            <Select value={leistungId} onValueChange={setLeistungId}>
              <SelectTrigger>
                <SelectValue placeholder="Leistung auswählen …" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keine">Keine Leistung</SelectItem>
                {gruppen.map(([kategorie, liste]) => (
                  <SelectGroup key={kategorie}>
                    <SelectLabel>{kategorie}</SelectLabel>
                    {liste.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Therapeut</Label>
            <Select value={therapeutId} onValueChange={setTherapeutId}>
              <SelectTrigger>
                <SelectValue placeholder="Therapeut auswählen …" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keiner">Kein Therapeut</SelectItem>
                {(benutzer.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name ?? b.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Uhrzeit von</Label>
            <Input
              type="time"
              value={zeitVon}
              onChange={(e) => setZeitVon(e.target.value)}
            />
          </div>
          <div>
            <Label>Uhrzeit bis</Label>
            <Input
              type="time"
              value={zeitBis}
              onChange={(e) => setZeitBis(e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label>Raum</Label>
            <Input value={raum} onChange={(e) => setRaum(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Wochentage *</Label>
            <div className="mt-1.5 flex flex-wrap gap-4">
              {WOCHENTAGE.map((t) => (
                <label
                  key={t.wert}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <Checkbox
                    checked={wochentage.includes(t.wert)}
                    onCheckedChange={() => toggleWochentag(t.wert)}
                  />
                  {t.lang}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Startdatum *</Label>
            <Input
              type="date"
              value={startDatum}
              onChange={(e) => setStartDatum(e.target.value)}
            />
          </div>
          <div>
            <Label>Anzahl Wochen (1–12)</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={anzahlWochen}
              onChange={(e) =>
                setAnzahlWochen(
                  Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                )
              }
            />
          </div>
          {wochentage.length > 0 && startDatum && (
            <p className="col-span-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
              Erzeugt {anzahl} Termine: {tageKurz} × {anzahlWochen}{" "}
              {anzahlWochen === 1 ? "Woche" : "Wochen"} ab {datum(startDatum)}
            </p>
          )}
        </div>
        {anlegen.error && (
          <p className="text-sm text-red-600">{anlegen.error.message}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={absenden}
            disabled={wochentage.length === 0 || !startDatum || anlegen.isPending}
          >
            Serie anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
