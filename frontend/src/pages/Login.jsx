import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { BASE } from "../api";
import { useAuth } from "../auth";
import { Banner, Field } from "../ui";

function Welcome({ name }) {
  return (
    <main className="login-screen">
      <div className="welcome">
        <img className="login-logo" src={`${BASE}/logo.png`} alt="ZGROUP" />
        <img className="loader-gif" src={`${BASE}/loading.gif`} alt="" />
        <h1>{name ? `Hola, ${name}` : "Entrando…"}</h1>
        <p>{name ? "Abriendo tu espacio de trabajo." : "Comprobando la cuenta."}</p>
      </div>
    </main>
  );
}

export default function Login() {
  const { user, ready, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("idle");
  const [helloName, setHelloName] = useState("");

  useEffect(() => {
    if (phase !== "hello") return undefined;
    const timer = setTimeout(() => setPhase("enter"), 1600);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "enter" && user) return <Navigate to={user.role === "tecnico" ? "/tecnico" : "/app"} replace />;
  if (phase === "loading" || phase === "hello") return <Welcome name={phase === "hello" ? helloName : ""} />;
  if (phase === "idle" && ready && user) return <Navigate to={user.role === "tecnico" ? "/tecnico" : "/app"} replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setPhase("loading");
    setError("");
    try {
      const logged = await login(username, password);
      setHelloName(logged.full_name);
      setPhase("hello");
    } catch (err) {
      setError(err.message);
      setPhase("idle");
    }
  }

  return (
    <main className="login-screen">
      <div className="login-wrap">
        <img className="login-logo" src={`${BASE}/logo.png`} alt="ZGROUP" />
        <form className="login-card" onSubmit={onSubmit}>
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
        <button className="btn block" type="submit">Entrar</button>
        </form>
      </div>
    </main>
  );
}
