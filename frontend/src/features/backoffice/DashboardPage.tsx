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

  if (status === "pending") return <p role="status" aria-busy="true">Chargement du tableau de bord…</p>;
  if (status === "error")
    return (
      <div role="alert">
        <p>Erreur : {error.message}</p>
        <button onClick={() => refetch()}>Réessayer</button>
      </div>
    );

  return (
    <section>
      <h1>Tableau de bord</h1>
      <p><Link className="btn" to="/backoffice/new">+ Créer un événement</Link></p>
      {data.length === 0 ? (
        <p>Aucun événement. Créez le premier !</p>
      ) : (
        <div className="tablewrap">
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
                  <td>{(r.fillRate * 100).toFixed(1)} %</td>
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
