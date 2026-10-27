import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatDateTime, formatDuration, useFetch } from "../../format";
import { Banner, Combo, Empty, Page, Pill } from "../../ui";

export default function Assignments() {
  const active = useFetch(() => api("/api/assignments?scope=activas"), []);
  const history = useFetch(() => api("/api/assignments?scope=historial"), []);
  const machines = useFetch(() => api("/api/machines"), []);
  const technicians = useFetch(() => api("/api/technicians"), []);
  const [machineId, setMachineId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const free = machines.data?.filter((machine) => !machine.archived && !machine.active_assignment) || [];

  async function assign(event) {
    event.preventDefault();
    if (!machineId || !technicianId) {
      setError("Elige la serie y el técnico de la lista.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/assignments", {
        method: "POST",
        body: { machine_id: Number(machineId), technician_id: Number(technicianId) },
      });
      setMachineId("");
      setTechnicianId("");
      active.reload();
      machines.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(row) {
    if (!window.confirm(`¿Cancelar la asignación de ${row.serial}?`)) return;
    setError("");
    try {
      await api(`/api/assignments/${row.id}/cancel`, { method: "POST" });
      active.reload();
      history.reload();
      machines.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Page title="Asignaciones" lede="Elige un técnico de la lista para revisar una máquina por su serie.">
      <Banner>{error || active.error}</Banner>
      <form className="card" onSubmit={assign}>
        <div className="split">
          <Combo
            label="Máquina libre"
            placeholder="Escribe la serie"
            options={free.map((machine) => ({
              value: machine.id,
              label: `${machine.serial} ${machine.brand_name} ${machine.model_name}`,
              serial: machine.serial,
              hint: `${machine.brand_name} ${machine.model_name}`,
            }))}
            value={machineId}
            onChange={setMachineId}
          />
          <Combo
            label="Técnico"
            placeholder="Escribe el nombre"
            options={(technicians.data || [])
              .filter((tech) => !tech.archived)
              .map((tech) => ({ value: tech.id, label: tech.name }))}
            value={technicianId}
            onChange={setTechnicianId}
          />
        </div>
        <button className="btn" disabled={busy} type="submit">{busy ? "Asignando…" : "Asignar"}</button>
      </form>

      <h2>En curso</h2>
      {!active.loading && active.data?.length === 0 && <Empty title="Nadie tiene máquinas abiertas" text="Asigna una serie para que el técnico la vea en su celular." />}
      <div className="stack">
        {active.data?.map((row) => (
          <article key={row.id} className="card">
            <header>
              <div>
                <h2>{row.serial}</h2>
                <p className="muted">{row.brand_name} · {row.model_name}{row.location ? ` · ${row.location}` : ""}</p>
                <p className="muted">{row.technician_name}</p>
                <p className="muted">Asignada {formatDateTime(row.created_at)} · lleva {formatDuration(row.created_at)}</p>
              </div>
              <Pill value={row.status} />
            </header>
            <div className="actions">
              {row.inspection_id && <Link className="btn ghost small" to={`/app/inspecciones/${row.inspection_id}`}>Ver inspección</Link>}
              {row.status === "pendiente" && <button type="button" className="btn danger small" onClick={() => cancel(row)}>Cancelar</button>}
            </div>
          </article>
        ))}
      </div>

      <h2>Historial reciente</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Serie</th><th>Técnico</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>
            {history.data?.map((row) => (
              <tr key={row.id}>
                <td data-label="Serie">{row.inspection_id ? <Link to={`/app/inspecciones/${row.inspection_id}`}>{row.serial}</Link> : row.serial}</td>
                <td data-label="Técnico">{row.technician_name}</td>
                <td data-label="Estado"><Pill value={row.status} /></td>
                <td data-label="Fecha">{formatDateTime(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
