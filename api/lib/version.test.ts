// SOP §3: version.ts, package.json und CHANGELOG.md müssen synchron sein.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { APP_VERSION, APP_PRODUKT, APP_PRODUKT_NAME, APP_HERSTELLER } from "./version";

describe("Versions-Sync (SOP)", () => {
  const pkg = JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
  ) as { version: string };

  it("version.ts == package.json", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("CHANGELOG führt die aktuelle Version als obersten Eintrag", () => {
    const changelog = readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
    expect(changelog).toContain(`## [${APP_VERSION}]`);
  });

  it("Versionsformat ist MAJOR.MINOR.PATCH (drei Ganzzahlen)", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// Produkt-Stempel (Instanz-Pass, VERSIONSREGEL §4): praxios-produkt.json
// muss existieren und exakt den Feldern aus version.ts entsprechen.
describe("Produkt-Stempel", () => {
  const pfad = path.join(process.cwd(), "praxios-produkt.json");

  it("praxios-produkt.json existiert am Repo-Root", () => {
    expect(existsSync(pfad)).toBe(true);
  });

  it("Stempel-Felder == version.ts", () => {
    const stempel = JSON.parse(readFileSync(pfad, "utf8")) as {
      produkt: string;
      produktName: string;
      hersteller: string;
    };
    expect(stempel.produkt).toBe(APP_PRODUKT);
    expect(stempel.produktName).toBe(APP_PRODUKT_NAME);
    expect(stempel.hersteller).toBe(APP_HERSTELLER);
    expect(stempel.produkt).toBe("pawawi"); // Hoheitsregel: dies ist die PaWaWi-Reihe
  });
});
