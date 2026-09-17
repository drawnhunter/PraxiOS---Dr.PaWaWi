// ── Öffentliche Basis-URL für Patienten-Links (1.17.0) ──────────────────────
// Links, die die Praxis VERLÄSST (Portal, Anamnesebogen, ICS-Abo), dürfen
// nicht die Adresse enthalten, über die die Praxis gerade arbeitet — aus dem
// LAN (http://192.168.x.x:3100) ist das für Patienten unerreichbar, und
// WhatsApp erkennt IP:Port-Links nicht sauber. Wenn in den Einstellungen eine
// öffentliche URL hinterlegt ist (z. B. https://praxis.example.de), gewinnt sie.
export function basisUrl(oeffentlicheUrl?: string | null): string {
  const eingestellt = oeffentlicheUrl?.trim().replace(/\/+$/, "");
  if (eingestellt && /^https?:\/\//.test(eingestellt)) return eingestellt;
  return window.location.origin;
}
