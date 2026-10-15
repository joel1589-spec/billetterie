// src/features/events/
import { useEvents } from "./useEvents";
import { EventCard } from "./EventCard";

export function EventList() {
  const { data, status, error, refetch, isFetching } = useEvents();

  if (status === "pending") {
    return <p role="status" aria-busy="true">Chargement des événements…</p>;
  }

  if (status === "error") {
    return (
      <div role="alert">
        <p>Erreur : {error.message}</p>
        <button onClick={() => refetch()} disabled={isFetching}>
          Réessayer
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return <p>Aucun événement programmé pour le moment.</p>;
  }

  return (
    <section aria-labelledby="events-title">
      <h1 id="events-title">Événements</h1>
      {data.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </section>
  );
}