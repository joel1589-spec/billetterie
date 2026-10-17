import { useQuery } from "@tanstack/react-query";
import { fetchAudit } from "../../api/backoffice";
import { formatDateTime } from "../../components/format";

export function AuditPage() {
  const { data, status, error, refetch } = useQuery({ queryKey: ["backoffice", "audit"], queryFn: fetchAudit, refetchInterval: 15_000 });

  return (
    <section aria-labelledby="audit-title">
      <div className="section-head"><h1 id="audit-title">Journal d'audit</h1></div>
      <p className="muted">Les 200 dernières actions sensibles (réservations, paiements, expirations, création d'événements…).</p>
      {status === "pending" && <p role="status" aria-busy="true" className="muted">Chargement…</p>}
      {status === "error" && <div role="alert" className="banner err"><p>{error.message}</p><button onClick={() => refetch()}>Réessayer</button></div>}
      {status === "success" && data.length === 0 && <p className="card empty">Aucune action enregistrée.</p>}
      {status === "success" && data.length > 0 && (
        <div className="card tablewrap">
          <table>
            <caption className="sr-only">Journal d'audit</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Acteur</th><th scope="col">Action</th><th scope="col">Cible</th><th scope="col">Détails</th></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>{formatDateTime(a.createdAt)}</td>
                  <td>{a.actor}</td>
                  <td><code>{a.action}</code></td>
                  <td>{a.targetType} {a.targetId ?? ""}</td>
                  <td className="meta"><code>{JSON.stringify(a.metadata)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
