import { describe, it, expect } from "vitest";
import { naechsterIndex, istLetzteZelle } from "./fragenZellen";

describe("Zellen-Editor Navigation (Ankreuz-Fragen)", () => {
  it("rechts/links bewegt um 1, geklemmt am Rand", () => {
    expect(naechsterIndex(0, "ArrowRight", 2, 5)).toBe(1);
    expect(naechsterIndex(4, "ArrowRight", 2, 5)).toBe(4);
    expect(naechsterIndex(0, "ArrowLeft", 2, 5)).toBe(0);
  });

  it("rauf/runter springt um Spaltenzahl", () => {
    expect(naechsterIndex(1, "ArrowDown", 2, 6)).toBe(3);
    expect(naechsterIndex(1, "ArrowUp", 2, 6)).toBe(0);
    expect(naechsterIndex(5, "ArrowDown", 2, 6)).toBe(5);
    expect(naechsterIndex(2, "ArrowDown", 1, 6)).toBe(3);
  });

  it("Enter in letzter Zelle signalisiert Neuanlage", () => {
    expect(istLetzteZelle(4, 5)).toBe(true);
    expect(istLetzteZelle(3, 5)).toBe(false);
  });
});
