import { useAuth } from "../../auth/AuthContext";

const ROLE_LABEL = { customer: "Client", organizer: "Organisateur", admin: "Administrateur" } as const;

export function AccountPage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <section aria-labelledby="account-title">
      <div className="page-head"><h1 id="account-title">Mon compte</h1></div>
      <div className="card profile">
        <span className="avatar big" aria-hidden="true">{user.username[0].toUpperCase()}</span>
        <dl>
          <dt>Nom d'utilisateur</dt><dd>{user.username}</dd>
          <dt>E-mail</dt><dd>{user.email || "—"}</dd>
          <dt>Rôle</dt><dd><span className="pill ok">{ROLE_LABEL[user.role]}</span></dd>
        </dl>
        <button onClick={logout}>Se déconnecter</button>
      </div>
    </section>
  );
}
