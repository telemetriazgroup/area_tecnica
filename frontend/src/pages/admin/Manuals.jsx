import { useMemo, useState } from "react";
import { api } from "../../api";
import { useFetch } from "../../format";
import { Banner, Empty, ManualView, Page } from "../../ui";

export default function Manuals() {
  const brands = useFetch(() => api("/api/brands"), []);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const models = useMemo(
    () => brands.data?.find((brand) => brand.id === Number(brandId))?.models?.filter((model) => !model.archived) || [],
    [brands.data, brandId],
  );
  const model = models.find((item) => item.id === Number(modelId));
  const brand = brands.data?.find((item) => item.id === Number(brandId));

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !modelId) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("manual", file);
    try {
      await api(`/api/models/${modelId}/manual`, { method: "POST", form });
      setMessage("Manual guardado.");
      brands.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!model || !window.confirm(`¿Quitar el manual de ${brand?.name || ""} ${model.name}?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/models/${model.id}/manual`, { method: "DELETE" });
      setMessage("Manual quitado.");
      brands.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Manuales" lede="Un PDF por marca y modelo. El técnico lo abre mientras inspecciona ese equipo.">
      <Banner>{error || brands.error}</Banner>
      <Banner kind="ok">{message}</Banner>
      <div className="filters">
        <select value={brandId} onChange={(event) => { setBrandId(event.target.value); setModelId(""); }}>
          <option value="">Marca</option>
          {brands.data?.filter((item) => !item.archived).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
          <option value="">Modelo</option>
          {models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      {!model && <Empty title="Elige marca y modelo" text="Ahí se carga el PDF del manual de partes." />}
      {model && (
        <article className="card">
          <h2>{brand?.name} {model.name}</h2>
          <p className="muted">{model.has_manual ? model.manual_name : "Sin manual."}</p>
          <div className="actions">
            <label className="btn">
              {busy ? "Guardando…" : model.has_manual ? "Reemplazar PDF" : "Cargar PDF"}
              <input type="file" accept="application/pdf,.pdf" hidden disabled={busy} onChange={upload} />
            </label>
            {model.has_manual && (
              <>
                <button type="button" className="btn ghost" onClick={() => setOpen(true)}>Ver</button>
                <button type="button" className="btn danger" onClick={remove}>Quitar</button>
              </>
            )}
          </div>
        </article>
      )}
      {open && model && (
        <ManualView
          modelId={model.id}
          title={`Manual de ${brand?.name || ""} ${model.name}`}
          present={model.has_manual}
          onClose={() => setOpen(false)}
        />
      )}
    </Page>
  );
}
