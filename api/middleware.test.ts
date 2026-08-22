import { describe, it, expect } from "vitest";
import { istTreiberFehler } from "./middleware";

describe("istTreiberFehler (Fehler-Maskierung am Client)", () => {
  it("erkennt DrizzleQueryError", () => {
    expect(istTreiberFehler({ name: "DrizzleQueryError", query: "select ...", params: [] })).toBe(true);
  });
  it("erkennt MySQL-Fehler über sqlMessage und ER_-Code", () => {
    expect(istTreiberFehler({ sqlMessage: "Table 'x.users' doesn't exist" })).toBe(true);
    expect(istTreiberFehler({ code: "ER_NO_SUCH_TABLE" })).toBe(true);
    expect(istTreiberFehler({ code: "ER_ACCESS_DENIED_ERROR" })).toBe(true);
  });
  it("erkennt Connection-Probleme", () => {
    expect(istTreiberFehler({ code: "ECONNREFUSED" })).toBe(true);
    expect(istTreiberFehler({ code: "PROTOCOL_CONNECTION_LOST" })).toBe(true);
  });
  it("erkennt verschachtelte cause-Ketten", () => {
    expect(
      istTreiberFehler({ message: "TRPC-Wrapper", cause: { name: "DrizzleQueryError", cause: { code: "ER_DUP_ENTRY" } } }),
    ).toBe(true);
  });
  it("lässt fachliche Fehler durch (wichtig für UX)", () => {
    expect(istTreiberFehler(new Error("Rechnung nicht gefunden."))).toBe(false);
    expect(istTreiberFehler({ message: "Keine Einträge mit Status stattgefunden" })).toBe(false);
    expect(istTreiberFehler(null)).toBe(false);
    expect(istTreiberFehler(undefined)).toBe(false);
  });
});
