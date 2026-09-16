// ── Zwischenablage mit HTTP-Fallback ─────────────────────────────────────────
// navigator.clipboard gibt es nur in Secure Contexts (HTTPS/localhost) — über
// direkte LAN-IP (http://192.168.x.x) ist es undefined (Bus #51: Meldeweg
// brach im Feld komplett). Fallback: klassisches Textarea + execCommand.
export async function kopiereInZwischenablage(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fällt durch zum Fallback
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
