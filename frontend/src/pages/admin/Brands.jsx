import { useState } from "react";
import { api, download } from "../../api";
import { useFetch } from "../../format";
import { Banner, Empty, Field, Modal, Page } from "../../ui";

export default function Brands() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const list = useFetch(() => api(`/api/brands?include_archived=${includeArchived}`), [includeArchived]);
  const [brandForm, setBrandForm] = useState(null);
  const [modelForm, setModelForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveBrand(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (brandForm.id) await api(`/api/brands/${brandForm.id}`, { method: "PATCH", body: { name: brandForm.name } });
      else await api("/api/brands", { method: "POST", body: { name: brandForm.name } });
      setBrandForm(null);
      list.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveModel(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (modelForm.id) await api(`/api/models/${modelForm.id}`, { method: "PATCH", body: { name: modelForm.name } });
      else await api(`/api/brands/${modelForm.brand_id}/models`, { method: "POST", body: { name: modelForm.name } });
      setModelForm(null);
      list.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(kind, row) {
    const action = row.archived ? "restore" : "archive";
    const path = kind === "brand" ? `/api/brands/${row.id}/${action}` : `/api/models/${row.id}/${action}`;
    if (!window.confirm(row.archived ? "¿Restaurar?" : "¿Archivar?")) return;
    setError("");
    try {
      await api(path, { method: "POST" });
      list.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await api("/api/brands/bulk", { method: "POST", form: formData });
      const sample = (result.errors || []).slice(0, 3).map((item) => `Fila ${item.row}: ${item.detail}`).join(" ");
      const fails = result.errors?.length ? ` ${result.errors.length} filas con error.` : "";
      setMessage(`Se crearon ${result.created} y se actualizaron ${result.updated}.${fails} ${sample}`.trim());
      list.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Marcas y modelos"
      lede="Cada marca agrupa los modelos de reefer que se inspeccionan."
      action={<button type="button" className="btn" onClick={() => { setError(""); setBrandForm({ name: "" }); }}>Nueva marca</button>}
    >
      <Banner>{error || list.error}</Banner>
      <Banner kind="ok">{message}</Banner>
      <div className="actions" style={{ marginBottom: 14 }}>
        <label className="btn ghost">
          Cargar Excel
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={upload} />
        </label>
        <button type="button" className="btn ghost" onClick={() => download("/api/brands/template", "plantilla-marcas.xlsx").catch((err) => setError(err.message))}>
          Descargar plantilla
        </button>
        <label className="check"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Mostrar archivados</label>
      </div>
      {list.loading && <p>Cargando…</p>}
      {!list.loading && list.data?.length === 0 && <Empty title="Sin marcas" text="Agrega la primera marca y luego sus modelos." />}
      <div className="stack">
        {list.data?.map((brand) => (
          <article key={brand.id} className={brand.archived ? "card archived" : "card"}>
            <header>
              <h2>{brand.name}{brand.archived ? " · archivada" : ""}</h2>
              <div className="actions">
                <button type="button" className="btn ghost small" onClick={() => setModelForm({ brand_id: brand.id, name: "" })}>Agregar modelo</button>
                <button type="button" className="btn ghost small" onClick={() => setBrandForm({ id: brand.id, name: brand.name })}>Editar</button>
                <button type="button" className="btn danger small" onClick={() => toggle("brand", brand)}>{brand.archived ? "Restaurar" : "Archivar"}</button>
              </div>
            </header>
            <ul className="model-list">
              {brand.models.map((model) => (
                <li key={model.id}>
                  <span>{model.name}{model.archived ? " · archivado" : ""}</span>
                  <div className="actions">
                    <button type="button" className="btn ghost small" onClick={() => setModelForm({ id: model.id, name: model.name })}>Editar</button>
                    <button type="button" className="btn danger small" onClick={() => toggle("model", model)}>{model.archived ? "Restaurar" : "Archivar"}</button>
                  </div>
                </li>
              ))}
              {brand.models.length === 0 && <li className="muted">Sin modelos</li>}
            </ul>
          </article>
        ))}
      </div>

      {brandForm && (
        <Modal title={brandForm.id ? "Editar marca" : "Nueva marca"} onClose={() => setBrandForm(null)}>
          <form onSubmit={saveBrand}>
            <Field label="Marca"><input value={brandForm.name} required onChange={(event) => setBrandForm({ ...brandForm, name: event.target.value })} /></Field>
            <button className="btn block" disabled={busy} type="submit">Guardar</button>
          </form>
        </Modal>
      )}
      {modelForm && (
        <Modal title={modelForm.id ? "Editar modelo" : "Nuevo modelo"} onClose={() => setModelForm(null)}>
          <form onSubmit={saveModel}>
            <Field label="Modelo"><input value={modelForm.name} required onChange={(event) => setModelForm({ ...modelForm, name: event.target.value })} /></Field>
            <button className="btn block" disabled={busy} type="submit">Guardar</button>
          </form>
        </Modal>
      )}
    </Page>
  );
}
