import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelOrder, fetchOrder, payOrder } from "../../api/orders";
import { formatPrice } from "../../components/format";
import { useCountdown } from "./useCountdown";

export function OrderPage() {
  const orderId = Number(useParams().orderId);
  const qc = useQueryClient();
  const [paymentSent, setPaymentSent] = useState(false);
  const [announce, setAnnounce] = useState("");

  const { data: order, status, error } = useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => fetchOrder(orderId),
    // Tant que la commande est "pending", on interroge toutes les 2 s :
    // le webhook arrive entre 1 et 15 s plus tard, de façon asynchrone.
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 2000 : false),
  });

  const clockOffset = useMemo(
    () => (order ? Date.parse(order.serverTime) - Date.now() : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order?.serverTime],
  );
  const { label, seconds } = useCountdown(order?.expiresAt, clockOffset);
  const pending = order?.status === "pending";

  // Annonces lecteur d'écran uniquement aux moments clés (pas à chaque seconde).
  useEffect(() => {
    if (!pending) return;
    if (seconds === 60) setAnnounce("Votre réservation expire dans 1 minute.");
    if (seconds === 0) setAnnounce("Votre réservation a expiré.");
  }, [seconds, pending]);

  // Le délai est écoulé côté client : on demande confirmation au serveur (source de vérité).
  useEffect(() => {
    if (pending && seconds === 0) qc.invalidateQueries({ queryKey: ["orders", orderId] });
  }, [pending, seconds, qc, orderId]);

  const pay = useMutation({ mutationFn: () => payOrder(orderId), onSuccess: () => setPaymentSent(true) });
  const cancel = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", orderId] }),
  });

  if (status === "pending") return <p role="status" aria-busy="true">Chargement de la commande…</p>;
  if (status === "error") return <p role="alert">Erreur : {error.message}</p>;

  return (
    <section className="card">
      <h1>Commande n°{order.id}</h1>
      <p>{order.eventTitle}</p>
      <ul>
        {order.seats.map((s) => (
          <li key={s.id}>Rangée {s.row}, siège {s.number} — {formatPrice(s.priceCents)}</li>
        ))}
      </ul>
      <p><strong>Total : {formatPrice(order.totalCents)}</strong></p>

      {order.status === "pending" && (
        <>
          <p className="countdown" aria-hidden="true">Temps restant : <strong>{label}</strong></p>
          {paymentSent ? (
            <p role="status">Paiement en cours de traitement… (cela peut prendre jusqu'à 15 secondes)</p>
          ) : (
            <div className="actions">
              <button className="primary" onClick={() => pay.mutate()} disabled={pay.isPending}>Payer</button>
              <button onClick={() => cancel.mutate()} disabled={cancel.isPending}>Annuler</button>
            </div>
          )}
          {(pay.isError || cancel.isError) && (
            <p role="alert">{(pay.error ?? cancel.error)?.message}</p>
          )}
        </>
      )}
      {order.status === "paid" && <p role="status" className="banner ok">✅ Paiement confirmé. Vos places sont à vous !</p>}
      {order.status === "expired" && <p role="alert" className="banner">⌛ La réservation a expiré, les sièges ont été libérés.</p>}
      {order.status === "cancelled" && <p role="status" className="banner">Commande annulée.</p>}
      {order.status === "refunded" && (
        <p role="alert" className="banner">
          Votre paiement est arrivé après l'expiration de la réservation : il a été remboursé.
        </p>
      )}

      <div className="sr-only" aria-live="polite">{announce}</div>
      <p><Link to={`/events/${order.eventId}`}>← Retour au plan de salle</Link></p>
    </section>
  );
}
