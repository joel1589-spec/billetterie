import { Link } from "react-router-dom";
import type { Event } from "../../types/domain";
import { formatDate, formatPrice } from "../../components/format";

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });

export function EventCard({ event, index = 0 }: { event: Event; index?: number }) {
  const soldOut = event.availableSeats === 0;
  const ratioLeft = event.totalSeats ? event.availableSeats / event.totalSeats : 0;
  const almostFull = !soldOut && ratioLeft < 0.2;
  const minPrice = event.categories.length ? Math.min(...event.categories.map((c) => c.priceCents)) : 0;
  const hue = (event.id * 57) % 360; // une couleur stable par événement
  const d = new Date(event.startsAt);

  return (
    <article className="card evcard" style={{ animationDelay: `${index * 60}ms` }}>
      <div
        className="cover"
        data-initial={event.title[0]}
        style={{ background: `linear-gradient(135deg, hsl(${hue} 80% 58%), hsl(${(hue + 55) % 360} 75% 42%))` }}
      >
        <div className="datebadge" aria-hidden="true">
          <small>{monthFmt.format(d)}</small>
          <span>{d.getDate()}</span>
        </div>
      </div>
      <div className="evbody">
        <span className={`pill ${soldOut ? "err" : almostFull ? "warn" : "ok"}`}>
          {soldOut ? "Complet" : almostFull ? "Presque complet" : "Disponible"}
        </span>
        <h2>{event.title}</h2>
        <div className="evmeta">
          <time dateTime={event.startsAt}>{formatDate(event.startsAt)}</time>
          <span>📍 {event.venue}</span>
        </div>
        <div className="meter" aria-hidden="true"><i style={{ width: `${(1 - ratioLeft) * 100}%` }} /></div>
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {soldOut ? "Plus aucune place" : `${event.availableSeats} places restantes sur ${event.totalSeats}`}
        </p>
        <div className="evfoot">
          <span className="price"><small>dès </small>{formatPrice(minPrice)}</span>
          <Link className={`btn ${soldOut ? "" : "primary"}`} to={`/events/${event.id}`}>
            {soldOut ? "Liste d'attente" : "Choisir mes places"}
          </Link>
        </div>
      </div>
    </article>
  );
}
