import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useFetch } from "../../format";
import { Banner, Page } from "../../ui";

export default function Conditions() {
  const { user } = useAuth();
  const list = useFetch(() => api("/api/conditions"), []);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!list.data) return;
    setDraft(Object.fromEntries(list.data.map((row) => [row.key, row.label])));
  }, [list.data]);

  if (user && user.role !== "superadmin") return <Navigate to="/app" replace />;

  async function save(key) {
    const label = (draft[key] || "").trim();
    if (label.length < 2) {
      setError("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await api(`/api/conditions/${key}`, { method: "PATCH", body: { label } });
      setMessage("Nombre actualizado.");
      list.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <Page title="Condiciones" lede="Estas tres opciones aparecen al anotar un repuesto. Puedes cambiar el nombre que ve el técnico.">
      <Banner>{error || list.error}</Banner>
      <Banner kind="ok">{message}</Banner>
      <div className="stack">
        {(list.data || []).map((row) => (
          <article key={row.key} className="card">
            <form className="filters" onSubmit={(event) => { event.preventDefault(); save(row.key); }}>
              <label className="field">
                <span>Nombre visible</span>
                <input value={draft[row.key] ?? row.label} onChange={(event) => setDraft({ ...draft, [row.key]: event.target.value })} maxLength={40} required />
              </label>
              <button className="btn" type="submit" disabled={busy === row.key}>{busy === row.key ? "Guardando…" : "Guardar"}</button>
            </form>
          </article>
        ))}
      </div>
    </Page>
  );
}
