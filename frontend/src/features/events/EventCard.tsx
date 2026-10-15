import { Link } from "react-router-dom";
import type { Event } from "../../types/domain";
import { formatDate, formatPrice } from "../../components/format";

export function EventCard({ event }: { event: Event }) {
  const soldOut = event.availableSeats === 0;
  const minPrice = event.categories.length ? Math.min(...event.categories.map((c) => c.priceCents)) : 0;

  return (
    <article className="card">
      <h2>{event.title}</h2>
      <p>
        <time dateTime={event.startsAt}>{formatDate(event.startsAt)}</time> · {event.venue}
      </p>
      <p>À partir de {formatPrice(minPrice)}</p>
      <p>{soldOut ? "Complet" : `${event.availableSeats} places restantes sur ${event.totalSeats}`}</p>
      <Link className="btn" to={`/events/${event.id}`}>
        {soldOut ? "Liste d'attente" : "Choisir mes places"}
      </Link>
    </article>
  );
}
