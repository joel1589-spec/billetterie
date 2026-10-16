import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { RequireRole } from "./components/RequireRole";
import { EventList } from "./features/events/EventList";
import { SeatPage } from "./features/seats/SeatPage";
import { OrderPage } from "./features/orders/OrderPage";
import { AuthPage } from "./features/auth/AuthPage";
import { DashboardPage } from "./features/backoffice/DashboardPage";
import { CreateEventPage } from "./features/backoffice/CreateEventPage";

const ROLE_LABEL = { customer: "Client", organizer: "Organisateur", admin: "Admin" } as const;

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="header">
      <Link to="/" className="brand"><span className="logo" aria-hidden="true">🎭</span>Billetterie</Link>
      <nav aria-label="Navigation principale">
        {user && (user.role === "organizer" || user.role === "admin") && (
          <Link className="navlink" to="/backoffice">Back-office</Link>
        )}
        {user ? (
          <>
            <span className="userchip">
              <span className="avatar" aria-hidden="true">{user.username[0].toUpperCase()}</span>
              <span>{user.username} <span className="role">· {ROLE_LABEL[user.role]}</span></span>
            </span>
            <button className="ghost" onClick={logout}>Déconnexion</button>
          </>
        ) : (
          <>
            <Link className="navlink" to="/login">Connexion</Link>
            <Link className="btn primary" to="/register">Inscription</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <a href="#main" className="skip">Aller au contenu</a>
      <Header />
      <main id="main">
        {/* key = pathname : l'animation d'entrée rejoue à chaque changement de page */}
        <div className="page" key={pathname}>
          <Routes>
            <Route path="/" element={<EventList />} />
            <Route path="/events/:eventId" element={<SeatPage />} />
            <Route path="/orders/:orderId" element={<OrderPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/backoffice" element={<RequireRole roles={["organizer", "admin"]}><DashboardPage /></RequireRole>} />
            <Route path="/backoffice/new" element={<RequireRole roles={["organizer", "admin"]}><CreateEventPage /></RequireRole>} />
            <Route path="*" element={<p>Page introuvable. <Link to="/">Retour</Link></p>} />
          </Routes>
        </div>
      </main>
    </>
  );
}
