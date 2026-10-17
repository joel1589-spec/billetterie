import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const ROLE_LABEL = { customer: "Client", organizer: "Organisateur", admin: "Admin" } as const;

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!user) return null;
  const isStaff = user.role === "organizer" || user.role === "admin";
  return (
    <div className="usermenu" ref={ref}>
      <button className="userchip" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{user.username[0].toUpperCase()}</span>
        <span className="uname">{user.username}</span><span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="dropdown" role="menu" onClick={() => setOpen(false)}>
          <div className="dropdown-head"><strong>{user.username}</strong><span className="muted">{ROLE_LABEL[user.role]}</span></div>
          <Link role="menuitem" to="/account">Mon compte</Link>
          <Link role="menuitem" to="/my-orders">Mes réservations</Link>
          {isStaff && <Link role="menuitem" to="/backoffice">Back-office</Link>}
          <button role="menuitem" onClick={logout}>Déconnexion</button>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  const isStaff = user && (user.role === "organizer" || user.role === "admin");
  const cls = ({ isActive }: { isActive: boolean }) => `navlink${isActive ? " active" : ""}`;

  return (
    <header className="header">
      <Link to="/" className="brand"><span className="logo" aria-hidden="true">🎭</span>Billetterie</Link>
      <button className="burger" aria-label="Menu" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen((o) => !o)}>
        {menuOpen ? "✕" : "☰"}
      </button>
      <nav id="main-nav" className={`mainnav${menuOpen ? " open" : ""}`} aria-label="Navigation principale">
        <NavLink to="/" end className={cls}>Accueil</NavLink>
        <NavLink to="/events" className={cls}>Événements</NavLink>
        {user && <NavLink to="/my-orders" className={cls}>Mes réservations</NavLink>}
        {isStaff && <NavLink to="/backoffice" className={cls}>Back-office</NavLink>}
      </nav>
      <div className="headright">
        {user ? <UserMenu /> : (
          <>
            <Link className="navlink" to="/login">Connexion</Link>
            <Link className="btn primary" to="/register">Créer un compte</Link>
          </>
        )}
      </div>
    </header>
  );
}

function Footer() {
  const { user } = useAuth();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Link to="/" className="brand"><span className="logo" aria-hidden="true">🎭</span>Billetterie</Link>
          <p className="muted">La billetterie en ligne qui ne vend jamais deux fois la même place.</p>
        </div>
        <nav aria-label="Découvrir"><h2>Découvrir</h2><Link to="/">Accueil</Link><Link to="/events">Tous les événements</Link></nav>
        <nav aria-label="Compte"><h2>Mon espace</h2>
          {user ? <><Link to="/my-orders">Mes réservations</Link><Link to="/account">Mon compte</Link></>
                : <><Link to="/login">Connexion</Link><Link to="/register">Inscription</Link></>}
        </nav>
        <nav aria-label="Organisateurs"><h2>Organisateurs</h2><Link to="/backoffice">Espace organisateur</Link></nav>
      </div>
      <p className="footer-legal muted">© 2026 Billetterie · Mentions légales · CGV · Confidentialité</p>
    </footer>
  );
}

export function SiteLayout() {
  const { pathname } = useLocation();
  return (
    <>
      <a href="#main" className="skip">Aller au contenu</a>
      <Header />
      <main id="main">
        <div className="page" key={pathname}><Outlet /></div>
      </main>
      <Footer />
    </>
  );
}
