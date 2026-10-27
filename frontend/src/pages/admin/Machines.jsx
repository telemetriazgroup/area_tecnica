import { useMemo, useState } from "react";
import { api } from "../../api";
import { useFetch } from "../../format";
import { Banner, Empty, Field, Modal, Page, Pill } from "../../ui";

const blank = { serial: "", brand_id: "", model_id: "", location: "", year: "" };

export default function Machines() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const list = useFetch(
    () => api(`/api/machines?include_archived=${includeArchived}&q=${encodeURIComponent(query)}`),
    [includeArchived, query],
  );
  const brands = useFetch(() => api("/api/brands?include_archived=true"), []);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const models = useMemo(() => {
    const brand = brands.data?.find((item) => item.id === Number(form?.brand_id));
    return brand?.models || [];
  }, [brands.data, form?.brand_id]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      serial: form.serial,
      brand_id: Number(form.brand_id),
      model_id: Number(form.model_id),
      location: form.location || null,
      year: form.year === "" ? null : Number(form.year),
    };
    try {
      if (form.id) await api(`/api/machines/${form.id}`, { method: "PATCH", body });
      else await api("/api/machines", { method: "POST", body });
      setForm(null);
      list.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row) {
    const action = row.archived ? "restore" : "archive";
    if (!window.confirm(row.archived ? "¿Restaurar la máquina?" : "¿Archivar la máquina?")) return;
    setError("");
    try {
      await api(`/api/machines/${row.id}/${action}`, { method: "POST" });
      list.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Page
      title="Máquinas"
      lede="La serie, la marca y el modelo identifican cada reefer. Ubicación y año son opcionales."
      action={<button type="button" className="btn" onClick={() => { setError(""); setForm({ ...blank }); }}>Nueva máquina</button>}
    >
      <Banner>{error || list.error}</Banner>
      <form className="filters" onSubmit={(event) => { event.preventDefault(); setQuery(q.trim()); }}>
        <input value={q} placeholder="Buscar serie o ubicación" onChange={(event) => setQ(event.target.value)} />
        <button className="btn ghost" type="submit">Buscar</button>
        <label className="check"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Mostrar archivadas</label>
      </form>
      {list.loading && <p>Cargando…</p>}
      {!list.loading && list.data?.length === 0 && <Empty title="Sin máquinas" text="Registra la serie que se va a inspeccionar." />}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Serie</th><th>Marca</th><th>Modelo</th><th>Ubicación</th><th>Año</th><th>Revisión</th><th></th></tr>
          </thead>
          <tbody>
            {list.data?.map((row) => (
              <tr key={row.id}>
                <td data-label="Serie">{row.serial}{row.archived ? " · archivada" : ""}</td>
                <td data-label="Marca">{row.brand_name}</td>
                <td data-label="Modelo">{row.model_name}</td>
                <td data-label="Ubicación">{row.location || "—"}</td>
                <td data-label="Año">{row.year || "—"}</td>
                <td data-label="Revisión">{row.active_assignment ? <Pill value={row.active_assignment.status} /> : "Libre"}</td>
                <td className="actions" data-label="">
                  <button type="button" className="btn ghost small" onClick={() => setForm({ ...row, location: row.location || "", year: row.year || "" })}>Editar</button>
                  <button type="button" className="btn danger small" onClick={() => toggle(row)}>{row.archived ? "Restaurar" : "Archivar"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.id ? "Editar máquina" : "Nueva máquina"} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Banner>{error}</Banner>
            <Field label="Serie"><input value={form.serial} required onChange={(event) => setForm({ ...form, serial: event.target.value })} /></Field>
            <Field label="Marca">
              <select
                required
                value={form.brand_id}
                onChange={(event) => setForm({ ...form, brand_id: event.target.value, model_id: "" })}
              >
                <option value="">Elegir</option>
                {brands.data?.filter((brand) => !brand.archived || brand.id === Number(form.brand_id)).map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Modelo">
              <select required value={form.model_id} onChange={(event) => setForm({ ...form, model_id: event.target.value })}>
                <option value="">Elegir</option>
                {models.filter((model) => !model.archived || model.id === Number(form.model_id)).map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Ubicación" hint="Opcional.">
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            </Field>
            <Field label="Año" hint="Opcional.">
              <input type="number" min="1980" max="2100" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} />
            </Field>
            <button className="btn block" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar"}</button>
          </form>
        </Modal>
      )}
    </Page>
  );
}
