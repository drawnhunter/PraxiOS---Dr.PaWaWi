// SOP §3: version.ts, package.json und CHANGELOG.md müssen synchron sein.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { APP_VERSION } from "./version";

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
});
