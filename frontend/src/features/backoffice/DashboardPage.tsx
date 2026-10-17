import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../../api/backoffice";
import { formatPrice } from "../../components/format";

export function DashboardPage() {
  const { data, status, error, refetch } = useQuery({
    queryKey: ["backoffice", "dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 10_000,
  });

  if (status === "pending") return <p role="status" aria-busy="true" className="muted">Chargement du tableau de bord…</p>;
  if (status === "error")
    return (
      <div role="alert" className="banner err">
        <p>Erreur : {error.message}</p>
        <button onClick={() => refetch()}>Réessayer</button>
      </div>
    );

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: ".75rem" }}>
        <h1>Tableau de bord</h1>
        <Link className="btn primary" to="/backoffice/events/new">+ Créer un événement</Link>
      </div>
      <div className="stats">
        <div className="card stat"><span>Chiffre d'affaires</span><strong>{formatPrice(data.reduce((s, r) => s + r.revenueCents, 0))}</strong></div>
        <div className="card stat"><span>Places vendues</span><strong>{data.reduce((s, r) => s + r.soldSeats, 0)}</strong></div>
        <div className="card stat"><span>Réservations en cours</span><strong>{data.reduce((s, r) => s + r.pendingOrders, 0)}</strong></div>
        <div className="card stat"><span>Réservations expirées</span><strong>{data.reduce((s, r) => s + r.expiredOrders, 0)}</strong></div>
      </div>
      {data.length === 0 ? (
        <p className="card empty">Aucun événement. Créez le premier !</p>
      ) : (
        <div className="card tablewrap">
          <table>
            <caption className="sr-only">Statistiques par événement</caption>
            <thead>
              <tr>
                <th scope="col">Événement</th><th scope="col">Remplissage</th><th scope="col">Vendus</th>
                <th scope="col">Bloqués</th><th scope="col">Chiffre d'affaires</th>
                <th scope="col">Réservations expirées</th><th scope="col">Remboursées</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.eventId}>
                  <th scope="row">{r.title}</th>
                  <td><div className="fillcell"><div className="meter" aria-hidden="true"><i style={{ width: `${r.fillRate * 100}%` }} /></div>{(r.fillRate * 100).toFixed(1)} %</div></td>
                  <td>{r.soldSeats} / {r.totalSeats}</td>
                  <td>{r.heldSeats}</td>
                  <td>{formatPrice(r.revenueCents)}</td>
                  <td>{r.expiredOrders}</td>
                  <td>{r.refundedOrders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
