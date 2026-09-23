// ── PraxiOS: Eingebetteter Jitsi-Raum (1.19.1) ─────────────────────────────
// Rendert den Video-Raum per Jitsi external_api direkt IN der Seite —
// kein App-Download, kein Fremd-Tab, Patient/Gast bleiben auf unserer Domain.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>,
    ) => { dispose: () => void; addEventListener: (e: string, f: () => void) => void };
  }
}

let skriptLadung: Promise<void> | null = null;
function ladeJitsiSkript(basis: string): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (skriptLadung) return skriptLadung;
  skriptLadung = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${basis}/external_api.js`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Jitsi-Skript nicht erreichbar (${basis}/external_api.js) — Jitsi-URL in den Einstellungen prüfen.`));
    document.head.appendChild(s);
  });
  return skriptLadung;
}

export function JitsiRaum({
  raumUrl,
  anzeigeName,
  onSchliessen,
}: {
  raumUrl: string;
  anzeigeName: string;
  onSchliessen: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let api: { dispose: () => void; addEventListener: (e: string, f: () => void) => void } | null = null;
    const u = new URL(raumUrl);
    const basis = u.origin;
    const raum = u.pathname.replace(/^\//, "");
    ladeJitsiSkript(basis)
      .then(() => {
        if (!box.current || !window.JitsiMeetExternalAPI) return;
        api = new window.JitsiMeetExternalAPI(u.host, {
          roomName: raum,
          parentNode: box.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName: anzeigeName },
          configOverwrite: {
            // Browser-first: Prejoin an (Kamera/Mikro-Check), kein App-Nudge
            prejoinPageEnabled: true,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
          },
        });
        api.addEventListener("readyToClose", onSchliessen);
      })
      .catch((e) => setFehler(e instanceof Error ? e.message : String(e)));
    return () => {
      api?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raumUrl]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between bg-neutral-900 px-4 py-2">
        <span className="text-sm text-neutral-300">Video-Termin — {anzeigeName}</span>
        <button
          onClick={onSchliessen}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          <X className="h-4 w-4" /> Verlassen
        </button>
      </div>
      {fehler ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <p className="text-red-400">{fehler}</p>
            <p className="mt-2 text-sm text-neutral-400">
              Standard ist <code>https://meet.jit.si</code> — das Feld „Jitsi-Server" in den
              Einstellungen muss auf einen JITSI-Server zeigen, nicht auf diese App.
            </p>
          </div>
        </div>
      ) : (
        <div ref={box} className="flex-1" />
      )}
    </div>
  );
}
