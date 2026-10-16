import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEvent } from "../../api/events";
import { fetchPendingOrders } from "../../api/orders";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { formatDate, formatPrice } from "../../components/format";
import { Skeleton } from "../../components/Skeleton";
import type { Seat, SocketMessage } from "../../types/domain";
import { SeatMap } from "./SeatMap";
import { useSeats } from "./useSeats";
import { useSeatSocket } from "./useSeatSocket";
import { useReserveSeats } from "./useReserveSeats";
import { WaitlistPanel, waitlistKey } from "./WaitlistPanel";

const MAX_SEATS = 6;
const SOCKET_TEXT = { open: "Temps réel actif", connecting: "Connexion…", reconnecting: "Reconnexion…" } as const;

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
        setMessage("Un siège que vous aviez choisi vient d'être pris par quelqu'un d'autre.");
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

  const unselect = (id: number) => setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });

  const submit = () => {
    setMessage(null);
    reserve.mutate([...selected], {
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
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Chargement du plan de salle…</span>
        <Skeleton h={34} w="40%" /><div style={{ height: 16 }} /><Skeleton h={420} />
      </div>
    );
  if (eventQ.status === "error" || seatsQ.status === "error") {
    return (
      <div role="alert" className="banner err">
        <p>Impossible de charger l'événement.</p>
        <button onClick={() => { eventQ.refetch(); seatsQ.refetch(); }}>Réessayer</button>
      </div>
    );
  }
  if (!seats || seats.length === 0) return <p className="card empty">Cet événement n'a pas encore de plan de salle.</p>;

  const selectedSeats = [...selected].map((id) => seats.find((s) => s.id === id)).filter((s): s is Seat => Boolean(s));
  const total = selectedSeats.reduce((sum, s) => sum + (priceOf.get(s.categoryId) ?? 0), 0);
  const soldOut = !seats.some((s) => s.status === "available");
  const pendingOrder = pendingQ.data?.[0];

  return (
    <section>
      <p style={{ margin: 0 }}><Link to="/">← Tous les événements</Link></p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1>{event!.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            <time dateTime={event!.startsAt}>{formatDate(event!.startsAt)}</time> · 📍 {event!.venue}
          </p>
        </div>
        <span className={`live live-${socketState}`} role="status"><i />{SOCKET_TEXT[socketState]}</span>
      </div>

      {socketState === "reconnecting" && (
        <p role="alert" className="banner warn">Connexion perdue : le plan peut être obsolète. Reconnexion en cours…</p>
      )}
      {pendingOrder && (
        <p className="banner">Vous avez déjà une réservation en cours.
          <Link className="btn" to={`/orders/${pendingOrder.id}`}>La reprendre</Link></p>
      )}

      <div className="seat-layout" style={{ marginTop: "1rem" }}>
        <div className="card mapcard">
          <SeatMap seats={seats} categories={event!.categories} selected={selected} onToggle={toggle} />
          <ul className="legend" aria-label="Légende">
            {event!.categories.map((c, i) => (
              <li key={c.id}><span className={`swatch cat-${i % 6}`} />{c.name} · {formatPrice(c.priceCents)}</li>
            ))}
            <li>✓ sélectionné</li><li>★ à vous</li><li>⏳ en cours de réservation</li><li>✕ vendu</li>
          </ul>
        </div>

        <aside className="card summary" aria-label="Récapitulatif">
          <h2>Votre sélection <span className="pill ok">{selected.size}/{MAX_SEATS}</span></h2>
          {selectedSeats.length === 0 ? (
            <p className="empty">Cliquez sur un siège libre pour le sélectionner. Navigation possible aux flèches du clavier.</p>
          ) : (
            <ul className="chips">
              {selectedSeats.map((s) => (
                <li className="chip" key={s.id}>
                  <span>Rang {s.row} · siège {s.number}</span>
                  <span>{formatPrice(priceOf.get(s.categoryId) ?? 0)}
                    {" "}<button aria-label={`Retirer le siège ${s.row}${s.number}`} onClick={() => unselect(s.id)}>×</button></span>
                </li>
              ))}
            </ul>
          )}
          <div className="total"><span>Total</span><strong>{formatPrice(total)}</strong></div>

          {!user ? (
            <Link className="btn primary block" to="/login">Connectez-vous pour réserver</Link>
          ) : (
            <button className="primary block" onClick={submit} disabled={selected.size === 0 || reserve.isPending}>
              {reserve.isPending ? "Réservation…" : "Bloquer ces places (10 min)"}
            </button>
          )}
          {message && <p role="alert" className="error" style={{ margin: 0 }}>{message}</p>}
          {user && <WaitlistPanel eventId={eventId} soldOut={soldOut} />}
        </aside>
      </div>
      <div className="sr-only" aria-live="polite">{announce}</div>
    </section>
  );
}
