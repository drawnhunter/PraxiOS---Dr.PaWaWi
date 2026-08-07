import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { trpc } from "@/providers/trpc";
import { akzentAnwenden } from "@/lib/design";
import { APP_VERSION } from "@/const";
import type { Recht } from "@contracts/constants";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  FileUp,
  Landmark,
  FileText,
  Receipt,
  Users,
  Package,
  Package2,
  Settings,
  FileSignature,
  NotebookPen,
  Pill,
  Share2,
  FileDown,
  MailOpen,
  CalendarClock,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type NavEintrag = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  recht?: Recht;
  adminNur?: boolean;
};
type NavGruppe = { id: string; titel: string; eintraege: NavEintrag[] };

const OBEN: NavEintrag[] = [
  { to: "/", label: "Übersicht", icon: LayoutDashboard, end: true },
  { to: "/kalender", label: "Kalender", icon: Calendar, recht: "kalender" },
];

const GRUPPEN: NavGruppe[] = [
  {
    id: "praxis",
    titel: "Praxis",
    eintraege: [
      { to: "/patienten", label: "Patienten", icon: Users, recht: "akte" },
      { to: "/plaene", label: "Therapiepläne", icon: ClipboardList, recht: "plaene" },
      { to: "/anamnese", label: "Anamnesebögen", icon: FileSignature, recht: "anamnese" },
      { to: "/rezepte", label: "Rezepte & Atteste", icon: Pill, recht: "dokumente" },
      { to: "/protokolle", label: "Protokolle", icon: NotebookPen, recht: "plaene" },
      { to: "/austausch", label: "Austausch", icon: Share2, recht: "austausch" },
    ],
  },
  {
    id: "abrechnung",
    titel: "Abrechnung",
    eintraege: [
      { to: "/import", label: "Import", icon: FileUp, recht: "abrechnung" },
      { to: "/rechnungen", label: "Rechnungen", icon: FileText, recht: "abrechnung" },
      { to: "/gutschriften", label: "Gutschriften", icon: Receipt, recht: "abrechnung" },
      { to: "/e-rechnung", label: "E-Rechnung", icon: FileDown, recht: "abrechnung" },
      { to: "/posteingang", label: "Post Manager", icon: MailOpen, recht: "abrechnung" },
      { to: "/zahlungsziele", label: "Zahlungsziele", icon: CalendarClock, recht: "abrechnung" },
      { to: "/bank", label: "Bank", icon: Landmark, recht: "abrechnung" },
    ],
  },
  {
    id: "stammdaten",
    titel: "Stammdaten",
    eintraege: [
      { to: "/produkte", label: "Leistungen", icon: Package, recht: "abrechnung" },
      { to: "/lager", label: "Lager", icon: Package2, recht: "lager" },
    ],
  },
];

const UNTEN: NavEintrag[] = [
  { to: "/einstellungen", label: "Einstellungen", icon: Settings, adminNur: true },
];

function ladeGruppenZugeklappt(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem("nav-gruppen-zugeklappt") ?? "{}");
  } catch {
    return {};
  }
}

export default function Layout() {
  const { user, isLoading, logout } = useAuth({ redirectOnUnauthenticated: true });
  const [navOffen, setNavOffen] = useState(false);
  const [gruppenZugeklappt, setGruppenZugeklappt] = useState<Record<string, boolean>>(ladeGruppenZugeklappt);

  // Sidebar klappt im Therapieplan-Detail automatisch ein (Icon-Leiste)
  const location = useLocation();
  const istPlanDetail =
    location.pathname.startsWith("/plaene/") && location.pathname !== "/plaene";
  const [manuellZugeklappt, setManuellZugeklappt] = useState(false);
  const zugeklappt = istPlanDetail || manuellZugeklappt;

  const ich = trpc.auth.me.useQuery(undefined, { retry: false });
  const meineRechte = (ich.data?.rechte ?? []) as Recht[];

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

  const sichtbar = (e: NavEintrag) =>
    (!e.adminNur || ich.data?.role === "admin") &&
    (!e.recht || meineRechte.includes(e.recht));

  const gruppeKlappen = (id: string) => {
    setGruppenZugeklappt((z) => {
      const neu = { ...z, [id]: !z[id] };
      localStorage.setItem("nav-gruppen-zugeklappt", JSON.stringify(neu));
      return neu;
    });
  };

  const eintrag = (item: NavEintrag) => (
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
  );

  const navInhalt = (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-5 py-4">
        {!zugeklappt ? (
          <div>
            <div className="font-extrabold tracking-tight">
              Dr.<span className="text-teal-700">PaWaWi</span>
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-400">Akte &amp; Abrechnung</div>
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0F766E] text-xs font-extrabold text-white">
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

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {OBEN.filter(sichtbar).map(eintrag)}
        {GRUPPEN.map((g) => {
          const eintraege = g.eintraege.filter(sichtbar);
          if (eintraege.length === 0) return null;
          if (zugeklappt) return eintraege.map(eintrag);
          return (
            <div key={g.id} className="mt-1">
              <button
                onClick={() => gruppeKlappen(g.id)}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase hover:text-neutral-600"
              >
                {g.titel}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    gruppenZugeklappt[g.id] && "-rotate-90",
                  )}
                />
              </button>
              {!gruppenZugeklappt[g.id] && eintraege.map(eintrag)}
            </div>
          );
        })}
        <div className="mt-1 border-t border-neutral-100 pt-1">{UNTEN.filter(sichtbar).map(eintrag)}</div>
      </nav>

      <div className="border-t border-neutral-200 p-3">
        {!zugeklappt && (
          <div className="mb-2 truncate px-1 text-xs text-neutral-600" title={user.email ?? ""}>
            {user.name ?? "Benutzer"}
            {ich.data?.gruppeName ? ` · ${ich.data.gruppeName}` : ""}
          </div>
        )}
        <button
          onClick={logout}
          title="Abmelden"
          className={cn(
            "flex w-full items-center rounded-md border border-neutral-200 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900",
            zugeklappt ? "justify-center px-2 py-1.5" : "justify-center gap-1.5 px-3 py-1.5",
          )}
        >
          <LogOut className="h-4 w-4" /> {!zugeklappt && "Abmelden"}
        </button>
        {!zugeklappt && (
          <div className="mt-2 text-center text-[11px] text-neutral-400">
            {`Dr.PaWaWi v${APP_VERSION} · PraxiOS`}
          </div>
        )}
      </div>
    </div>
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
          <span className="text-sm font-extrabold tracking-tight">
            Dr.<span className="text-teal-700">PaWaWi</span>
          </span>
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
