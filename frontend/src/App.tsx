import { Link, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { RequireRole } from "./components/RequireRole";
import { EventList } from "./features/events/EventList";
import { SeatPage } from "./features/seats/SeatPage";
import { OrderPage } from "./features/orders/OrderPage";
import { AuthPage } from "./features/auth/AuthPage";
import { DashboardPage } from "./features/backoffice/DashboardPage";
import { CreateEventPage } from "./features/backoffice/CreateEventPage";

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="header">
      <Link to="/" className="brand">🎭 Billetterie</Link>
      <nav aria-label="Navigation principale">
        {user && (user.role === "organizer" || user.role === "admin") && <Link to="/backoffice">Back-office</Link>}
        {user ? (
          <>
            <span>{user.username} ({user.role})</span>
            <button onClick={logout}>Déconnexion</button>
          </>
        ) : (
          <>
            <Link to="/login">Connexion</Link>
            <Link to="/register">Inscription</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <>
      <a href="#main" className="skip">Aller au contenu</a>
      <Header />
      <main id="main">
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
      </main>
    </>
  );
}
