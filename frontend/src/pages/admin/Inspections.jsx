import { useState } from "react";
import { Link } from "react-router-dom";
import { api, download } from "../../api";
import { WORK_STATUS_LABEL, formatDuration, inspectionStateLabel, todayInput, useFetch } from "../../format";
import { Banner, Empty, Page, Pill } from "../../ui";

const STATUSES = [
  ["programado", "Programado"],
  ["en_proceso", "En proceso"],
  ["reparado", "Reparado"],
  ["sin_accion", "Sin acción"],
  ["sin_definir", "Sin definir"],
];

export default function Inspections() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const list = useFetch(
    () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      if (from) params.set("date_from", from);
      if (to) params.set("date_to", to);
      return api(`/api/inspections?${params.toString()}`);
    },
    [query, status, from, to],
  );

  function params() {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (status) search.set("status", status);
    if (from) search.set("date_from", from);
    if (to) search.set("date_to", to);
    return search;
  }

  async function exportExcel() {
    setExporting(true);
    setExportError("");
    try {
      const search = params().toString();
      await download(`/api/inspections/export${search ? `?${search}` : ""}`, "inspecciones.xlsx");
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Page
      title="Inspecciones"
      lede="El técnico cierra la inspección. El status —programado, en proceso, reparado o sin acción— se decide después."
      action={<button type="button" className="btn ghost" disabled={exporting} onClick={exportExcel}>{exporting ? "Exportando…" : "Excel"}</button>}
    >
      <Banner>{list.error || exportError}</Banner>
      <form className="filters" onSubmit={(event) => { event.preventDefault(); setQuery(q.trim()); }}>
        <input value={q} placeholder="Serie o ubicación" onChange={(event) => setQ(event.target.value)} />
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
          <option value="">Todos</option>
          {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input type="date" value={from} max={todayInput()} onChange={(event) => setFrom(event.target.value)} />
        <input type="date" value={to} max={todayInput()} onChange={(event) => setTo(event.target.value)} />
        <button className="btn ghost" type="submit">Buscar</button>
      </form>
      {list.loading && <p>Cargando…</p>}
      {!list.loading && list.data?.length === 0 && <Empty title="Sin inspecciones" text="Aparecen cuando un técnico abre una máquina asignada." />}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Serie</th>
              <th>Equipo</th>
              <th>Técnico supervisor</th>
              <th>Técnico</th>
              <th>Estado de inspección</th>
              <th>Status</th>
              <th>Repuestos</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((row) => (
              <tr key={row.id}>
                <td data-label="Serie"><Link to={`/app/inspecciones/${row.id}`}>{row.serial}</Link></td>
                <td data-label="Equipo">{row.brand} {row.model}</td>
                <td data-label="Técnico supervisor">{row.technician_name}</td>
                <td data-label="Técnico">{row.assigned_technician_name || "Sin asignar"}</td>
                <td data-label="Estado de inspección">
                  <Pill value={row.status} label={inspectionStateLabel(row.status)} />
                </td>
                <td data-label="Status">
                  <Pill value={row.work_status || "sin_definir"} label={WORK_STATUS_LABEL[row.work_status] || "—"} />
                </td>
                <td data-label="Repuestos">{row.items_count}</td>
                <td data-label="Tiempo">{formatDuration(row.assigned_at, row.completed_at)}{row.completed_at ? "" : " · en curso"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
