import { useMemo, useState } from "react";
import { api, download } from "../../api";
import { useAuth } from "../../auth";
import { useFetch } from "../../format";
import { Banner, Empty, Field, Modal, Page } from "../../ui";

export default function Parts() {
  const { user } = useAuth();
  const canSeeArchived = user?.role === "superadmin";
  const brands = useFetch(() => api("/api/brands"), []);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const parts = useFetch(
    () => (modelId ? api(`/api/spare-parts?model_id=${modelId}&include_archived=${includeArchived}&limit=5000`) : Promise.resolve([])),
    [modelId, includeArchived],
  );
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const models = useMemo(
    () => brands.data?.find((brand) => brand.id === Number(brandId))?.models?.filter((model) => !model.archived) || [],
    [brands.data, brandId],
  );

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (form.id) {
        await api(`/api/spare-parts/${form.id}`, {
          method: "PATCH",
          body: { code: form.code, description: form.description, part_type: form.part_type || null },
        });
      } else {
        await api("/api/spare-parts", {
          method: "POST",
          body: {
            brand_id: Number(brandId),
            model_id: Number(modelId),
            code: form.code,
            description: form.description,
            part_type: form.part_type || null,
          },
        });
      }
      setForm(null);
      parts.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row) {
    const action = row.archived ? "restore" : "archive";
    if (!window.confirm(row.archived ? "¿Restaurar el repuesto?" : "¿Archivar el repuesto?")) return;
    try {
      await api(`/api/spare-parts/${row.id}/${action}`, { method: "POST" });
      parts.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !modelId) return;
    setBusy(true);
    setError("");
    setMessage("");
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await api(`/api/spare-parts/bulk?brand_id=${brandId}&model_id=${modelId}`, { method: "POST", form: formData });
      const sample = (result.errors || []).slice(0, 3).map((item) => `Fila ${item.row}: ${item.detail}`).join(" ");
      const fails = result.errors?.length ? ` ${result.errors.length} filas con error.` : "";
      setMessage(`Se crearon ${result.created} y se actualizaron ${result.updated}.${fails} ${sample}`.trim());
      parts.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Repuestos" lede="La lista pertenece a una marca y un modelo. Serie y descripción son obligatorias; el tipo es opcional.">
      <Banner>{error || parts.error || brands.error}</Banner>
      <Banner kind="ok">{message}</Banner>
      <div className="filters">
        <select value={brandId} onChange={(event) => { setBrandId(event.target.value); setModelId(""); }}>
          <option value="">Marca</option>
          {brands.data?.filter((brand) => !brand.archived).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
        <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
          <option value="">Modelo</option>
          {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
        </select>
        {canSeeArchived && (
          <label className="check"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Archivados</label>
        )}
      </div>
      {modelId && (
        <div className="actions" style={{ marginBottom: 14 }}>
          <button type="button" className="btn" onClick={() => setForm({ code: "", description: "", part_type: "" })}>Nuevo repuesto</button>
          <label className="btn ghost">
            Cargar Excel
            <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden onChange={upload} />
          </label>
          <button type="button" className="btn ghost" onClick={() => download("/api/spare-parts/template", "plantilla-repuestos.xlsx").catch((err) => setError(err.message))}>Descargar plantilla</button>
        </div>
      )}
      {!modelId && <Empty title="Elige marca y modelo" text="Después puedes cargar un repuesto o una lista completa." />}
      {modelId && !parts.loading && parts.data?.length === 0 && <Empty title="Sin repuestos" text="Agrega uno o sube la plantilla Excel de esta marca y modelo." />}
      {modelId && parts.data?.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Serie</th><th>Descripción</th><th>Tipo</th><th></th></tr></thead>
            <tbody>
              {parts.data.map((row) => (
                <tr key={row.id}>
                  <td data-label="Serie">{row.code}</td>
                  <td data-label="Descripción">{row.description}{row.archived ? " · archivado" : ""}</td>
                  <td data-label="Tipo">{row.part_type || "—"}</td>
                  <td className="actions" data-label="">
                    <button type="button" className="btn ghost small" onClick={() => setForm(row)}>Editar</button>
                    {row.archived ? (
                      canSeeArchived && <button type="button" className="btn danger small" onClick={() => toggle(row)}>Restaurar</button>
                    ) : (
                      <button type="button" className="btn danger small" onClick={() => toggle(row)}>Archivar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar repuesto" : "Nuevo repuesto"} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Field label="Serie"><input value={form.code} required onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
            <Field label="Descripción"><input value={form.description} required onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <Field label="Tipo" hint="Opcional."><input value={form.part_type || ""} onChange={(event) => setForm({ ...form, part_type: event.target.value })} /></Field>
            <button className="btn block" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar"}</button>
          </form>
        </Modal>
      )}
    </Page>
  );
}
