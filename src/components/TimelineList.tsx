import { useState } from "react";
import { trpc } from "@/providers/trpc";
import type { TimelineEvent } from "@db/schema";
import { datum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarCheck,
  CalendarX,
  ClipboardList,
  Paperclip,
  RefreshCw,
  StickyNote,
} from "lucide-react";

const ICONS: Record<TimelineEvent["typ"], typeof StickyNote> = {
  notiz: StickyNote,
  plan: ClipboardList,
  termin: CalendarCheck,
  dokument: Paperclip,
  status: RefreshCw,
};

function terminIcon(e: TimelineEvent) {
  // Termin-Icon nach Inhalt: abgesagt/ausgefallen → X, sonst Haken
  const text = `${e.titel} ${e.beschreibung ?? ""}`.toLowerCase();
  if (text.includes("abgesagt") || text.includes("ausgefallen")) return CalendarX;
  return CalendarCheck;
}

interface Props {
  patientId: number;
  ereignisse: TimelineEvent[];
}

export function TimelineList({ patientId, ereignisse }: Props) {
  const utils = trpc.useUtils();
  const [notiz, setNotiz] = useState("");

  const addNotiz = trpc.customers.addNotiz.useMutation({
    onSuccess: () => {
      utils.customers.get.invalidate({ id: patientId });
      setNotiz("");
    },
  });

  const liste = [...ereignisse].sort((a, b) =>
    b.datum === a.datum ? b.id - a.id : b.datum.localeCompare(a.datum),
  );

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      {/* ── Notiz hinzufügen ── */}
      <div className="mb-5">
        <Textarea
          rows={2}
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="Kurze Notiz zum Verlauf (z. B. Telefonat, Zwischenstand) …"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button
            size="sm"
            disabled={!notiz.trim() || addNotiz.isPending}
            onClick={() => addNotiz.mutate({ patientId, text: notiz.trim() })}
          >
            {addNotiz.isPending ? "Speichere …" : "Notiz hinzufügen"}
          </Button>
          {addNotiz.error && (
            <span className="text-sm text-red-600">{addNotiz.error.message}</span>
          )}
        </div>
      </div>

      {/* ── Chronik (neueste oben) ── */}
      {liste.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Noch keine Einträge im Verlauf.
        </p>
      ) : (
        <ol className="space-y-4">
          {liste.map((e) => {
            const Icon = e.typ === "termin" ? terminIcon(e) : ICONS[e.typ];
            return (
              <li key={e.id} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs text-neutral-400">{datum(e.datum)}</div>
                  <div className="text-sm font-medium text-neutral-900">{e.titel}</div>
                  {e.beschreibung && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-600">
                      {e.beschreibung}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
