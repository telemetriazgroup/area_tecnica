import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatDuration, useFetch } from "../../format";
import { Banner, Page, Pill } from "../../ui";

export default function Dashboard() {
  const board = useFetch(() => api("/api/dashboard"), []);
  const data = board.data;

  return (
    <Page
      title="Inicio"
      lede="Lo que el área tiene pendiente hoy."
      action={<Link className="btn" to="/app/asignaciones">Asignar máquina</Link>}
    >
      <Banner>{board.error}</Banner>
      {board.loading && <p>Cargando…</p>}
      {data && (
        <>
          <div className="stats">
            <article className="stat"><strong>{data.pending_assignments}</strong><span>Asignadas</span></article>
            <article className="stat"><strong>{data.in_progress}</strong><span>En revisión</span></article>
            <article className="stat"><strong>{data.unassigned_machines}</strong><span>Libres para asignar</span></article>
            <article className="stat"><strong>{data.inspected_today}</strong><span>Revisadas hoy</span></article>
          </div>
          <p className="muted">Repuestos anotados hoy: {data.parts_today}</p>
          <h2>Últimas inspecciones</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Serie</th><th>Técnico</th><th>Estado</th><th>Repuestos</th><th>Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Serie"><Link to={`/app/inspecciones/${row.id}`}>{row.serial}</Link></td>
                    <td data-label="Técnico">{row.technician_name}</td>
                    <td data-label="Estado"><Pill value={row.status} /></td>
                    <td data-label="Repuestos">{row.items_count}</td>
                    <td data-label="Tiempo">{formatDuration(row.assigned_at, row.completed_at)}{row.completed_at ? "" : " · en curso"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Page>
  );
}
