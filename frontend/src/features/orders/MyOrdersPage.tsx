import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMyOrders } from "../../api/orders";
import { formatDateTime, formatPrice } from "../../components/format";
import { Skeleton } from "../../components/Skeleton";
import type { OrderStatus } from "../../types/domain";

export const STATUS_UI: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: "En attente de paiement", cls: "warn" },
  paid: { label: "Payée", cls: "ok" },
  expired: { label: "Expirée", cls: "err" },
  cancelled: { label: "Annulée", cls: "err" },
  refunded: { label: "Remboursée", cls: "warn" },
};

export function MyOrdersPage() {
  const { data, status, error, refetch } = useQuery({ queryKey: ["orders", "mine"], queryFn: fetchMyOrders });

  return (
    <section aria-labelledby="orders-title">
      <div className="page-head"><h1 id="orders-title">Mes réservations</h1><p className="muted">Historique de vos commandes.</p></div>

      {status === "pending" && <div role="status" aria-busy="true" style={{ display: "grid", gap: ".75rem" }}>
        <span className="sr-only">Chargement…</span><Skeleton h={84} /><Skeleton h={84} /></div>}
      {status === "error" && (
        <div role="alert" className="banner err"><p>Erreur : {error.message}</p><button onClick={() => refetch()}>Réessayer</button></div>
      )}
      {status === "success" && data.length === 0 && (
        <div className="card empty"><p><strong>Vous n'avez pas encore de réservation.</strong></p>
          <Link className="btn primary" to="/events">Découvrir les événements</Link></div>
      )}
      {status === "success" && data.length > 0 && (
        <ul className="orderlist">
          {data.map((o) => (
            <li key={o.id} className="card orderrow">
              <div>
                <h2>{o.eventTitle}</h2>
                <p className="muted">Commande n°{o.id} · {formatDateTime(o.createdAt)} · {o.seats.length} place{o.seats.length > 1 ? "s" : ""}</p>
              </div>
              <span className={`pill ${STATUS_UI[o.status].cls}`}>{STATUS_UI[o.status].label}</span>
              <strong>{formatPrice(o.totalCents)}</strong>
              <Link className={`btn ${o.status === "pending" ? "primary" : ""}`} to={`/orders/${o.id}`}>
                {o.status === "pending" ? "Finaliser" : "Détails"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
