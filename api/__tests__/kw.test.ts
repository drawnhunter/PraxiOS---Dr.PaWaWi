import { describe, it, expect } from "vitest";
import { kwZuDatum, datumZuKw } from "../lib/kalender";

describe("kwZuDatum (ISO-8601)", () => {
  it("KW 40/2026, Montag", () => {
    expect(kwZuDatum(2026, 40, 1)).toBe("2026-09-28");
  });
  it("KW 40/2026, Freitag", () => {
    expect(kwZuDatum(2026, 40, 5)).toBe("2026-10-02");
  });
  it("KW 1/2026, Montag liegt noch in 2025", () => {
    expect(kwZuDatum(2026, 1, 1)).toBe("2025-12-29");
  });
  it("KW 1/2026, Sonntag", () => {
    expect(kwZuDatum(2026, 1, 7)).toBe("2026-01-04");
  });
  it("KW 53/2020 (Jahr mit 53 KWs), Montag", () => {
    expect(kwZuDatum(2020, 53, 1)).toBe("2020-12-28");
  });
});

describe("datumZuKw (Rundreise)", () => {
  it("2026-09-28 → KW 40/2026", () => {
    expect(datumZuKw("2026-09-28")).toEqual({ jahr: 2026, kw: 40 });
  });
  it("2025-12-29 → KW 1/2026", () => {
    expect(datumZuKw("2025-12-29")).toEqual({ jahr: 2026, kw: 1 });
  });
  it("2026-01-01 → KW 1/2026", () => {
    expect(datumZuKw("2026-01-01")).toEqual({ jahr: 2026, kw: 1 });
  });
});
