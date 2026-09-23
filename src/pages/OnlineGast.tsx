// ── PraxiOS: Öffentliche Gast-Seite für Online-Termine (1.19.0) ────────────
// Gäste brauchen kein Patienten-Portal — der Token-Link aus der Praxis reicht.
// Zeigt Termin-Infos + Beitritts-Button (Jitsi-Raum, neuer Tab).
import { useState } from "react";
import { useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { datum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { JitsiRaum } from "@/components/JitsiRaum";
import { CalendarDays, Clock, ShieldCheck, Video, VideoOff } from "lucide-react";

export default function OnlineGast() {
  const { token = "" } = useParams();
  const q = trpc.portal.onlineGast.useQuery({ token }, { retry: false });
  const [raumOffen, setRaumOffen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-4 text-center">
          <div className="text-xl font-extrabold tracking-tight">
            Dr.<span className="text-teal-700">PaWaWi</span>
          </div>
          <div className="mt-0.5 text-xs text-neutral-400">Online-Termin</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          {q.isLoading && <p className="text-center text-sm text-neutral-500">Lade …</p>}
          {q.isError && (
            <div className="text-center">
              <VideoOff className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
              <h1 className="text-lg font-semibold">Zugang nicht möglich</h1>
              <p className="mt-2 text-sm text-neutral-500">{q.error.message}</p>
            </div>
          )}
          {q.data && (
            <div className="text-center">
              <Video className="mx-auto mb-3 h-8 w-8 text-teal-700" />
              <h1 className="text-lg font-semibold">{q.data.titel}</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Guten Tag, {q.data.gastName}! Sie sind als Gast zu diesem Online-Termin
                der {q.data.praxisName} eingeladen.
              </p>

              <div className="mt-5 space-y-2 rounded-lg bg-neutral-50 p-4 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-teal-700" />
                  <span className="font-medium">{datum(q.data.datum)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-teal-700" />
                  <span className="font-medium tabular-nums">
                    {q.data.zeitVon}{q.data.zeitBis ? `–${q.data.zeitBis}` : ""} Uhr
                  </span>
                </div>
              </div>

              {q.data.status === "abgesagt" ? (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  Dieser Termin wurde von der Praxis abgesagt. Bei Fragen melden Sie sich
                  bitte direkt in der Praxis.
                </p>
              ) : q.data.raumUrl ? (
                <>
                  <Button
                    className="mt-5 w-full"
                    size="lg"
                    onClick={() => setRaumOffen(true)}
                  >
                    <Video className="mr-2 h-5 w-5" /> Dem Video-Termin beitreten
                  </Button>
                  <p className="mt-3 text-xs text-neutral-400">
                    Der Raum öffnet sich direkt hier im Browser — keine App nötig. Bitte
                    erlauben Sie Kamera und Mikrofon. Tipp: ein paar Minuten früher beitreten.
                  </p>
                </>
              ) : null}

              <p className="mt-5 flex items-start justify-center gap-1.5 text-center text-xs text-neutral-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Dieser Link ist persönlich für Sie bestimmt — bitte nicht weitergeben.
              </p>
            </div>
          )}
        </div>
      </div>
      {raumOffen && q.data?.raumUrl && (
        <JitsiRaum
          raumUrl={q.data.raumUrl}
          anzeigeName={q.data.gastName}
          onSchliessen={() => setRaumOffen(false)}
        />
      )}
    </div>
  );
}
