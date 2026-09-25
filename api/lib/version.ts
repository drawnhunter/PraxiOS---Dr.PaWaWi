// Zentrale Versionsangabe — KANONISCH für den SupportHub (SOP §3).
// Muss synchron zu package.json/version und CHANGELOG.md gehalten werden;
// die Sync wird durch den Test api/lib/version.test.ts erzwungen.
export const APP_VERSION = "1.20.1";

// Produkt-Stempel (1.20.1): maschinenlesbare Produkt-Identität — der Hub
// prüft damit vor Deployments die Produkt-Hoheit (Paket === Instanz).
// Quelle der Wahrheit außerhalb des Bundles: /praxios-produkt.json (Repo-Root).
export const APP_PRODUKT = "pawawi";
export const APP_PRODUKT_NAME = "Dr.PaWaWi — Akte & Abrechnung";
export const APP_HERSTELLER = "PraxiOS";
