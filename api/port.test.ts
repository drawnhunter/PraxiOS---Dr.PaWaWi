// Tests für den WAWIPROS-1.0-Port: Secrets + XRechnung-Einleser
import { describe, it, expect } from "vitest";
import { verschluesseln, entschluesseln } from "./lib/secrets";
import { analysiereXrechnung } from "./xrechnungEinlesen";

describe("Secrets (AES-256-GCM, Key = APP_SECRET)", () => {
  it("verschlüsselt und entschlüsselt korrekt", () => {
    const enc = verschluesseln("geheimes-smtp-passwort-123!");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("geheimes");
    expect(entschluesseln(enc)).toBe("geheimes-smtp-passwort-123!");
  });

  it("gibt null bei ungültigen Werten", () => {
    expect(entschluesseln(null)).toBeNull();
    expect(entschluesseln("klartext-ohne-format")).toBeNull();
    expect(entschluesseln("v1:00:00:00")).toBeNull();
  });
});

const CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
 xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
 xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>RE-2026-0042</ram:ID>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260720</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:SpecifiedTradeProduct><ram:Name>Infusionslösung 500 ml</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>6.50</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">10</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:RateApplicablePercent>19</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>65.00</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>Medizinbedarf GmbH</ram:Name>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE123456789</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>65.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">12.35</ram:TaxTotalAmount>
        <ram:GrandTotalAmount currencyID="EUR">77.35</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

describe("XRechnung-Einleser (CII, EN 16931)", () => {
  it("parst eine valide CII-Rechnung mit Positionen und Summen", () => {
    const { daten, fehler } = analysiereXrechnung(CII);
    expect(fehler).toHaveLength(0);
    expect(daten.nummer).toBe("RE-2026-0042");
    expect(daten.datum).toBe("2026-07-20");
    expect(daten.lieferant).toBe("Medizinbedarf GmbH");
    expect(daten.lieferantKennung).toBe("DE123456789");
    expect(daten.brutto).toBeCloseTo(77.35, 2);
    expect(daten.netto).toBeCloseTo(65.0, 2);
    expect(daten.ust).toBeCloseTo(12.35, 2);
    expect(daten.positionen).toHaveLength(1);
    expect(daten.positionen[0]).toMatchObject({ bezeichnung: "Infusionslösung 500 ml", ustSatz: 19 });
  });

  it("meldet Nicht-CII-XML verständlich", () => {
    const { fehler } = analysiereXrechnung("<html><body>kein xml</body></html>");
    expect(fehler[0]).toMatch(/CrossIndustryInvoice/);
  });
});
