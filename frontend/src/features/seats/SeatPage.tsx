import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEvent } from "../../api/events";
import { fetchPendingOrders } from "../../api/orders";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { formatDate, formatPrice } from "../../components/format";
import type { Seat, SocketMessage } from "../../types/domain";
import { SeatMap } from "./SeatMap";
import { useSeats } from "./useSeats";
import { useSeatSocket } from "./useSeatSocket";
import { useReserveSeats } from "./useReserveSeats";
import { WaitlistPanel, waitlistKey } from "./WaitlistPanel";

const MAX_SEATS = 6;

export function SeatPage() {
  const eventId = Number(useParams().eventId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [announce, setAnnounce] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const eventQ = useQuery({ queryKey: ["events", eventId], queryFn: () => fetchEvent(eventId) });
  const seatsQ = useSeats(eventId);
  const pendingQ = useQuery({
    queryKey: ["orders", "pending", eventId],
    queryFn: () => fetchPendingOrders(eventId),
    enabled: Boolean(user),
  });
  const reserve = useReserveSeats(eventId);

  const socketState = useSeatSocket(eventId, (m: SocketMessage) => {
    if (m.type === "seats_changed") {
      // Un siège que j'avais sélectionné vient de m'échapper : on le retire et on le dit.
      setSelected((prev) => {
        const lost = m.seats.filter((s) => prev.has(s.id) && s.status !== "available");
        if (lost.length === 0) return prev;
        setAnnounce(`${lost.length} siège(s) sélectionné(s) viennent d'être pris par un autre utilisateur.`);
        const next = new Set(prev);
        lost.forEach((s) => next.delete(s.id));
        return next;
      });
    } else if (m.type === "waitlist_notified" && m.userId === user?.id) {
      qc.invalidateQueries({ queryKey: waitlistKey(eventId) });
      setAnnounce("Des places se sont libérées, vous êtes prioritaire pendant 5 minutes.");
    }
  });

  const seats = seatsQ.data;
  const event = eventQ.data;
  const priceOf = useMemo(() => new Map(event?.categories.map((c) => [c.id, c.priceCents])), [event]);

  const toggle = (seat: Seat) => {
    setMessage(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) {
        next.delete(seat.id);
        setAnnounce(`Siège ${seat.row}${seat.number} retiré.`);
      } else if (next.size >= MAX_SEATS) {
        setAnnounce(`Maximum ${MAX_SEATS} sièges.`);
        setMessage(`Vous ne pouvez pas sélectionner plus de ${MAX_SEATS} sièges.`);
      } else {
        next.add(seat.id);
        setAnnounce(`Siège ${seat.row}${seat.number} sélectionné.`);
      }
      return next;
    });
  };

  const submit = () => {
    setMessage(null);
    const ids = [...selected];
    reserve.mutate(ids, {
      onSuccess: (order) => navigate(`/orders/${order.id}`),
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          const lost = new Set((err.data.seatIds as number[]) ?? []);
          setSelected((prev) => new Set([...prev].filter((id) => !lost.has(id))));
          setMessage("Désolé, un ou plusieurs sièges viennent d'être pris par quelqu'un d'autre. Choisissez-en d'autres.");
        } else if (err instanceof ApiError && err.status === 429) {
          setMessage("Trop de tentatives, patientez quelques secondes.");
        } else {
          setMessage(err.message);
        }
      },
    });
  };

  if (eventQ.status === "pending" || seatsQ.status === "pending")
    return <p role="status" aria-busy="true">Chargement du plan de salle…</p>;
  if (eventQ.status === "error" || seatsQ.status === "error") {
    return (
      <div role="alert">
        <p>Impossible de charger l'événement.</p>
        <button onClick={() => { eventQ.refetch(); seatsQ.refetch(); }}>Réessayer</button>
      </div>
    );
  }
  if (!seats || seats.length === 0) return <p>Cet événement n'a pas encore de plan de salle.</p>;

  const total = [...selected].reduce((sum, id) => sum + (priceOf.get(seats.find((s) => s.id === id)?.categoryId ?? -1) ?? 0), 0);
  const soldOut = !seats.some((s) => s.status === "available");
  const pendingOrder = pendingQ.data?.[0];

  return (
    <section>
      <p><Link to="/">← Événements</Link></p>
      <h1>{event!.title}</h1>
      <p><time dateTime={event!.startsAt}>{formatDate(event!.startsAt)}</time> · {event!.venue}</p>

      {socketState !== "open" && (
        <p role="status" className="banner">
          {socketState === "connecting" ? "Connexion au temps réel…" : "Connexion perdue, reconnexion en cours… Le plan peut être obsolète."}
        </p>
      )}

      {pendingOrder && (
        <p className="banner">
          Vous avez déjà une réservation en cours. <Link to={`/orders/${pendingOrder.id}`}>La reprendre</Link>
        </p>
      )}

      <ul className="legend" aria-label="Légende">
        {event!.categories.map((c, i) => (
          <li key={c.id}><span className={`swatch cat-${i % 6}`} /> {c.name} — {formatPrice(c.priceCents)}</li>
        ))}
        <li>✓ sélectionné · ★ à vous · ⏳ en cours de réservation · ✕ vendu</li>
      </ul>

      <SeatMap seats={seats} categories={event!.categories} selected={selected} onToggle={toggle} />

      <div className="summary" aria-live="polite">
        <p>{selected.size} / {MAX_SEATS} sièges · <strong>{formatPrice(total)}</strong></p>
        {!user ? (
          <p><Link to="/login">Connectez-vous</Link> pour réserver.</p>
        ) : (
          <button className="primary" onClick={submit} disabled={selected.size === 0 || reserve.isPending}>
            {reserve.isPending ? "Réservation…" : `Bloquer ces places (10 min)`}
          </button>
        )}
        {message && <p role="alert" className="error">{message}</p>}
      </div>

      {user && <WaitlistPanel eventId={eventId} soldOut={soldOut} />}
      <div className="sr-only" aria-live="polite">{announce}</div>
    </section>
  );
}
