// ── PraxiOS: Zeit-x-Werte-Diagramm für Tabellen-Blöcke (reines SVG) ────────
// X = erste Spalte (Datum/Uhrzeit oder Zeilen-Nr.), Y = alle Spalten mit
// Zahlenwerten (je eine Linie). Keine externe Chart-Bibliothek nötig.
import { useMemo } from "react";
import { zahlAusZelle } from "@contracts/protokolle";

const FARBEN = ["#0F766E", "#B45309", "#1D4ED8", "#B91C1C", "#6D28D9", "#047857", "#BE185D", "#0E7490"];
const W = 560;
const H = 180;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 30;

export function ProtokollChart({
  spalten,
  zeilen,
}: {
  spalten: string[];
  zeilen: string[][];
}) {
  const serien = useMemo(() => {
    // X-Werte: erste Spalte als Label; Zeilen ohne jede Zahl fliegen raus
    const xLabels: string[] = [];
    const werteProSpalte: (number | null)[][] = spalten.slice(1).map(() => []);
    const benutzt: number[] = [];
    zeilen.forEach((z, i) => {
      const yWerte = spalten.slice(1).map((_, si) => zahlAusZelle(z[si + 1] ?? ""));
      if (yWerte.every((v) => v === null)) return;
      benutzt.push(i);
      xLabels.push((z[0] ?? "").trim() || `#${i + 1}`);
      yWerte.forEach((v, si) => werteProSpalte[si].push(v));
    });
    if (xLabels.length < 2) return null;
    // Nur Spalten behalten, die mindestens 2 Zahlen haben
    const aktive = werteProSpalte
      .map((w, si) => ({ si, w }))
      .filter((s) => s.w.filter((v) => v !== null).length >= 2);
    if (aktive.length === 0) return null;
    const alle = aktive.flatMap((s) => s.w.filter((v): v is number => v !== null));
    const min = Math.min(...alle);
    const max = Math.max(...alle);
    const span = max - min || 1;
    const yMin = min - span * 0.08;
    const yMax = max + span * 0.08;
    return { xLabels, aktive, yMin, yMax };
  }, [spalten, zeilen]);

  if (!serien) {
    return (
      <p className="mt-2 text-xs text-neutral-400">
        Diagramm erscheint, sobald mindestens 2 Zeilen Zahlenwerte enthalten.
      </p>
    );
  }

  const { xLabels, aktive, yMin, yMax } = serien;
  const n = xLabels.length;
  const x = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(n - 1, 1);
  const y = (v: number) => PAD_T + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const yTicks = [0, 0.5, 1].map((f) => yMin + f * (yMax - yMin));

  return (
    <div className="mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" role="img">
        {/* Achsen + Raster */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={y(t)} x2={W - PAD_R} y2={y(t)} stroke="#e5e5e5" strokeWidth="1" />
            <text x={PAD_L - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#737373">
              {t.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#a3a3a3" strokeWidth="1" />
        {/* X-Beschriftung (max. 8 Labels) */}
        {xLabels.map((l, i) =>
          i % Math.ceil(n / 8) === 0 || i === n - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={H - PAD_B + 16}
              textAnchor="middle"
              fontSize="9.5"
              fill="#737373"
            >
              {l.length > 12 ? l.slice(0, 12) + "…" : l}
            </text>
          ) : null,
        )}
        {/* Serien */}
        {aktive.map(({ si, w }, farbIdx) => {
          const punkte = w
            .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
            .filter(Boolean)
            .join(" ");
          return (
            <g key={si}>
              <polyline
                points={punkte}
                fill="none"
                stroke={FARBEN[farbIdx % FARBEN.length]}
                strokeWidth="2"
              />
              {w.map((v, i) =>
                v === null ? null : (
                  <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={FARBEN[farbIdx % FARBEN.length]} />
                ),
              )}
            </g>
          );
        })}
      </svg>
      {/* Legende */}
      <div className="mt-1 flex flex-wrap gap-3">
        {aktive.map(({ si }, farbIdx) => (
          <span key={si} className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: FARBEN[farbIdx % FARBEN.length] }}
            />
            {spalten[si + 1]}
          </span>
        ))}
      </div>
    </div>
  );
}
