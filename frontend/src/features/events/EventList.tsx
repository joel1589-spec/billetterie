import { useEvents } from "./useEvents";
import { EventCard } from "./EventCard";
import { EventGridSkeleton } from "../../components/Skeleton";

export function EventList() {
  const { data, status, error, refetch, isFetching } = useEvents();

  return (
    <section aria-labelledby="events-title">
      <div className="hero">
        <h1 id="events-title">Vivez le spectacle, choisissez votre place.</h1>
        <p>Réservez en direct : le plan de la salle se met à jour en temps réel, et vos sièges sont bloqués 10 minutes.</p>
      </div>

      {status === "pending" && <EventGridSkeleton />}

      {status === "error" && (
        <div role="alert" className="banner err">
          <p>Impossible de charger les événements : {error.message}</p>
          <button onClick={() => refetch()} disabled={isFetching}>Réessayer</button>
        </div>
      )}

      {status === "success" && data.length === 0 && (
        <div className="card empty">
          <p><strong>Aucun événement programmé pour le moment.</strong></p>
          <p>Un organisateur peut en créer depuis le back-office.</p>
        </div>
      )}

      {status === "success" && data.length > 0 && (
        <div className="grid">
          {data.map((e, i) => <EventCard key={e.id} event={e} index={i} />)}
        </div>
      )}
    </section>
  );
}
