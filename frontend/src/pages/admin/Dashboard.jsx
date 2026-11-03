import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { WORK_STATUS_LABEL, formatDuration, formatInputDate, useFetch } from "../../format";
import { Banner, Page, Pill } from "../../ui";

const PERIODS = [
  ["day", "Hoy"],
  ["week", "Semana"],
  ["month", "Mes"],
];

export default function Dashboard() {
  const [period, setPeriod] = useState("day");
  const board = useFetch(() => api(`/api/dashboard?period=${period}`), [period]);
  const data = board.data;
  const range = data?.period_from && data?.period_to
    ? data.period_from === data.period_to
      ? formatInputDate(data.period_from)
      : `${formatInputDate(data.period_from)} – ${formatInputDate(data.period_to)}`
    : "";

  return (
    <Page
      title="Inicio"
      lede="Stock, asignaciones y el avance de las inspecciones."
      action={<Link className="btn" to="/app/asignaciones">Asignar máquina</Link>}
    >
      <Banner>{board.error}</Banner>
      {board.loading && <p>Cargando…</p>}
      {data && (
        <>
          <div className="kpi-head">
            <div>
              <h2>Ahora</h2>
              <p className="muted">Estado actual de las máquinas y de las inspecciones abiertas.</p>
            </div>
          </div>
          <div className="stats">
            <article className="stat"><strong>{data.stock_machines}</strong><span>En stock</span></article>
            <article className="stat"><strong>{data.assigned_machines}</strong><span>Asignadas</span></article>
            <article className="stat"><strong>{data.programmed}</strong><span>Programadas</span></article>
            <article className="stat"><strong>{data.in_process_inspections}</strong><span>En proceso</span></article>
          </div>

          <div className="kpi-head">
            <div>
              <h2>En el período</h2>
              <p className="muted">{range}</p>
            </div>
            <div className="period-switch">
              {PERIODS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={period === id ? "btn small" : "btn ghost small"}
                  onClick={() => setPeriod(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="stats">
            <article className="stat"><strong>{data.inspections_in_period}</strong><span>Inspecciones iniciadas</span></article>
            <article className="stat"><strong>{data.repaired_in_period}</strong><span>Reparadas</span></article>
            <article className="stat"><strong>{data.parts_in_period}</strong><span>Piezas pedidas</span></article>
            <article className="stat"><strong>{data.follows_in_period}</strong><span>Seguimientos</span></article>
          </div>
          {data.parts_by_condition?.length > 0 && (
            <p className="muted">
              {data.parts_by_condition.map((item) => `${item.label}: ${item.quantity}`).join(" · ")}
            </p>
          )}

          <h2>Últimas inspecciones</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Serie</th><th>Técnico supervisor</th><th>Técnico</th><th>Estado de inspección</th><th>Repuestos</th><th>Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Serie"><Link to={`/app/inspecciones/${row.id}`}>{row.serial}</Link></td>
                    <td data-label="Técnico supervisor">{row.technician_name}</td>
                    <td data-label="Técnico">{row.assigned_technician_name || "Sin asignar"}</td>
                    <td data-label="Estado de inspección"><Pill value={row.work_status} label={WORK_STATUS_LABEL[row.work_status]} /></td>
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
