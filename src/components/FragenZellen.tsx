import { useRef } from "react";
import { cn } from "@/lib/utils";
import { naechsterIndex, istLetzteZelle } from "@/lib/fragenZellen";
import { Plus, X } from "lucide-react";

interface Props {
  fragen: string[];
  spalten: 1 | 2;
  onChange: (fragen: string[]) => void;
}

/**
 * Zellen-Editor für Ankreuz-Fragen: jede Frage eine Eingabe-Zelle im Raster
 * (1 oder 2 Spalten), Navigation per Pfeiltasten, Enter legt eine neue Zelle
 * an, Zeilenumbrüche macht das Layout automatisch (angepasst an die Spalten).
 */
export function FragenZellen({ fragen, spalten, onChange }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const fokussiere = (i: number) => {
    const el = refs.current[i];
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  };

  const aendern = (i: number, wert: string) => {
    const kopie = [...fragen];
    kopie[i] = wert;
    onChange(kopie);
  };

  const hinzufuegen = (fokus = true) => {
    onChange([...fragen, ""]);
    if (fokus) setTimeout(() => fokussiere(fragen.length), 0);
  };

  const entfernen = (i: number) => {
    onChange(fragen.filter((_, bi) => bi !== i));
    setTimeout(() => fokussiere(Math.max(0, i - 1)), 0);
  };

  const tasten = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const k = e.key;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(k)) {
      e.preventDefault();
      if (k === "Enter" && istLetzteZelle(i, fragen.length)) {
        hinzufuegen();
        return;
      }
      fokussiere(naechsterIndex(i, k as never, spalten, fragen.length));
    } else if (k === "Backspace" && fragen[i] === "" && fragen.length > 0) {
      e.preventDefault();
      entfernen(i);
    }
  };

  return (
    <div className={cn("grid gap-2", spalten === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
      {fragen.map((frage, i) => (
        <div key={i} className="group relative">
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={frage}
            placeholder={`Frage ${i + 1}`}
            className="border-input placeholder:text-muted-foreground flex h-9 w-full rounded-md border bg-transparent px-3 pr-8 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            onChange={(e) => aendern(i, e.target.value)}
            onKeyDown={(e) => tasten(i, e)}
          />
          <button
            type="button"
            tabIndex={-1}
            title="Frage entfernen"
            onClick={() => entfernen(i)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-300 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-red-600 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => hinzufuegen()}
        className={cn(
          "flex h-9 items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 text-sm text-neutral-400 transition-colors hover:border-[#0F766E]/50 hover:text-[#0F766E]",
          spalten === 2 && "sm:col-span-2",
        )}
      >
        <Plus className="h-4 w-4" /> Frage hinzufügen
      </button>
    </div>
  );
}
