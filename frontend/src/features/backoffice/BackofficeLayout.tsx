import { NavLink, Outlet } from "react-router-dom";

const cls = ({ isActive }: { isActive: boolean }) => `subitem${isActive ? " active" : ""}`;

export function BackofficeLayout() {
  return (
    <div className="bo">
      <nav className="subnav card" aria-label="Back-office">
        <h2>Espace organisateur</h2>
        <NavLink to="/backoffice" end className={cls}>📊 Tableau de bord</NavLink>
        <NavLink to="/backoffice/events" end className={cls}>🎟️ Mes événements</NavLink>
        <NavLink to="/backoffice/events/new" className={cls}>➕ Créer un événement</NavLink>
        <NavLink to="/backoffice/audit" className={cls}>🧾 Journal d'audit</NavLink>
      </nav>
      <div className="bo-content"><Outlet /></div>
    </div>
  );
}
