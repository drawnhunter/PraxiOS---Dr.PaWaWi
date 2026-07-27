import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { trpc } from "@/providers/trpc";
import { akzentAnwenden } from "@/lib/design";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  FileSignature,
  FileDown,
  Package2,
  Share2,
  FileUp,
  Landmark,
  FileText,
  Receipt,
  Users,
  Package,
  Settings,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/const";
import type { Recht } from "@contracts/constants";
import { useAuth } from "@/hooks/useAuth";

// Dr.ReWaWi: Navigation auf den Abrechnungs-Workflow zugeschnitten.
// (Angebote/Lieferscheine/Bestellungen/Lieferanten/Statistik sind weiterhin
// über ihre URLs erreichbar, stehen aber nicht im Menü.)
// recht: Menüpunkt nur mit diesem Gruppen-Recht sichtbar (admin = alles).
// Serverseitig sind die Bereiche ohnehin pro Router abgesichert.
const NAV: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; recht?: Recht; adminNur?: boolean }[] = [
  { to: "/", label: "Übersicht", icon: LayoutDashboard, end: true },
  { to: "/kalender", label: "Kalender", icon: Calendar, recht: "kalender" },
  { to: "/patienten", label: "Patienten", icon: Users, recht: "akte" },
  { to: "/plaene", label: "Therapiepläne", icon: ClipboardList, recht: "plaene" },
  { to: "/anamnese", label: "Anamnesebögen", icon: FileSignature, recht: "anamnese" },
  { to: "/austausch", label: "Austausch", icon: Share2, recht: "austausch" },
  { to: "/therapie-import", label: "Abrechnung", icon: FileUp, recht: "abrechnung" },
  { to: "/rechnungen", label: "Rechnungen", icon: FileText, recht: "abrechnung" },
  { to: "/gutschriften", label: "Gutschriften", icon: Receipt, recht: "abrechnung" },
  { to: "/e-rechnung", label: "E-Rechnung", icon: FileDown, recht: "abrechnung" },
  { to: "/bank", label: "Bank", icon: Landmark, recht: "abrechnung" },
  { to: "/produkte", label: "Leistungen", icon: Package, recht: "abrechnung" },
  { to: "/lager", label: "Lager", icon: Package2, recht: "lager" },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings, adminNur: true },
];

export default function Layout() {
  const { user, isLoading, logout } = useAuth({ redirectOnUnauthenticated: true });
  const [navOffen, setNavOffen] = useState(false);
  // Sidebar klappt im Therapieplan-Detail automatisch ein (Icon-Leiste)
  const location = useLocation();
  const istPlanDetail =
    location.pathname.startsWith("/plaene/") && location.pathname !== "/plaene";
  const [manuellZugeklappt, setManuellZugeklappt] = useState(false);
  const zugeklappt = istPlanDetail || manuellZugeklappt;

  const ich = trpc.auth.me.useQuery(undefined, { retry: false });
  const meineRechte = ich.data?.rechte ?? [];
  const sichtbar = NAV.filter(
    (item) =>
      (!item.adminNur || ich.data?.role === "admin") &&
      (!item.recht || meineRechte.includes(item.recht)),
  );

  // Akzentfarbe aus den Einstellungen aufs UI anwenden
  const einstellungen = trpc.settings.get.useQuery(undefined, { retry: false });
  useEffect(() => {
    akzentAnwenden(einstellungen.data?.akzentfarbe ?? "petrol");
  }, [einstellungen.data?.akzentfarbe]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <p className="text-sm text-neutral-500">Anmeldung wird geprüft …</p>
      </div>
    );
  }

  const navInhalt = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-5">
        {!zugeklappt && (
          <div>
            <div className="text-sm font-semibold tracking-tight">Dr.PaWaWi</div>
            <div className="text-xs text-neutral-500">Akte &amp; Abrechnung</div>
          </div>
        )}
        {zugeklappt && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0F766E] text-xs font-bold text-white">
            PW
          </div>
        )}
        <button
          onClick={() => setManuellZugeklappt(!manuellZugeklappt)}
          aria-label={zugeklappt ? "Menü aufklappen" : "Menü einklappen"}
          title={zugeklappt ? "Menü aufklappen" : "Menü einklappen"}
          className="hidden rounded p-1.5 text-neutral-400 hover:bg-neutral-100 md:block"
        >
          {zugeklappt ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setNavOffen(false)}
          aria-label="Menü schließen"
          className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="px-3">
        {sichtbar.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setNavOffen(false)}
            title={zugeklappt ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "mb-0.5 flex items-center rounded-md text-sm transition-colors",
                zugeklappt ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5",
                isActive
                  ? "bg-neutral-100 font-medium text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!zugeklappt && item.label}
          </NavLink>
        ))}
      </nav>
      <div className={cn("absolute bottom-4 left-0 w-full", zugeklappt ? "px-2" : "px-5")}>
        {zugeklappt ? (
          <button
            onClick={logout}
            title="Abmelden"
            className="mx-auto block rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 gap-2">
              <span className="truncate text-xs text-neutral-600" title={user.email ?? ""}>
                {user.name ?? "Benutzer"}
                {ich.data?.gruppeName ? ` · ${ich.data.gruppeName}` : ""}
              </span>
              <button
                onClick={logout}
                title="Abmelden"
                className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-[11px] text-neutral-400">{`Dr.PaWaWi v${APP_VERSION} · PraxiOS`}</div>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Mobiler Kopfbereich */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setNavOffen(true)}
            aria-label="Menü öffnen"
            className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold tracking-tight">Dr.PaWaWi</span>
        </div>
        <button
          onClick={logout}
          aria-label="Abmelden"
          className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Abdunklung hinter dem mobilen Menü */}
      {navOffen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setNavOffen(false)}
        />
      )}

      {/* Seitenleiste: mobil als Einblendung, ab md dauerhaft sichtbar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 border-r border-neutral-200 bg-white transition-all duration-200 md:translate-x-0",
          zugeklappt ? "w-64 md:w-14" : "w-64 md:w-56",
          navOffen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {navInhalt}
      </aside>

      <main className={cn("min-h-screen pt-14 md:pt-0 transition-all duration-200", zugeklappt ? "md:ml-14" : "md:ml-56")}>
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
