import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatDateTime, formatDuration, formatInputDate, monthStartInput, todayInput, useFetch } from "../../format";
import { Banner, Empty, Page, Pill } from "../../ui";

const TABS = [
  ["dia", "Del día"],
  ["serie", "Por serie"],
  ["modelo", "Por marca y modelo"],
  ["total", "Conglomerado"],
];

function SumTable({ rows }) {
  if (!rows?.length) return <Empty title="Sin repuestos" text="No hay faltantes en este corte." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Serie</th><th>Descripción</th><th>Tipo</th><th>Faltante</th><th>Incompleto</th><th>Inoperativo</th><th>Total</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.code}-${row.description}`}>
              <td>{row.code}</td>
              <td>{row.description}</td>
              <td>{row.part_type || "—"}</td>
              <td>{row.faltante}</td>
              <td>{row.incompleto}</td>
              <td>{row.inoperativo}</td>
              <td>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const brands = useFetch(() => api("/api/brands"), []);
  const [tab, setTab] = useState("dia");
  const [day, setDay] = useState(todayInput());
  const [from, setFrom] = useState(monthStartInput());
  const [to, setTo] = useState(todayInput());
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [daily, setDaily] = useState(null);
  const [needs, setNeeds] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const models = brands.data?.find((brand) => brand.id === Number(brandId))?.models?.filter((model) => !model.archived) || [];

  async function generate(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (tab === "dia") {
        setDaily(await api(`/api/reports/daily?date=${day}`));
      } else {
        const params = new URLSearchParams({ date_from: from, date_to: to });
        if (tab === "modelo") {
          if (!brandId || !modelId) throw new Error("Elige marca y modelo.");
          params.set("brand_id", brandId);
          params.set("model_id", modelId);
        }
        setNeeds(await api(`/api/reports/needs?${params.toString()}`));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Reportes"
      lede="Para pedir a almacén lo que falta, por serie, por modelo y en conjunto."
      action={<button type="button" className="btn no-print" onClick={() => window.print()}>Imprimir</button>}
    >
      <div className="tabs no-print">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "btn small active" : "btn ghost small"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <form className="filters no-print" onSubmit={generate}>
        {tab === "dia" ? (
          <input type="date" value={day} onChange={(event) => setDay(event.target.value)} required />
        ) : (
          <>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} required />
          </>
        )}
        {tab === "modelo" && (
          <>
            <select value={brandId} onChange={(event) => { setBrandId(event.target.value); setModelId(""); }} required>
              <option value="">Marca</option>
              {brands.data?.filter((brand) => !brand.archived).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
            <select value={modelId} onChange={(event) => setModelId(event.target.value)} required>
              <option value="">Modelo</option>
              {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </>
        )}
        <button className="btn" disabled={busy} type="submit">{busy ? "Generando…" : "Generar"}</button>
      </form>
      <Banner>{error}</Banner>

      {tab === "dia" && daily && (
        <article className="report-sheet">
          <header className="report-head">
            <p>Área técnica</p>
            <h2>Máquinas inspeccionadas</h2>
            <p>{formatInputDate(day)}</p>
          </header>
          {daily.groups.length === 0 && <Empty title="Sin revisiones" text="Ese día no se cerró ninguna inspección." />}
          {daily.groups.map((group) => (
            <section key={group.technician}>
              <h2>{group.technician}</h2>
              {group.inspections.map((row) => (
                <p key={row.id}>
                  <Link to={`/app/inspecciones/${row.id}`}>{row.serial}</Link>
                  {" · "}{row.brand} {row.model}
                  {row.location ? ` · ${row.location}` : ""}
                  {" · "}{row.items_count} repuestos
                  {" · "}{formatDuration(row.assigned_at, row.completed_at)}
                  {" · "}{formatDateTime(row.completed_at)}
                </p>
              ))}
            </section>
          ))}
        </article>
      )}

      {tab !== "dia" && needs && (
        <article className="report-sheet">
          <header className="report-head">
            <p>Área técnica · pedido a almacén</p>
            <h2>
              {tab === "serie" && "Necesidad por serie"}
              {tab === "modelo" && `Necesidad de ${needs.by_model?.brand || ""} ${needs.by_model?.model || ""}`}
              {tab === "total" && "Conglomerado de repuestos"}
            </h2>
            <p>Del {formatInputDate(from)} al {formatInputDate(to)} · {needs.summary.inspections} inspecciones · {needs.summary.parts_total} piezas</p>
          </header>

          {tab === "serie" && needs.by_serial.map((block) => (
            <section key={block.inspection_id} className="machine-block">
              <h3>{block.serial}</h3>
              <p className="muted">
                {block.brand} {block.model}
                {block.location ? ` · ${block.location}` : ""}
                {block.year ? ` · ${block.year}` : ""}
                {" · "}{block.technician}
                {" · "}{formatDateTime(block.completed_at)}
              </p>
              {block.parts.length === 0 && <p>Sin faltantes.</p>}
              {block.parts.map((part) => (
                <p key={`${part.code}-${part.condition}`}>
                  <Pill value={part.condition} /> {part.quantity} × {part.description} ({part.code})
                  {part.note ? ` — ${part.note}` : ""}
                </p>
              ))}
            </section>
          ))}
          {tab === "serie" && needs.by_serial.length === 0 && <Empty title="Sin máquinas" text="No hay inspecciones cerradas en ese rango." />}

          {tab === "modelo" && <SumTable rows={needs.by_model?.parts || []} />}
          {tab === "total" && <SumTable rows={needs.conglomerate} />}
        </article>
      )}
    </Page>
  );
}
