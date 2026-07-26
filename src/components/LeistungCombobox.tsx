import { useMemo, useRef, useState } from "react";
import { KATEGORIE_LABEL } from "@contracts/constants";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";

export interface LeistungOption {
  id: number;
  name: string;
  kategorie: "leistung" | "auslage" | null;
}

interface Props {
  leistungen: LeistungOption[];
  /** „keine“ | „freitext“ | Leistungs-ID als String */
  auswahl: string;
  freitext: string;
  onAuswahl: (auswahl: string) => void;
  onFreitext: (text: string) => void;
  placeholder?: string;
}

/**
 * Leistung wählen per Tippen (Vorschläge beim Schreiben) oder Aufklappen.
 * „Keine Leistung“ und „Freitext“ sind feste Optionen; freier Text, der nicht
 * im Katalog ist, kann als Freitext übernommen werden.
 */
export function LeistungCombobox({
  leistungen,
  auswahl,
  freitext,
  onAuswahl,
  onFreitext,
  placeholder = "Leistung tippen oder wählen …",
}: Props) {
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const gruppen = useMemo(() => {
    const map = new Map<string, LeistungOption[]>();
    for (const l of leistungen) {
      const label = l.kategorie ? KATEGORIE_LABEL[l.kategorie] : "Sonstige";
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(l);
    }
    return [...map.entries()];
  }, [leistungen]);

  const gewaehlte = auswahl !== "keine" && auswahl !== "freitext"
    ? leistungen.find((l) => String(l.id) === auswahl)
    : undefined;

  const anzeigeWert = offen
    ? suche
    : auswahl === "freitext"
      ? freitext
      : (gewaehlte?.name ?? "");

  const waehle = (wert: string) => {
    if (wert === "freitext") {
      onAuswahl("freitext");
      onFreitext(suche.trim());
    } else {
      onAuswahl(wert);
    }
    setOffen(false);
    setSuche("");
  };

  return (
    <Popover
      open={offen}
      onOpenChange={(o) => {
        // Öffnen nur über Fokus/Chevron; Schließen per Klick außerhalb/Escape
        if (!o) {
          setOffen(false);
          setSuche("");
        }
      }}
    >
      <PopoverAnchor asChild>
        <div className="relative">
          <input
            ref={inputRef}
            value={anzeigeWert}
            placeholder={placeholder}
            className={cn(
              "border-input placeholder:text-muted-foreground flex h-9 w-full rounded-md border bg-transparent px-3 pr-9 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            )}
            onFocus={() => setOffen(true)}
            onChange={(e) => {
              setSuche(e.target.value);
              if (!offen) setOffen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOffen(false);
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Leistungsliste öffnen"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setOffen(!offen)}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-anchor-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>Kein Katalog-Treffer — als Freitext übernehmen.</CommandEmpty>
              <CommandGroup heading="Direktwahl">
                <CommandItem value="keine" onSelect={() => waehle("keine")}>
                  <Check className={cn("h-4 w-4", auswahl === "keine" ? "opacity-100" : "opacity-0")} />
                  Keine Leistung
                </CommandItem>
                {suche.trim() && (
                  <CommandItem value="freitext" onSelect={() => waehle("freitext")}>
                    <Check className={cn("h-4 w-4", auswahl === "freitext" ? "opacity-100" : "opacity-0")} />
                    Freitext: „{suche.trim()}“
                  </CommandItem>
                )}
              </CommandGroup>
              {gruppen.map(([label, liste]) => (
                <CommandGroup key={label} heading={label}>
                  {liste
                    .filter((l) => norm(l.name).includes(norm(suche)))
                    .slice(0, 12)
                    .map((l) => (
                      <CommandItem
                        key={l.id}
                        value={String(l.id)}
                        onSelect={() => waehle(String(l.id))}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            auswahl === String(l.id) ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {l.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
    </Popover>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
