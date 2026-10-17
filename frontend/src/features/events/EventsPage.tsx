import { useMemo, useState } from "react";
import { useEvents } from "./useEvents";
import { EventCard } from "./EventCard";
import { EventGridSkeleton } from "../../components/Skeleton";

type Filter = "all" | "available" | "soldout";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tous" }, { id: "available", label: "Disponibles" }, { id: "soldout", label: "Complets" },
];

export function EventsPage() {
  const { data, status, error, refetch, isFetching } = useEvents();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? [])
      .filter((e) => !needle || `${e.title} ${e.venue}`.toLowerCase().includes(needle))
      .filter((e) => filter === "all" || (filter === "soldout") === (e.availableSeats === 0))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [data, q, filter]);

  return (
    <section aria-labelledby="events-title">
      <div className="page-head">
        <h1 id="events-title">Événements</h1>
        <p className="muted">Trouvez votre prochaine sortie.</p>
      </div>

      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Rechercher un événement ou un lieu</span>
          <input type="search" placeholder="🔍 Rechercher un événement ou un lieu…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="seg" role="group" aria-label="Filtrer par disponibilité">
          {FILTERS.map((f) => (
            <button key={f.id} aria-pressed={filter === f.id} className={filter === f.id ? "on" : ""} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>

      {status === "pending" && <EventGridSkeleton />}
      {status === "error" && (
        <div role="alert" className="banner err">
          <p>Impossible de charger les événements : {error.message}</p>
          <button onClick={() => refetch()} disabled={isFetching}>Réessayer</button>
        </div>
      )}
      {status === "success" && (
        <>
          <p className="muted" aria-live="polite">{results.length} événement{results.length > 1 ? "s" : ""}</p>
          {results.length === 0 ? (
            <div className="card empty"><p><strong>Aucun résultat.</strong></p><p>Essayez d'autres mots-clés ou retirez les filtres.</p>
              <button onClick={() => { setQ(""); setFilter("all"); }}>Réinitialiser</button></div>
          ) : (
            <div className="grid">{results.map((e, i) => <EventCard key={e.id} event={e} index={i} />)}</div>
          )}
        </>
      )}
    </section>
  );
}
