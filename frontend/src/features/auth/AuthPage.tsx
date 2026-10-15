import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(username, password);
      else await register(username, email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h1>{mode === "login" ? "Connexion" : "Inscription"}</h1>
      <label>Nom d'utilisateur
        <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
      </label>
      {mode === "register" && (
        <label>E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      )}
      <label>Mot de passe
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
               minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="primary" disabled={busy}>{mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
      <p>
        {mode === "login"
          ? <>Pas de compte ? <Link to="/register">S'inscrire</Link></>
          : <>Déjà un compte ? <Link to="/login">Se connecter</Link></>}
      </p>
    </form>
  );
}
