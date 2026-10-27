import { useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useFetch } from "../../format";
import { Banner, Empty, Page } from "../../ui";

const SECTIONS = [
  ["technicians", "Técnicos"],
  ["users", "Usuarios"],
  ["brands", "Marcas"],
  ["models", "Modelos"],
  ["machines", "Máquinas"],
  ["spare_parts", "Repuestos"],
];

export default function Audit() {
  const { user } = useAuth();
  const list = useFetch(() => (user?.role === "superadmin" ? api("/api/audit") : Promise.resolve(null)), [user?.role]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && user.role !== "superadmin") return <Navigate to="/app" replace />;

  async function restore(module, id) {
    if (!window.confirm("¿Restaurar este registro?")) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/audit/restore", { method: "POST", body: { module, id } });
      list.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const total = SECTIONS.reduce((sum, [key]) => sum + (list.data?.[key]?.length || 0), 0);

  return (
    <Page title="Auditoría" lede="Lo que se archivó en los módulos. Desde aquí se puede volver a dejar activo.">
      <Banner>{error || list.error}</Banner>
      {list.loading && <p>Cargando…</p>}
      {!list.loading && total === 0 && <Empty title="No hay archivados" text="Cuando se archive un técnico, una marca, un modelo, una máquina, un repuesto o un usuario, aparecerá aquí." />}
      {SECTIONS.map(([key, title]) => {
        const rows = list.data?.[key] || [];
        if (!rows.length) return null;
        return (
          <section key={key} className="card">
            <h2>{title}</h2>
            {rows.map((row) => (
              <div key={row.id} className="job" style={{ marginTop: 10 }}>
                <div>
                  <strong>{row.label}</strong>
                  {row.detail ? <p className="muted">{row.detail}</p> : null}
                </div>
                <button type="button" className="btn small" disabled={busy} onClick={() => restore(key, row.id)}>Restaurar</button>
              </div>
            ))}
          </section>
        );
      })}
    </Page>
  );
}
