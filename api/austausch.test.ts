// Tests für den Arzt-zu-Arzt-Austausch (Paket-Schema + age-Roundtrip)
import { describe, it, expect } from "vitest";
import {
  Encrypter,
  Decrypter,
  generateIdentity,
  identityToRecipient,
  armor,
} from "age-encryption";
import { paketSchema, parsePaket, paketVorschau, PAKET_FORMAT, PAKET_VERSION, type AktePaket } from "./aktePaket";

const BEISPIEL: AktePaket = {
  format: PAKET_FORMAT,
  version: PAKET_VERSION,
  exportiertAm: "2026-07-26T10:00:00.000Z",
  quellPraxis: "Praxis Alpha",
  patient: {
    name: "Mustermann, Max",
    geburtsdatum: "1970-01-01",
    patientenNr: "IMTZ26001",
    strasse: "Musterweg 1",
    plz: "14480",
    ort: "Potsdam",
    land: "Deutschland",
    telefon: null,
    email: null,
    krankenkasse: null,
    versichertennummer: null,
    aerztlicherAnsprechpartner: null,
    tags: null,
    notizen: null,
  },
  kontakte: [
    {
      name: "Mustermann, Erika",
      verhaeltnis: "Ehefrau",
      telefon: null,
      email: null,
      adresse: null,
      istRechnungsempfaenger: true,
      notiz: null,
    },
  ],
  plaene: [
    {
      titel: "Therapieplan KW40–41",
      vonDatum: "2026-09-28",
      bisDatum: "2026-10-09",
      diagnoseZiele: null,
      status: "dokumentiert",
      rechnungsempfaengerAbweichend: false,
      abweichenderEmpfaenger: null,
      notizen: null,
      entries: [
        {
          datum: "2026-09-28",
          zeitVon: "09:00",
          zeitBis: "09:45",
          leistungText: "mGKHT",
          leistungName: "mGKHT — moderate Ganzkörperhyperthermie",
          menge: "1.0",
          therapeutName: "Dr. A",
          raum: null,
          status: "stattgefunden",
          bemerkung: null,
        },
      ],
    },
  ],
  dokumente: [
    {
      kategorie: "befund",
      dateiname: "labor.pdf",
      mimeType: "application/pdf",
      notiz: null,
      dateiBase64: Buffer.from("PDF-INHALT").toString("base64"),
    },
  ],
  timeline: [
    { typ: "plan", titel: "Therapieplan angelegt", beschreibung: null, datum: "2026-09-28" },
  ],
};

describe("Paket-Schema", () => {
  it("validiert ein wohlgeformtes Paket", () => {
    expect(() => parsePaket(BEISPIEL)).not.toThrow();
    expect(paketVorschau(BEISPIEL)).toMatchObject({
      patientName: "Mustermann, Max",
      anzahlPlaene: 1,
      anzahlEintraege: 1,
      anzahlDokumente: 1,
      anzahlKontakte: 1,
    });
  });

  it("lehnt falsches Format verständlich ab", () => {
    expect(() => parsePaket({ format: "anders" })).toThrow(/Paket-Format ungültig/);
    expect(() => parsePaket({ ...BEISPIEL, version: 99 })).toThrow();
  });
});

describe("age-Verschlüsselung (Export → Import Roundtrip)", () => {
  it("verschlüsselt für Empfänger und nur dieser kann öffnen", async () => {
    const secretEmpfaenger = await generateIdentity();
    const recEmpfaenger = await identityToRecipient(secretEmpfaenger);
    const secretFremd = await generateIdentity();

    const enc = new Encrypter();
    enc.addRecipient(recEmpfaenger);
    const roh = new TextEncoder().encode(JSON.stringify(BEISPIEL));
    const verschluesselt = armor.encode(await enc.encrypt(roh));
    expect(verschluesselt).toContain("BEGIN AGE ENCRYPTED FILE");

    // Richtiger Empfänger kann öffnen + Paket validieren
    const dec = new Decrypter();
    dec.addIdentity(secretEmpfaenger);
    const zurueck = await dec.decrypt(armor.decode(verschluesselt));
    const paket = parsePaket(JSON.parse(new TextDecoder().decode(zurueck)));
    expect(paket.patient.name).toBe("Mustermann, Max");

    // Fremder Schlüssel scheitert
    const decFremd = new Decrypter();
    decFremd.addIdentity(secretFremd);
    await expect(decFremd.decrypt(armor.decode(verschluesselt))).rejects.toThrow();
  });
});
