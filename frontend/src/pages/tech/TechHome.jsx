import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useFetch } from "../../format";
import { Banner, Empty, Pill, TechBar } from "../../ui";

export default function TechHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const jobs = useFetch(() => api("/api/my/jobs"), []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const done = location.state?.done;

  async function openJob(job) {
    setBusy(job.assignment_id);
    setError("");
    try {
      if (job.status === "pendiente") {
        const inspection = await api(`/api/assignments/${job.assignment_id}/start`, { method: "POST" });
        navigate(`/tecnico/inspeccion/${inspection.id}`);
        return;
      }
      navigate(`/tecnico/inspeccion/${job.inspection_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="phone">
      <TechBar
        title="Mis máquinas"
        action={<button type="button" className="text-btn" onClick={logout}>Salir</button>}
      />
      <div className="tech-body">
        <p className="muted">Hola, {user?.full_name}. Elige la reefer asignada.</p>
        <Banner kind="ok">{done ? `Quedó registrada la serie ${done}.` : ""}</Banner>
        <Banner>{error || jobs.error}</Banner>
        {jobs.loading && <p>Cargando máquinas…</p>}
        {!jobs.loading && jobs.data?.length === 0 && (
          <Empty title="Sin máquinas asignadas" text="Cuando el encargado te asigne una reefer, aparecerá aquí." />
        )}
        <div className="stack">
          {jobs.data?.map((job) => (
            <button
              key={job.assignment_id}
              type="button"
              className="job"
              disabled={busy === job.assignment_id}
              onClick={() => openJob(job)}
            >
              <header>
                <strong className="serial-title">{job.serial}</strong>
                <Pill value={job.status} />
              </header>
              <small>{job.brand} · {job.model}</small>
              <small>{job.location || "Sin ubicación"}{job.year ? ` · ${job.year}` : ""}</small>
              <small>{job.items_count ? `${job.items_count} repuestos anotados` : "Sin repuestos anotados"}</small>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
