import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Banner, Field } from "../ui";

export default function Login() {
  const { user, ready, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to={user.role === "tecnico" ? "/tecnico" : "/app"} replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand-mark">AT</div>
        <h1>Área técnica</h1>
        <p className="lede">Inspección de reefers de segundo uso.</p>
        <Banner>{error}</Banner>
        <Field label="Usuario">
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </Field>
        <Field label="Contraseña">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <button className="btn block" disabled={busy} type="submit">
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
