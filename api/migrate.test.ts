// Ordnungs-Wache für migrate.ts: AFTER-Verweise in NEUE_SPALTEN müssen auf
// Spalten zeigen, die ENTWEDER im Basis-Schema (schema.sql) existieren ODER
// früher in derselben Liste hinzugefügt werden. (Bug 1.7.1: backup_zuletzt_am
// zeigte auf patienten_nr_prefix VOR dessen Eintrag → ALTER schlug fehl,
// settings.get brach produktiv.)
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const mig = readFileSync(path.join(process.cwd(), "api", "migrate.ts"), "utf8");
const sql = readFileSync(path.join(process.cwd(), "schema.sql"), "utf8");

function basisSpalten(tabelle: string): Set<string> {
  const m = new RegExp("CREATE TABLE `" + tabelle + "` \\((.*?)\\n\\) ENGINE", "s").exec(sql);
  const spalten = new Set<string>();
  if (!m) return spalten;
  for (const z of m[1].split("\n")) {
    const s = /^\s*`(\w+)`/.exec(z);
    if (s) spalten.add(s[1]);
  }
  return spalten;
}

describe("migrate.ts AFTER-Ordnung", () => {
  const eintraege = [
    ...mig.matchAll(
      /\{ tabelle: "(\w+)", spalte: "(\w+)", ddl: "ALTER TABLE \w+ ADD COLUMN \w+ ([^`]*?)" \}/g,
    ),
  ].map((m, i) => ({ tabelle: m[1], spalte: m[2], ddl: m[3], idx: i }));

  it("jeder AFTER-Verweis ist auflösbar (Basis-Schema oder früherer Eintrag)", () => {
    const verletzungen: string[] = [];
    const cache = new Map<string, Set<string>>();
    for (const e of eintraege) {
      const after = / AFTER (\w+)\b/.exec(e.ddl)?.[1];
      if (!after) continue;
      if (!cache.has(e.tabelle)) cache.set(e.tabelle, basisSpalten(e.tabelle));
      const imBasisSchema = cache.get(e.tabelle)!.has(after);
      const fruehererEintrag = eintraege.some(
        (x) => x.tabelle === e.tabelle && x.spalte === after && x.idx < e.idx,
      );
      if (!imBasisSchema && !fruehererEintrag) {
        verletzungen.push(`${e.tabelle}.${e.spalte} → AFTER ${after} (nicht auflösbar)`);
      }
    }
    expect(verletzungen).toEqual([]);
  });

  it("gleiche Spalte wird nicht doppelt hinzugefügt", () => {
    const gesehen = new Map<string, number>();
    const doppelt: string[] = [];
    for (const e of eintraege) {
      const key = `${e.tabelle}.${e.spalte}`;
      gesehen.set(key, (gesehen.get(key) ?? 0) + 1);
      if (gesehen.get(key)! > 1) doppelt.push(key);
    }
    expect(doppelt).toEqual([]);
  });
});
