import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchBackofficeEvents } from "../../api/backoffice";
import { formatDate } from "../../components/format";

export function BackofficeEventsPage() {
  const { data, status, error, refetch } = useQuery({ queryKey: ["backoffice", "events"], queryFn: fetchBackofficeEvents });

  return (
    <section aria-labelledby="bo-events-title">
      <div className="section-head">
        <h1 id="bo-events-title">Mes événements</h1>
        <Link className="btn primary" to="/backoffice/events/new">+ Créer un événement</Link>
      </div>
      {status === "pending" && <p role="status" aria-busy="true" className="muted">Chargement…</p>}
      {status === "error" && <div role="alert" className="banner err"><p>{error.message}</p><button onClick={() => refetch()}>Réessayer</button></div>}
      {status === "success" && data.length === 0 && <p className="card empty">Aucun événement. Créez le premier !</p>}
      {status === "success" && data.length > 0 && (
        <div className="card tablewrap">
          <table>
            <caption className="sr-only">Liste de vos événements</caption>
            <thead><tr><th scope="col">Événement</th><th scope="col">Date</th><th scope="col">Lieu</th><th scope="col">Places</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <th scope="row">{e.title}</th>
                  <td>{formatDate(e.startsAt)}</td>
                  <td>{e.venue}</td>
                  <td>{e.availableSeats} libres / {e.totalSeats}</td>
                  <td><Link to={`/events/${e.id}`}>Voir la page publique</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
