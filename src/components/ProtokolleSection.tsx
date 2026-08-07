// ── PraxiOS: Protokolle-Tab in der Patientenakte ───────────────────────────
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, NotebookPen } from "lucide-react";

export function ProtokolleSection({ patientId }: { patientId: number }) {
  const liste = trpc.protokolle.liste.useQuery({ patientId });

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-neutral-700">Behandlungsprotokolle</h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            48 h editierbar, danach automatisch gesperrt — Nachträge bleiben möglich.
          </p>
        </div>
        <Link to="/protokolle">
          <Button variant="outline" size="sm">
            <NotebookPen className="mr-1 h-4 w-4" /> Zur Protokoll-Seite
          </Button>
        </Link>
      </div>
      {(liste.data ?? []).length === 0 ? (
        <p className="text-sm text-neutral-400">
          Noch keine Protokolle — auf der Protokoll-Seite anlegen (leer oder aus Vorlage).
        </p>
      ) : (
        <div className="divide-y divide-neutral-100">
          {(liste.data ?? []).map((p) => (
            <Link
              key={p.id}
              to={`/protokolle/${p.id}`}
              className="flex items-center justify-between gap-2 py-2.5 hover:bg-teal-50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-800">{p.titel}</span>
                {p.vorlage && <Badge variant="outline">{p.vorlage.titel}</Badge>}
                {p.gesperrt && <Lock className="h-3 w-3 text-amber-600" />}
              </div>
              <span className="text-xs text-neutral-400">
                {new Date(p.createdAt).toLocaleDateString("de-DE")}
                {p.ersteller?.name ? ` · ${p.ersteller.name}` : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
