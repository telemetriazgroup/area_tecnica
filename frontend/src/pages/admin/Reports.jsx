import { useState } from "react";
import { Link } from "react-router-dom";
import { BASE, api, download } from "../../api";
import { formatDateTime, formatDuration, formatInputDate, monthStartInput, todayInput, useFetch } from "../../format";
import { Banner, Empty, Page, Pill } from "../../ui";

const TABS = [
  ["dia", "Del día"],
  ["serie", "Por serie"],
  ["modelo", "Por marca y modelo"],
  ["total", "Conglomerado"],
  ["general", "General"],
];

function SumTable({ rows, conditions }) {
  if (!rows?.length) return <Empty title="Sin repuestos" text="No hay anotaciones en este corte." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Serie</th><th>Descripción</th><th>Tipo</th>
            {(conditions || []).map((item) => <th key={item.key}>{item.label}</th>)}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.code}-${row.description}`}>
              <td>{row.code}</td>
              <td>{row.description}</td>
              <td>{row.part_type || "—"}</td>
              {(conditions || []).map((item) => <td key={item.key}>{row.quantities?.[item.key] || 0}</td>)}
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

  async function exportFile(format) {
    setError("");
    const ext = format === "pdf" ? "pdf" : "xlsx";
    try {
      if (tab === "dia") {
        await download(`/api/reports/daily/export?date=${day}&format=${format}`, `inspecciones-${day}.${ext}`);
        return;
      }
      if (tab === "modelo" && (!brandId || !modelId)) throw new Error("Elige marca y modelo.");
      const params = new URLSearchParams({ date_from: from, date_to: to, format, view: tab });
      if (tab === "modelo") {
        params.set("brand_id", brandId);
        params.set("model_id", modelId);
      }
      const names = { serie: "necesidad-serie", modelo: "necesidad-modelo", total: "conglomerado", general: "reporte-general" };
      await download(`/api/reports/needs/export?${params}`, `${names[tab]}-${from}-al-${to}.${ext}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Page
      title="Reportes"
      lede="Para pedir a almacén lo que falta, por serie, por modelo, en conjunto y el general por marca y modelo."
      action={
        <div className="row-actions no-print">
          <button type="button" className="btn ghost" onClick={() => exportFile("xlsx")}>Excel</button>
          <button type="button" className="btn ghost" onClick={() => exportFile("pdf")}>PDF</button>
          <button type="button" className="btn" onClick={() => window.print()}>Imprimir</button>
        </div>
      }
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
            <img src={`${BASE}/logo.png`} alt="ZGROUP" />
            <div>
              <p>Área técnica</p>
              <h2>Máquinas inspeccionadas</h2>
              <p>{formatInputDate(day)}</p>
            </div>
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
            <img src={`${BASE}/logo.png`} alt="ZGROUP" />
            <div>
              <p>Área técnica · pedido a almacén</p>
              <h2>
                {tab === "serie" && "Necesidad por serie"}
                {tab === "modelo" && `Necesidad de ${needs.by_model?.brand || ""} ${needs.by_model?.model || ""}`}
                {tab === "total" && "Conglomerado de repuestos"}
                {tab === "general" && "Reporte general"}
              </h2>
              <p>
                Del {formatInputDate(from)} al {formatInputDate(to)}
                {tab === "modelo"
                  ? ` · ${needs.by_model?.machines || 0} equipos · ${needs.by_model?.parts.reduce((sum, row) => sum + row.total, 0) || 0} piezas`
                  : tab === "general"
                    ? ` · ${needs.models?.length || 0} ${needs.models?.length === 1 ? "marca y modelo" : "marcas y modelos"} · ${needs.summary.machines} equipos · ${needs.summary.parts_total} piezas`
                    : ` · ${needs.summary.inspections} inspecciones · ${needs.summary.parts_total} piezas`}
              </p>
            </div>
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
              {block.parts.length === 0 && <p>Sin repuestos.</p>}
              {block.parts.map((part) => (
                <p key={`${part.code}-${part.condition}`}>
                  <Pill value={part.condition} label={needs.conditions?.find((item) => item.key === part.condition)?.label} /> {part.quantity} × {part.description} ({part.code})
                  {part.note ? ` — ${part.note}` : ""}
                </p>
              ))}
            </section>
          ))}
          {tab === "serie" && needs.by_serial.length === 0 && <Empty title="Sin máquinas" text="No hay inspecciones cerradas en ese rango." />}

          {tab === "modelo" && (needs.by_model?.units || []).map((block) => (
            <section key={block.inspection_id} className="machine-block">
              <h3>{block.serial}</h3>
              <p className="muted">
                {block.location || "Sin ubicación"}
                {block.year ? ` · ${block.year}` : ""}
                {" · "}{block.technician}
                {" · "}{formatDateTime(block.completed_at)}
              </p>
              {block.parts.length === 0 && <p>Sin repuestos.</p>}
              {block.parts.map((part) => (
                <p key={`${block.inspection_id}-${part.code}-${part.condition}`}>
                  <Pill value={part.condition} label={needs.conditions?.find((item) => item.key === part.condition)?.label} /> {part.quantity} × {part.description} ({part.code})
                  {part.note ? ` — ${part.note}` : ""}
                </p>
              ))}
            </section>
          ))}
          {tab === "modelo" && needs.by_model?.units?.length === 0 && <Empty title="Sin equipos" text="Ese modelo no tiene inspecciones cerradas en ese rango." />}
          {tab === "modelo" && needs.by_model?.units?.length > 0 && (
            <>
              <h2>Total del modelo</h2>
              <SumTable rows={needs.by_model.parts} conditions={needs.conditions} />
            </>
          )}
          {tab === "total" && <SumTable rows={needs.conglomerate} conditions={needs.conditions} />}

          {tab === "general" && (needs.models || []).map((block) => (
            <section key={`${block.brand}-${block.model}`} className="model-page">
              <h2>{block.brand} {block.model}</h2>
              <p className="muted">{block.machines} equipos · {block.parts.reduce((sum, row) => sum + row.total, 0)} piezas</p>
              {block.units.map((unit) => (
                <div key={unit.inspection_id} className="machine-block">
                  <h3>{unit.serial}</h3>
                  <p className="muted">
                    {unit.location || "Sin ubicación"}
                    {unit.year ? ` · ${unit.year}` : ""}
                    {" · "}{unit.technician}
                    {" · "}{formatDateTime(unit.completed_at)}
                  </p>
                  {unit.parts.length === 0 && <p>Sin repuestos.</p>}
                  {unit.parts.map((part) => (
                    <p key={`${unit.inspection_id}-${part.code}-${part.condition}`}>
                      <Pill value={part.condition} label={needs.conditions?.find((item) => item.key === part.condition)?.label} /> {part.quantity} × {part.description} ({part.code})
                      {part.note ? ` — ${part.note}` : ""}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          ))}
          {tab === "general" && needs.models?.length === 0 && <Empty title="Sin equipos" text="No hay inspecciones cerradas en ese rango." />}
        </article>
      )}
    </Page>
  );
}
