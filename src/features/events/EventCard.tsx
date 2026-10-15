import type { Event } from "../../types/domain";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "full",
  timeStyle: "short",
});
const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function EventCard({ event }: { event: Event }) {
  const isSoldOut = event.availableSeats === 0;
  const minPrice = Math.min(...event.categories.map((c) => c.priceCents));

  return (
    <article>
      <h2>{event.title}</h2>
      <p>
        <time dateTime={event.startsAt}>
          {dateFmt.format(new Date(event.startsAt))}
        </time>{" "}
        · {event.venue}
      </p>
      <p>À partir de {euro.format(minPrice / 100)}</p>
      <p>
        {isSoldOut
          ? "Complet"
          : `${event.availableSeats} places restantes sur ${event.totalSeats}`}
      </p>
      <button disabled={isSoldOut}>Choisir mes places</button>
    </article>
  );
}