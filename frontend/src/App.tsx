import { Link, Route, Routes } from "react-router-dom";
import { RequireRole } from "./components/RequireRole";
import { SiteLayout } from "./components/SiteLayout";
import { HomePage } from "./features/home/HomePage";
import { EventsPage } from "./features/events/EventsPage";
import { SeatPage } from "./features/seats/SeatPage";
import { OrderPage } from "./features/orders/OrderPage";
import { MyOrdersPage } from "./features/orders/MyOrdersPage";
import { AccountPage } from "./features/account/AccountPage";
import { AuthPage } from "./features/auth/AuthPage";
import { BackofficeLayout } from "./features/backoffice/BackofficeLayout";
import { DashboardPage } from "./features/backoffice/DashboardPage";
import { BackofficeEventsPage } from "./features/backoffice/BackofficeEventsPage";
import { CreateEventPage } from "./features/backoffice/CreateEventPage";
import { AuditPage } from "./features/backoffice/AuditPage";

const ANY = ["customer", "organizer", "admin"] as const;
const STAFF = ["organizer", "admin"] as const;

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<SeatPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        <Route path="/orders/:orderId" element={<RequireRole roles={[...ANY]}><OrderPage /></RequireRole>} />
        <Route path="/my-orders" element={<RequireRole roles={[...ANY]}><MyOrdersPage /></RequireRole>} />
        <Route path="/account" element={<RequireRole roles={[...ANY]}><AccountPage /></RequireRole>} />

        <Route path="/backoffice" element={<RequireRole roles={[...STAFF]}><BackofficeLayout /></RequireRole>}>
          <Route index element={<DashboardPage />} />
          <Route path="events" element={<BackofficeEventsPage />} />
          <Route path="events/new" element={<CreateEventPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>

        <Route path="*" element={<p className="card empty">Page introuvable. <Link to="/">Retour à l'accueil</Link></p>} />
      </Route>
    </Routes>
  );
}
