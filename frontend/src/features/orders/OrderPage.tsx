import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelOrder, fetchOrder, payOrder } from "../../api/orders";
import { formatPrice } from "../../components/format";
import { Skeleton } from "../../components/Skeleton";
import { useCountdown } from "./useCountdown";

const RADIUS = 48;
const CIRC = 2 * Math.PI * RADIUS;

export function OrderPage() {
  const orderId = Number(useParams().orderId);
  const qc = useQueryClient();
  const [paymentSent, setPaymentSent] = useState(false);
  const [announce, setAnnounce] = useState("");

  const { data: order, status, error } = useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => fetchOrder(orderId),
    // Webhook asynchrone (1 à 15 s) : on interroge toutes les 2 s tant que la commande est "pending".
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 2000 : false),
  });

  const clockOffset = useMemo(
    () => (order ? Date.parse(order.serverTime) - Date.now() : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order?.serverTime],
  );
  const { label, seconds, remainingMs } = useCountdown(order?.expiresAt, clockOffset);
  const pending = order?.status === "pending";

  useEffect(() => {
    if (!pending) return;
    if (seconds === 60) setAnnounce("Votre réservation expire dans 1 minute.");
    if (seconds === 0) setAnnounce("Votre réservation a expiré.");
  }, [seconds, pending]);

  useEffect(() => {
    if (pending && seconds === 0) qc.invalidateQueries({ queryKey: ["orders", orderId] });
  }, [pending, seconds, qc, orderId]);

  const pay = useMutation({ mutationFn: () => payOrder(orderId), onSuccess: () => setPaymentSent(true) });
  const cancel = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", orderId] }),
  });

  if (status === "pending")
    return (
      <div className="card order" role="status" aria-busy="true">
        <span className="sr-only">Chargement de la commande…</span>
        <div className="order-body"><Skeleton h={28} w="60%" /><Skeleton h={90} /><Skeleton h={44} /></div>
      </div>
    );
  if (status === "error") return <p role="alert" className="banner err">Erreur : {error.message}</p>;

  const totalMs = Math.max(1, Date.parse(order.expiresAt) - Date.parse(order.createdAt));
  const progress = Math.min(1, remainingMs / totalMs);
  const urgent = seconds <= 60;

  return (
    <section className="card order">
      <div className="order-head">
        <h1>Commande n°{order.id}</h1>
        <p>{order.eventTitle}</p>
      </div>
      <div className="order-body">
        <ul className="ticket-list">
          {order.seats.map((s) => (
            <li key={s.id}><span>Rang {s.row} · siège {s.number}</span><strong>{formatPrice(s.priceCents)}</strong></li>
          ))}
        </ul>
        <div className="total"><span>Total</span><strong>{formatPrice(order.totalCents)}</strong></div>

        {order.status === "pending" && (
          <>
            <div className="ring-wrap">
              <div className={`ring ${urgent ? "urgent" : ""}`} aria-hidden="true">
                <svg width="112" height="112" viewBox="0 0 112 112">
                  <circle className="track" cx="56" cy="56" r={RADIUS} />
                  <circle className="bar" cx="56" cy="56" r={RADIUS}
                          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} />
                </svg>
                <span className="time">{label}</span>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {urgent ? "Dépêchez-vous, vos sièges vont être libérés !" : "Vos sièges sont réservés pour vous le temps du paiement."}
              </p>
            </div>

            {paymentSent ? (
              <p role="status" className="banner"><span className="spinner" /> Paiement en cours de traitement… (jusqu'à 15 secondes)</p>
            ) : (
              <div className="actions">
                <button className="primary" onClick={() => pay.mutate()} disabled={pay.isPending}>
                  Payer {formatPrice(order.totalCents)}
                </button>
                <button className="ghost" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Annuler</button>
              </div>
            )}
            {(pay.isError || cancel.isError) && <p role="alert" className="error">{(pay.error ?? cancel.error)?.message}</p>}
          </>
        )}

        {order.status === "paid" && (
          <div role="status" className="result"><div className="big">🎉</div><h2>Paiement confirmé</h2><p className="muted">Vos places sont à vous. Bon spectacle !</p></div>
        )}
        {order.status === "expired" && (
          <div role="alert" className="result"><div className="big">⌛</div><h2>Réservation expirée</h2><p className="muted">Les sièges ont été libérés. Vous pouvez en choisir d'autres.</p></div>
        )}
        {order.status === "cancelled" && (
          <div role="status" className="result"><div className="big">🚫</div><h2>Commande annulée</h2></div>
        )}
        {order.status === "refunded" && (
          <div role="alert" className="result"><div className="big">↩️</div><h2>Paiement remboursé</h2>
            <p className="muted">Votre paiement est arrivé après l'expiration de la réservation : il vous a été remboursé.</p></div>
        )}

        <div className="sr-only" aria-live="polite">{announce}</div>
        <Link to={`/events/${order.eventId}`}>← Retour au plan de salle</Link>
      </div>
    </section>
  );
}
