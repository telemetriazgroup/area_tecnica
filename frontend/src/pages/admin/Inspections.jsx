import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatDuration, todayInput, useFetch } from "../../format";
import { Banner, Empty, Page, Pill } from "../../ui";

export default function Inspections() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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

  return (
      <Page title="Inspecciones" lede="El tiempo cuenta desde que se asigna la máquina hasta que el técnico cierra la lista de repuestos.">
      <Banner>{list.error}</Banner>
      <form className="filters" onSubmit={(event) => { event.preventDefault(); setQuery(q.trim()); }}>
        <input value={q} placeholder="Serie o ubicación" onChange={(event) => setQ(event.target.value)} />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos los estados</option>
          <option value="en_proceso">En revisión</option>
          <option value="completada">Revisada</option>
        </select>
        <input type="date" value={from} max={todayInput()} onChange={(event) => setFrom(event.target.value)} />
        <input type="date" value={to} max={todayInput()} onChange={(event) => setTo(event.target.value)} />
        <button className="btn ghost" type="submit">Buscar</button>
      </form>
      {list.loading && <p>Cargando…</p>}
      {!list.loading && list.data?.length === 0 && <Empty title="Sin inspecciones" text="Aparecen cuando un técnico abre una máquina asignada." />}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Serie</th><th>Equipo</th><th>Técnico</th><th>Estado</th><th>Repuestos</th><th>Tiempo</th></tr></thead>
          <tbody>
            {list.data?.map((row) => (
              <tr key={row.id}>
                <td data-label="Serie"><Link to={`/app/inspecciones/${row.id}`}>{row.serial}</Link></td>
                <td data-label="Equipo">{row.brand} {row.model}</td>
                <td data-label="Técnico">{row.technician_name}</td>
                <td data-label="Estado"><Pill value={row.status} /></td>
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
